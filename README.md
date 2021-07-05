# google-calendar-sync
Keep two calendars in sync without the need of an external tool.


## Howto
- Go to scripts.google.com
- create a new project and past the code in the js file
- Change the config at the top. Most are well explained by comments but:
  - externalCalendarId: 'jon@doe.com',
  - internalCalendarId': CalendarApp.getDefaultCalendar().getId(),
  - externalPrefix: 'xxx - ',
  - externalTransparency: 'full',
  - internalPrefix: 'yyy - ',
  - internalTransparency: 'free-busy',
  - daysAhead: Default '30'. Number of days to sync in the future
  - daysInPast: Default '1'. Number of days to sync in the past. 
  - identifierTemplate: Default '&lt;xxx:.*:yyy&gt;' but best to replace the xxx and yyy with something unique to this sync. Maybe use your prefixes.
