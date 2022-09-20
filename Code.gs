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
    //make sure it's unique avoid regex special chars at all cost! it'll fuck shit up.
    // this is used both to recognize identifiers (hence the .* for the regex) as well as to create them. So it needs a .* because that will be replaced by id's.
    // your best option is probably to just replace xxx and yyy by your external & internal prefixes and make sure there are no regex control characters in there. Stick to alphanumeric an you're good.
    'identifierTemplate': '<xxx:.*:yyy>'
};

var calendarSync = function (configuration) {
    let config = configuration;
    let identifierRegex = new RegExp(config.identifierTemplate + '$');

    function cleanCalendar(calendar, prefix) {
        var since = new Date();
        since.setDate(since.getDate() - config.daysInPast);
        var until = new Date();
        until.setDate(until.getDate() + config.daysAhead);
        var events = calendar.getEvents(since, until);

        for (event in events) {
            var currentEvent = events[event];
            if (identifierRegex.test(currentEvent.getDescription())) {
                currentEvent.deleteEvent();
                console.log("Deleted " + currentEvent.getTitle());
            }
        }
    }


    function runSync(sourceCalendar, targetCalendar, prefix, transparency) {
        let since = new Date();
        since.setDate(since.getDate() - config.daysInPast);
        let until = new Date();
        until.setDate(until.getDate() + config.daysAhead);
        let sourceEvents = sourceCalendar.getEvents(since, until);
        let targetEvents = targetCalendar.getEvents(since, until);

        let sourceEvent, targetEvent;

        function searchIdentialEvent(sourceEvent, targetEvents, prefix) {

            for (let targetEventIndex in targetEvents) // if the secondary event has already been blocked in the primary calendar, ignore it
            {

                if (
                    (targetEvents[targetEventIndex].getStartTime().getTime() == sourceEvent.getStartTime().getTime())
                    &&
                    (targetEvents[targetEventIndex].getEndTime().getTime() == sourceEvent.getEndTime().getTime())
                    &&
                    targetEvents[targetEventIndex].getDescription().endsWith(config.identifierTemplate.replace('.*', sourceEvent.getId()))   
                ) {
                    return targetEventIndex;
                }
            }
            return false;
        }

        for (let sourceEventIndex in sourceEvents) {
            sourceEvent = sourceEvents[sourceEventIndex];
            if (sourceEvent.getMyStatus() != CalendarApp.GuestStatus.YES && sourceEvent.getMyStatus() != CalendarApp.GuestStatus.OWNER) {
                console.log('skipping ' + sourceEvent.getTitle() + ' because not confirmed attendance yet: ' + sourceEvent.getMyStatus());
                continue;
            }
            // don't copy it because we'll end up in a loop!
            if (identifierRegex.test(sourceEvent.getDescription())) {
                console.log('skipping ' + sourceEvent.getTitle());
                continue;

            }
            let identicalEventIndex = searchIdentialEvent(sourceEvent, targetEvents, prefix);

            if (identicalEventIndex) {
                console.log('skipping ' + sourceEvent.getTitle());
                targetEvents.splice(identicalEventIndex, 1);
                continue;
            }


            var meetingDetails = {
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
            meetingDetails.context.description += '\n\n\n ' + config.identifierTemplate.replace('.*', sourceEvent.getId())

            if (sourceEvent.isAllDayEvent()) {
                var newEvent = targetCalendar.createAllDayEvent(meetingDetails.title, sourceEvent.getAllDayStartDate(), sourceEvent.getAllDayEndDate(), meetingDetails.context);
                newEvent
                newEvent.removeAllReminders();
                continue;
            }

            var newEvent = targetCalendar.createEvent(meetingDetails.title, sourceEvent.getStartTime(), sourceEvent.getEndTime(), meetingDetails.context);
            newEvent.set
            newEvent.removeAllReminders();
        }

        // clean up rogue events. These were probably moved, deleted... who knows?
        for (let targetEventIndex in targetEvents) {
            if (!identifierRegex.test(targetEvents[targetEventIndex].getDescription())) {
              continue;
            }
            console.log('deleting ' + targetEvents[targetEventIndex].getTitle());
            targetEvents[targetEventIndex].deleteEvent();
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
        calendar = CalendarApp.getCalendarById(config.externalCalendarId);
        cleanCalendar(calendar, config.internalPrefix);
    }

    var cleanInternalCalendar = function () {
        calendar = CalendarApp.getCalendarById(config.internalCalendarId);
        cleanCalendar(calendar, config.externalPrefix);
    }

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


