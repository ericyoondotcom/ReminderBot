import fs from "fs";
import moment from "moment";
import discord from "discord.js";
import schedule from "node-schedule";
import gapi from "googleapis";
import { DISCORD_TOKEN, LOGGING_CHANNEL, CRON_SCHEDULE, CALENDAR_IDS, REMINDERS, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GUILD_ID } from "./config.js";
import AuthConnect from "authconnect-djs";
const {google} = gapi;

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

let logChannel = null;
let auth;
let scheduledJob;
const bot = new discord.Client();
bot.login(DISCORD_TOKEN);

registerBotListeners();

const onLinked = async (guildId, authData) => {
    await logMessage("✅ Google Calendar has been authorized!");
};

function registerBotListeners(){
    console.log("# Initializing...");
    bot.on("ready", async () => {
        console.log("## Connected to Discord...");
        auth = new AuthConnect({
            google: {
                clientId: GOOGLE_CLIENT_ID,
                clientSecret: GOOGLE_CLIENT_SECRET
            }
        });
        auth.useDefaultDataHandlers("./auth-data.json");
        auth.setLinkedCallback(onLinked);

        scheduleJob();

        console.log("### Ready!");
    });
    bot.on("message", onMessage);
}


async function onMessage(msg){
    if(msg.guild.id !== GUILD_ID) return;
    if(msg.cleanContent === "login"){
        if(!msg.member.permissions.has("ADMINISTRATOR")) {
            msg.channel.send("❌ Only administrators can use this command.");
            return;
        }
        const scopes = SCOPES.join(" ");
        const url = await auth.generateAuthURL("google", msg.guild.id, scopes);
        await msg.member.createDM();
        await msg.member.send(`Please log in to Google Calendar by clicking the link below.\n${url}`);
        await msg.channel.send(`I've DMed you a link to log in!`);
    }
    if(msg.cleanContent == "forcerun"){
        onScheduleRun();
        return;
    }
}

async function logMessage(message){
    if(logChannel == null) logChannel = await bot.channels.fetch(LOGGING_CHANNEL);
    await logChannel.send(message);
}

function scheduleJob(){
    scheduledJob = schedule.scheduleJob(CRON_SCHEDULE, () => {
        onScheduleRun();
    });
}

async function onScheduleRun(){
    if(!auth.isGuildLoggedIn("google", GUILD_ID)){
        await logMessage("❌ Google Calendar has not been authorized! Type `login` to authorize.");
        return;
    }

    const googleAuthObject = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET); // bug: add third param called redirect uri
    googleAuthObject.setCredentials({
        access_token: await auth.getAccessToken("google", GUILD_ID),
        refresh_token: await auth.getRefreshToken("google", GUILD_ID),
        scope: SCOPES.join(" "),
        token_type: "Bearer",
        expiry_date: (await auth.getAccessTokenExpiryDate("google", GUILD_ID)).getTime()
    });

    const calendar = google.calendar({version: "v3", auth: googleAuthObject});
    const start = new Date();
    start.setHours(24, 0, 0, 0); // Gets next midnight
    const endTime = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59);
    const calendarPromises = CALENDAR_IDS.map((cal) => {
        return new Promise((resolve, reject) => {
            calendar.events.list({
                calendarId: cal,
                timeMin: start.toISOString(),
                timeMax: endTime.toISOString(),
                maxResults: 50,
                singleEvents: true,
                orderBy: "startTime",
            }).then(list => {
                resolve(list);
            }, e => {
                console.error(e);
                reject(e);
            });
        });
    });

    const events = (await Promise.allSettled(calendarPromises))
        .filter(i => i.status == "fulfilled")
        .map(i => i.value.data.items)
        .flat()
        .map(i => {
            return {
                name: i.summary,
                allDay: i.start.dateTime == null,
                start: (i.start.dateTime == null) ? moment(i.start.date) : moment(i.start.dateTime),
                end: (i.end.dateTime == null) ? moment(i.end.date) : moment(i.end.dateTime),
                location: i.location,
                id: i.id
            };
        });
    let msgPromises = [];
    for(const name of Object.keys(REMINDERS)){
        const event = events.find(i => i.name == name);
        if(event == undefined) continue;
        msgPromises.push(logMessage(REMINDERS[name]));
    }
    await Promise.allSettled(msgPromises);
}