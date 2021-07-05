# google-calendar-sync
Keep two calendars in sync without the need for an external tool.


## Prerequisites
- Google Apps Script enabled on your account and an internal Google calendar
- An external calendar shared with your google account. If you want to do outbound syncing, this calendar will have to be editable. This script is untested with other calendars but should work with them "in theory".

## Howto add the script to your account
Go to scripts.google.com and create a new project and give it a sensible name. As (for now), it will only sync to calendars, you could use the name of the external calendar. No worries: you can create multiple scripts to sync 3 or more calendars. They should play nicely together as long as you make sure the identifierTemplate is unique!
- create a new project and paste the code in the js file
- Change the config at the top. Most are well explained by comments but:
  - externalCalendarId: 'jon@doe.com': Fill in the email address
  - internalCalendarId': Default: CalendarApp.getDefaultCalendar().getId() (with no quotes around it). The default config will grab your default calendar on your own Google account. You can change this to an address or other calendar if you want.
  - externalPrefix: Default 'xxx - '. This prefix will be added to external events when copying them into your calendar. Make it an easy to recognize abbreviation of the external calendar.
  - externalTransparency: Default 'full'. Either 'full', 'free-busy' or 'title'. Determines how much information of the external calendar will be copied to your calendar.
  - internalPrefix: Default 'yyy - '. This prefix will be added to internal events when copying them into the external calendar. Make it an easy to recognize abbreviation towards your customer.
  - internalTransparency: Default 'free-busy'. Either 'full', 'free-busy' or 'title'. Determines how much information of your calendar will be exposed to your calendar.
  - daysAhead: Default '30'. Number of days to sync in the future
  - daysInPast: Default '1'. Number of days to sync in the past. 
  - **identifierTemplate**: Default '&lt;xxx:.*:yyy&gt;' but best to replace the xxx and yyy with something unique to this sync. Maybe use your prefixes. **It's super important that this is unique if you run multiple syncs**.

Save the script, and you're done. You can already test it but running the inbound or outbound sync methods. There are also utility methods to clean up events created by the script.

## What now.
One last thing to do is to add triggers. The most important one is to create a trigger based on updates in the external calendar and have it call the inboundSync method. It's quite straightforward. If you have edit rights in the external calendar, you can do the same for the internal calendar and have that one call the outboundSync method instead.

![image](https://user-images.githubusercontent.com/1446282/124452251-81ebc300-dd86-11eb-91f8-308ededabac1.png)

## Known issues
If you have too many meetings in the upcoming x days, you'll run into the rate-limiting of google calendar. No worries. Syncing it multiple times will still eventually sync all your meetings. As the script will then run with every update, it will only do incremental updates, so the amount of meeting creation & deletion **should** remain minimal and never cause any issues.
