require("dotenv").config();
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const bodyParser = require("body-parser");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;

// Replace this token with your actual Telegram Bot Token
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
bot
  .setWebHook(process.env.WEBHOOK_URL)
  .then((result) => {
    console.log("Webhook set successfully:", result);
  })
  .catch((error) => {
    console.error("Error setting webhook:", error);
  });
const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool
  .connect()
  .then((client) => {
    console.log("Database connected successfully.");

    // Create feedback table if it does not exist
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS feedbacks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    return client.query(createTableQuery).finally(() => {
      client.release(); // release the client back to the pool
    });
  })
  .then(() => {
    console.log("Feedback table checked/created successfully.");
  })
  .catch((err) => {
    console.error(
      "Error connecting to the database or creating table:",
      err.stack
    );
  });

// For parsing JSON payloads from Telegram
app.use(bodyParser.json());

// Define your webhook URL path
app.post("/tgwebhook", (req, res) => {
  const { message } = req.body;
  const chatId = message.chat.id;
  const msgText = message.text;

  if (msgText === "/start") {
    const opts = {
      reply_markup: JSON.stringify({
        keyboard: [["About Bot"], ["Search"], ["List of Sura"], ["Feedback"]],
        resize_keyboard: true,
      }),
    };
    bot.sendMessage(chatId, "Welcome!", opts);
  } else if (msgText === "About Bot") {
    bot.sendMessage(
      chatId,
      "This bot should help you listen to Quran. Contacts: @username1-owner, @username2-developer."
    );
  } else if (msgText === "Search") {
    bot.sendMessage(chatId, "Please type the name of the audio.");

    // Handle the search logic and send audio
  } else if (msgText === "List of Sura") {
    bot.sendMessage(chatId, "Wait for your audio...");
    // Handle the audio list and buttons
  } else if (msgText === "Feedback") {
    bot.sendMessage(chatId, "Please provide your feedback.");

    // Capture the next message from this user as feedback
    // Save it to your PostgreSQL database
    pool
      .query("INSERT INTO feedbacks(user_id, text) VALUES($1, $2)", [
        chatId,
        msgText,
      ])
      .then(() => {
        bot.sendMessage(chatId, "Feedback saved.");
      })
      .catch((err) => {
        bot.sendMessage(chatId, "An error occurred while saving feedback.");
        console.error(err);
      });
  }

  // Always respond with a 200 OK for the Telegram server
  res.status(200).end();
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
