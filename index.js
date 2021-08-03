import fs from "fs";
import discord from "discord.js";
import schedule from "node-schedule";
import gapi from "googleapis";
import { DISCORD_TOKEN, LOGGING_CHANNEL } from "./config.js";
const {google} = gapi;

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

let auth = null;
let credentials = null;
let accessTokenObtained = false;
let logChannel = null;
const bot = new discord.Client();
bot.login(DISCORD_TOKEN);

registerBotListeners();

function loadCredentials(){
    return new Promise((resolve, reject) => {
        fs.readFile("google_credentials.json", (err, data) => {
            if(err){
                console.error(err);
                reject(err);
                return;
            }
            credentials = JSON.parse(data);
            resolve();
            return;
        });
    });
}

function tryAuthorize(){
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    return new Promise((resolve, reject) => {
        fs.readFile("google_token.json", (err, token) => {
            if (err){
                console.log("Access token has not been obtained yet!");
                reject(err);
                return;
            }
            auth.setCredentials(JSON.parse(token));
            accessTokenObtained = true;
            resolve();
        });
    });
}

function getAuthURL(){
    return auth.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES
    });
}

async function completeAuthFlow(code){
    let token = (await auth.getToken(code)).tokens;
    auth.setCredentials(token);
    accessTokenObtained = true;
    await new Promise((resolve, reject) => {
        fs.writeFile("google_token.json", JSON.stringify(token), (err) => {
            if(err){
                reject(err);
                return;
            }
            console.log("Authorized! Saved new token to disk.");
            resolve();
        });
    });
}

function registerBotListeners(){
    bot.on("ready", async () => {
        console.log("Connected to Discord!");
        loadCredentials().then(() => {
            tryAuthorize().then(() => {
                console.log("Logged in to Calendar!");
            }, () => {
                logMessage(`Google Calendar is not authorized! Navigate to the URL:\n<${getAuthURL()}>\nand type \`link paste-code-here\`.`);
            });
        });
    });
    bot.on("message", onMessage);
}


async function onMessage(msg){
    if(msg.cleanContent.startsWith("link")){
        const split = msg.cleanContent.split(" ");
        if(split.length < 2){
            msg.react("❌");
            return;
        }
        const code = split[1];
        try {
            await completeAuthFlow(code);
        } catch(e) {
            console.error(e);
            msg.react("❌");
            return;
        }
        msg.react("✅");
        return;
    }
}

async function logMessage(message){
    if(logChannel == null) logChannel = await bot.channels.fetch(LOGGING_CHANNEL);
    await logChannel.send(message);
}