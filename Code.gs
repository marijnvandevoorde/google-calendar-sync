let config = {
    // make sure you have read & modify access to this calendar if you want to also sync the external calendar
    'externalCalendarId': 'john@doe.com',
    // replace with a specific calendar id if you want to sync with a calendar other than your default one
    'internalCalendarId': CalendarApp.getDefaultCalendar().getId(),
    // prefix for events in external calendar
    'externalPrefix': 'xxx - ',
    // transparency for external calendar. Either 'free-busy', 'title' or 'full'
    'externalTransparency': 'full',
    'internalPrefix': 'yyy - ',
    // transparency for internal calendar. Either 'free-busy', 'title' or 'full'
    'internalTransparency': 'free-busy',
    // # of days to sync in the future
    'daysAhead': 30,
    'daysInPast': 1,
    // Must be unique per sync. The '.*' is replaced by event ids; the rest is
    // used verbatim both to build identifiers and as a RegExp to recognize them.
    // Avoid regex special characters: replace xxx and yyy with your prefixes
    // and stick to alphanumeric characters.
    'identifierTemplate': '<xxx:.*:yyy>',
    'disabled': false
};

var calendarSync = function (configuration) {
    let config = configuration;
    let identifierRegex = new RegExp(config.identifierTemplate + '$');

    // How hard to retry a single Calendar API call before giving up on it for
    // this run. Short backoff smooths over brief rate-limit bursts; a hard
    // quota block is left for the next scheduled run to pick up.
    let maxAttempts = 3;
    let initialBackoffMs = 2000;

    // Set once a "too many times for one day" exception is seen. Every further
    // Calendar call in this run then no-ops immediately - retrying or trying
    // more operations only burns execution time on quota that won't recover
    // until tomorrow.
    let dailyQuotaExhausted = false;

    function isDailyQuotaError(error) {
        if (error == null) {
            return false;
        }
        let message = error.message ? error.message : String(error);
        return message.indexOf('too many times for one day') !== -1;
    }

    function getSyncWindow() {
        let since = new Date();
        since.setDate(since.getDate() - config.daysInPast);
        let until = new Date();
        until.setDate(until.getDate() + config.daysAhead);
        return {since: since, until: until};
    }

    function buildIdentifier(eventId) {
        return config.identifierTemplate.replace('.*', eventId);
    }

    // Runs a Calendar API call, retrying with exponential backoff so transient
    // rate limiting doesn't abort the whole sync. Returns the call's result, or
    // null if it kept failing - in that case the run simply continues and the
    // next sync retries whatever was left. The daily-quota error is a special
    // case: there is no point retrying it within the same day, so it flips the
    // dailyQuotaExhausted flag and every subsequent call short-circuits.
    function withRetry(label, operation) {
        if (dailyQuotaExhausted) {
            return null;
        }
        let backoffMs = initialBackoffMs;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return operation();
            } catch (error) {
                if (isDailyQuotaError(error)) {
                    console.error('daily Calendar quota exhausted on ' + label + ' - skipping the rest of this run: ' + error);
                    dailyQuotaExhausted = true;
                    return null;
                }
                if (attempt === maxAttempts) {
                    console.error('giving up on ' + label + ' after ' + maxAttempts + ' attempts: ' + error);
                    return null;
                }
                console.warn('could not ' + label + ' (attempt ' + attempt + '): ' + error + ' - retrying in ' + backoffMs + 'ms');
                Utilities.sleep(backoffMs);
                backoffMs *= 2;
            }
        }
        return null;
    }

    // Serializes runs against a script-wide mutex. Without this, two triggers
    // firing close together (e.g. inbound and outbound both on "calendar
    // changed") read the calendars before either writes, both decide the same
    // copy is missing, and both create it - producing duplicates.
    function withScriptLock(label, operation) {
        let lock = LockService.getScriptLock();
        if (!lock.tryLock(30000)) {
            console.log('skipping ' + label + ': another sync is already running');
            return;
        }
        try {
            operation();
        } finally {
            lock.releaseLock();
        }
    }

    function cleanCalendar(calendar) {
        let window = getSyncWindow();
        let events = withRetry('read events', function () {
            return calendar.getEvents(window.since, window.until);
        });
        if (events == null) {
            return;
        }

        for (let currentEvent of events) {
            if (!identifierRegex.test(currentEvent.getDescription())) {
                continue;
            }
            let deleted = withRetry('delete "' + currentEvent.getTitle() + '"', function () {
                currentEvent.deleteEvent();
                return true;
            });
            if (deleted) {
                console.log('Deleted ' + currentEvent.getTitle());
            }
        }
    }

    // Builds the title/description/location a synced copy should have. The
    // identifier is appended to the description so the copy can be recognized
    // (and matched back to its source) on later runs.
    function buildMeetingDetails(sourceEvent, prefix, transparency) {
        let details = {
            'title': prefix + 'busy',
            'description': '',
            'location': ''
        };
        if (transparency === 'full' || transparency === 'title') {
            details.title = prefix + sourceEvent.getTitle();
        }
        if (transparency === 'full') {
            details.description = sourceEvent.getDescription();
            details.location = sourceEvent.getLocation() || '';
        }
        details.description += '\n\n\n ' + buildIdentifier(sourceEvent.getId());
        return details;
    }

    function createSyncedEvent(targetCalendar, sourceEvent, details) {
        let options = {'description': details.description, 'location': details.location};
        let newEvent = withRetry('create "' + details.title + '"', function () {
            if (sourceEvent.isAllDayEvent()) {
                return targetCalendar.createAllDayEvent(details.title, sourceEvent.getAllDayStartDate(), sourceEvent.getAllDayEndDate(), options);
            }
            return targetCalendar.createEvent(details.title, sourceEvent.getStartTime(), sourceEvent.getEndTime(), options);
        });
        if (newEvent == null) {
            return;
        }
        console.log('created ' + details.title);
        withRetry('remove reminders from "' + details.title + '"', function () {
            newEvent.removeAllReminders();
            return true;
        });
    }

    // Updates an existing synced copy in place (mostly a move to a new time)
    // instead of deleting and recreating it. Only the fields that actually
    // changed are written, so a moved event usually costs a single API write.
    function updateSyncedEvent(targetCalendar, targetEvent, sourceEvent, details) {
        if (sourceEvent.isAllDayEvent() !== targetEvent.isAllDayEvent()) {
            // There is no clean in-place conversion between all-day and timed
            // events, so fall back to replacing it.
            console.log('replacing ' + targetEvent.getTitle() + ' (switched all-day/timed)');
            let deleted = withRetry('delete "' + targetEvent.getTitle() + '"', function () {
                targetEvent.deleteEvent();
                return true;
            });
            if (deleted) {
                createSyncedEvent(targetCalendar, sourceEvent, details);
            }
            return;
        }

        console.log('moving ' + targetEvent.getTitle());
        withRetry('update "' + details.title + '"', function () {
            if (!timesMatch(targetEvent, sourceEvent)) {
                if (sourceEvent.isAllDayEvent()) {
                    targetEvent.setAllDayDates(sourceEvent.getAllDayStartDate(), sourceEvent.getAllDayEndDate());
                } else {
                    targetEvent.setTime(sourceEvent.getStartTime(), sourceEvent.getEndTime());
                }
            }
            if (targetEvent.getTitle() !== details.title) {
                targetEvent.setTitle(details.title);
            }
            if (targetEvent.getDescription() !== details.description) {
                targetEvent.setDescription(details.description);
            }
            if (targetEvent.getLocation() !== details.location) {
                targetEvent.setLocation(details.location);
            }
            return true;
        });
    }

    function timesMatch(targetEvent, sourceEvent) {
        return targetEvent.getStartTime().getTime() == sourceEvent.getStartTime().getTime()
            && targetEvent.getEndTime().getTime() == sourceEvent.getEndTime().getTime();
    }

    function runSync(sourceCalendar, targetCalendar, prefix, transparency) {
        if (config.disabled === true) return;
        let window = getSyncWindow();
        let sourceEvents = withRetry('read source events', function () {
            return sourceCalendar.getEvents(window.since, window.until);
        });
        let targetEvents = withRetry('read target events', function () {
            return targetCalendar.getEvents(window.since, window.until);
        });
        if (sourceEvents == null || targetEvents == null) {
            console.error('skipping sync: could not read calendars');
            return;
        }

        // A target event is a synced copy of sourceEvent when its description
        // carries that source event's identifier.
        function isCopyOf(targetEvent, sourceEvent) {
            return targetEvent.getDescription().endsWith(buildIdentifier(sourceEvent.getId()))
                || sourceEvent.getDescription().endsWith('[' + targetEvent.getId() + ':mwlsync]');
        }

        function findCopyIndex(sourceEvent, requireTimeMatch) {
            for (let i = 0; i < targetEvents.length; i++) {
                if (!isCopyOf(targetEvents[i], sourceEvent)) {
                    continue;
                }
                if (requireTimeMatch && !timesMatch(targetEvents[i], sourceEvent)) {
                    continue;
                }
                return i;
            }
            return -1;
        }

        // Only sync events you're attending, and never re-sync our own copies
        // (that would create an endless sync loop between the calendars).
        let eventsToSync = sourceEvents.filter(function (sourceEvent) {
            let myStatus = sourceEvent.getMyStatus();
            // Events you created without other guests report a null status, but
            // they are still your own busy time, so keep syncing them.
            let attending = myStatus == null
                || myStatus == CalendarApp.GuestStatus.YES
                || myStatus == CalendarApp.GuestStatus.OWNER;
            if (!attending) {
                console.log('skipping ' + sourceEvent.getTitle() + ' because not confirmed attendance yet: ' + myStatus);
                return false;
            }
            if (identifierRegex.test(sourceEvent.getDescription())) {
                console.log('skipping ' + sourceEvent.getTitle() + ' because it is a synced copy');
                return false;
            }
            return true;
        });

        // Phase 1: claim copies that already match exactly (same identifier and
        // same time) - those need no write at all. Doing this for every event
        // before touching anything keeps unchanged recurring instances from
        // being needlessly shuffled around in phase 2.
        let movedOrNew = [];
        for (let sourceEvent of eventsToSync) {
            let exactIndex = findCopyIndex(sourceEvent, true);
            if (exactIndex === -1) {
                movedOrNew.push(sourceEvent);
            } else {
                console.log('skipping ' + sourceEvent.getTitle() + ', already in sync');
                targetEvents.splice(exactIndex, 1);
            }
        }

        // Phase 2: a copy may still exist for an event that moved - update it
        // in place rather than deleting and recreating it. Otherwise the event
        // is genuinely new and a copy is created.
        for (let sourceEvent of movedOrNew) {
            let details = buildMeetingDetails(sourceEvent, prefix, transparency);
            let existingIndex = findCopyIndex(sourceEvent, false);
            if (existingIndex === -1) {
                createSyncedEvent(targetCalendar, sourceEvent, details);
            } else {
                let targetEvent = targetEvents.splice(existingIndex, 1)[0];
                updateSyncedEvent(targetCalendar, targetEvent, sourceEvent, details);
            }
        }

        // Clean up rogue events. These were probably deleted at the source.
        for (let targetEvent of targetEvents) {
            if (!identifierRegex.test(targetEvent.getDescription())) {
                continue;
            }
            console.log('deleting ' + targetEvent.getTitle());
            withRetry('delete "' + targetEvent.getTitle() + '"', function () {
                targetEvent.deleteEvent();
                return true;
            });
        }
    }

    function inboundSync() {
        withScriptLock('inboundSync', function () {
            runSync(
                CalendarApp.getCalendarById(config.externalCalendarId),
                CalendarApp.getCalendarById(config.internalCalendarId),
                config.externalPrefix,
                config.externalTransparency
            );
        });
    }


    function outboundSync() {
        withScriptLock('outboundSync', function () {
            runSync(
                CalendarApp.getCalendarById(config.internalCalendarId),
                CalendarApp.getCalendarById(config.externalCalendarId),
                config.internalPrefix,
                config.internalTransparency
            );
        });
    }

    var cleanExternalCalendar = function () {
        withScriptLock('cleanExternalCalendar', function () {
            let calendar = CalendarApp.getCalendarById(config.externalCalendarId);
            cleanCalendar(calendar);
        });
    };

    var cleanInternalCalendar = function () {
        withScriptLock('cleanInternalCalendar', function () {
            let calendar = CalendarApp.getCalendarById(config.internalCalendarId);
            cleanCalendar(calendar);
        });
    };

    return {
        'cleanExternalCalendar': cleanExternalCalendar,
        'cleanInternalCalendar': cleanInternalCalendar,
        'outboundSync': outboundSync,
        'inboundSync': inboundSync
    };
}(config);




function cleanExternalCalendar() {
    calendarSync.cleanExternalCalendar();
}

function cleanInternalCalendar() {
    calendarSync.cleanInternalCalendar();
}

function runOutboundSync() {
    calendarSync.outboundSync();
}


function runInboundSync() {
    calendarSync.inboundSync();
}
