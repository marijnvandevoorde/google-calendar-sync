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
    'identifierTemplate': '<xxx:.*:yyy>'
};

var calendarSync = function (configuration) {
    let config = configuration;
    let identifierRegex = new RegExp(config.identifierTemplate + '$');

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

    function cleanCalendar(calendar) {
        let window = getSyncWindow();
        let events = calendar.getEvents(window.since, window.until);

        for (let currentEvent of events) {
            if (identifierRegex.test(currentEvent.getDescription())) {
                currentEvent.deleteEvent();
                console.log("Deleted " + currentEvent.getTitle());
            }
        }
    }


    function runSync(sourceCalendar, targetCalendar, prefix, transparency) {
        let window = getSyncWindow();
        let sourceEvents = sourceCalendar.getEvents(window.since, window.until);
        let targetEvents = targetCalendar.getEvents(window.since, window.until);

        function searchIdenticalEvent(sourceEvent) {
            // if the secondary event has already been blocked in the primary calendar, ignore it
            for (let targetEventIndex = 0; targetEventIndex < targetEvents.length; targetEventIndex++) {
                let targetEvent = targetEvents[targetEventIndex];
                if (
                    (targetEvent.getStartTime().getTime() == sourceEvent.getStartTime().getTime())
                    &&
                    (targetEvent.getEndTime().getTime() == sourceEvent.getEndTime().getTime())
                    &&
                    (
                        targetEvent.getDescription().endsWith(buildIdentifier(sourceEvent.getId()))
                        ||
                        sourceEvent.getDescription().endsWith('[' + targetEvent.getId() + ':mwlsync]')
                    )
                ) {
                    return targetEventIndex;
                }
            }
            return -1;
        }

        for (let sourceEvent of sourceEvents) {
            let myStatus = sourceEvent.getMyStatus();
            // Events you created without other guests report a null status, but
            // they are still your own busy time, so keep syncing them.
            let attending = myStatus == null
                || myStatus == CalendarApp.GuestStatus.YES
                || myStatus == CalendarApp.GuestStatus.OWNER;
            if (!attending) {
                console.log('skipping ' + sourceEvent.getTitle() + ' because not confirmed attendance yet: ' + myStatus);
                continue;
            }
            // don't copy it because we'll end up in a loop!
            if (identifierRegex.test(sourceEvent.getDescription())) {
                console.log('skipping ' + sourceEvent.getTitle());
                continue;

            }
            let identicalEventIndex = searchIdenticalEvent(sourceEvent);

            if (identicalEventIndex !== -1) {
                console.log('skipping ' + sourceEvent.getTitle());
                targetEvents.splice(identicalEventIndex, 1);
                continue;
            }


            let meetingDetails = {
                'title': prefix,
                'context': {
                    'description': ''
                }
            }
            switch (transparency) {
                case 'full':
                    meetingDetails.title += sourceEvent.getTitle();
                    meetingDetails.context = {
                        'location': sourceEvent.getLocation(),
                        'description': sourceEvent.getDescription()
                    }
                    break;
                case 'title':
                    meetingDetails.title += sourceEvent.getTitle();
                    break;
                default:
                    meetingDetails.title += 'busy';
            }
            meetingDetails.context.description += '\n\n\n ' + buildIdentifier(sourceEvent.getId())

            let newEvent;
            if (sourceEvent.isAllDayEvent()) {
                newEvent = targetCalendar.createAllDayEvent(meetingDetails.title, sourceEvent.getAllDayStartDate(), sourceEvent.getAllDayEndDate(), meetingDetails.context);
            } else {
                newEvent = targetCalendar.createEvent(meetingDetails.title, sourceEvent.getStartTime(), sourceEvent.getEndTime(), meetingDetails.context);
            }
            newEvent.removeAllReminders();
        }

        // clean up rogue events. These were probably moved, deleted... who knows?
        for (let targetEvent of targetEvents) {
            if (!identifierRegex.test(targetEvent.getDescription())) {
                continue;
            }
            console.log('deleting ' + targetEvent.getTitle());
            targetEvent.deleteEvent();
        }

    }

    function inboundSync() {
        runSync(
            CalendarApp.getCalendarById(config.externalCalendarId),
            CalendarApp.getCalendarById(config.internalCalendarId),
            config.externalPrefix,
            config.externalTransparency
        )
    }


    function outboundSync() {
        runSync(
            CalendarApp.getCalendarById(config.internalCalendarId),
            CalendarApp.getCalendarById(config.externalCalendarId),
            config.internalPrefix,
            config.internalTransparency
        )
    }

    var cleanExternalCalendar = function () {
        let calendar = CalendarApp.getCalendarById(config.externalCalendarId);
        cleanCalendar(calendar);
    };

    var cleanInternalCalendar = function () {
        let calendar = CalendarApp.getCalendarById(config.internalCalendarId);
        cleanCalendar(calendar);
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
