const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();
const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const fs = require("fs");
const ytdl = require("ytdl-core");
const ffmpeg = require("fluent-ffmpeg");

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "Welcome user, enter Youtube Link to get your Video Downloaded"
  );
});

bot.onText(/\/info (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const videoUrl = match[1];

  try {
    const info = await ytdl.getInfo(videoUrl);
    const videoDetails = `
      Title: ${info.videoDetails.title}
      Duration: ${formatDuration(info.videoDetails.lengthSeconds)}
      Formats: ${info.formats.length}
    `;
    bot.sendMessage(chatId, videoDetails);
  } catch (error) {
    console.error("Error fetching video info: ", error);
    bot.sendMessage(chatId, "An error occurred while fetching video info");
  }
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  if (messageText.includes("youtube.com")) {
    try {
      const videoId = ytdl.getURLVideoID(messageText);
      const downloadLink = `https://www.youtube.com/watch?v=${videoId}`;

      const mp4DownloadPath = `./video_${videoId}.mp4`;
      await downloadVideo(downloadLink, mp4DownloadPath, {
        filter: (format) => format.container === "mp4",
        quality: "highest",
      });

      const mp3DownloadPath = `./audio_${videoId}.mp3`;
      await downloadVideo(downloadLink, mp3DownloadPath, {
        filter: (format) => format.container === "mp4",
        quality: "highestaudio",
      });

      const mergedFilePath = `./merged_${videoId}.mp4`;
      await mergeVideoAndAudio(mp4DownloadPath, mp3DownloadPath, mergedFilePath);

      const videoData = fs.readFileSync(mergedFilePath);

      bot.sendVideo(chatId, videoData, {
        caption: "Enjoy your video:)",
      });

      fs.unlinkSync(mp4DownloadPath);
      fs.unlinkSync(mp3DownloadPath);
      fs.unlinkSync(mergedFilePath);
    } catch (error) {
      console.error("Error processing the video: ", error);
      bot.sendMessage(chatId, "An error occurred while processing the video");
    }
  }
});

async function downloadVideo(link, savePath, options) {
  return new Promise((resolve, reject) => {
    const downloadStream = ytdl(link, options);
    const fileStream = fs.createWriteStream(savePath);

    downloadStream.pipe(fileStream);

    downloadStream.on("end", resolve);
    downloadStream.on("error", reject);
  });
}

async function mergeVideoAndAudio(videoPath, audioPath, mergedPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .output(mergedPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${minutes}m ${secs}s`;
}
