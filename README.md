# ReminderBot
Sends Discord messages as reminders for Google Calendar events.

## Getting Started
1. Copy `config.template.js` to `config.js`.
2. Follow the [Create Web application credentials](https://developers.google.com/workspace/guides/create-credentials#web-application) guide.
3. Enable the Google Calendar API in the Google Cloud Console.
4. Make a bot in the Discord developers portal, and add it to your guild.
5. Fill in the following values in `config.js`:
    - `GOOGLE_CLIENT_ID`: The client ID from your web app credential in the Google Cloud Console.
    - `GOOGLE_CLIENT_SECRET`: The client secret from your web app credential in the Google Cloud Console.
    - `DISCORD_TOKEN`: The token of your bot from the Discord developers page.
    - `GUILD_ID`: The ID of the guild you want the bot to be in.
    - `LOGGING_CHANNEL`: The ID of the channel you want messages to be sent to. Logging channel should be a text channel inside the guild specified above.
    - `CRON_SCHEDULE`: The time(s) the bot will check for trigger events. Use cron syntax; you can have it run multiple times a day, but for now, all events from tomorrow at 12:00:00 AM to tomorrow at 11:59:59 PM will be checked, so it is recommended that this is set to once a day.
    - `CALENDAR_IDS`: The IDs of all of the Google Calendars you want to check for trigger events.
    - `REMINDERS`: A map of triggering event names to their reminder message text: `{ "Event Name": "Reminder message" }`.

## Using PM2
You need to make sure to set the `TZ` environment variable to your correct timezone. If you're using PM2 to manage your process, you can add the following config file, replacing the timezone with yours:

**pm2.config.cjs**
```js
module.exports = {
	apps: [{
		name: "reminderbot",
		script: "index.js",
		env: {
			TZ: "America/Los_Angeles"
		}
	}]
}
```

Then, to start, do `pm2 start pm2.config.cjs`.

