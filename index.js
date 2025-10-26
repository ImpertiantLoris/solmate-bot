// index.js
import dotenv from "dotenv";
import { Telegraf } from "telegraf";
import express from "express";
import { createSolanaWallet, fundWallet } from "./utils/solana.js";
import { supabase } from "./database/supabase.js";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
app.use(express.json());

// ✅ HEALTH CHECK
app.get("/", (_, res) => res.send("🟢 SolMate Bot Webhook Alive"));

// ✅ /start
bot.start(async (ctx) => {
  const telegram_id = ctx.from.id;
  const username = ctx.from.first_name || ctx.from.username || "Unknown";

  try {
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", telegram_id)
      .maybeSingle();

    if (existingUser?.wallet_public_key) {
      return ctx.reply(
        `Hey ${username}, welcome back! 👋\n\nYour wallet:\n${existingUser.wallet_public_key}`
      );
    }

    const { publicKey, privateKey } = createSolanaWallet();
    const { error } = await supabase.from("users").upsert(
      {
        telegram_id,
        username,
        wallet_public_key: publicKey,
        wallet_private_key: privateKey,
      },
      { onConflict: "telegram_id" }
    );

    if (error) return ctx.reply("❌ Error saving wallet, try again.");

    await ctx.reply(
      `Hey ${username}, your Solana wallet is ready! 🪙\n\nPublic Key:\n${publicKey}\n\nRequesting 1 SOL...`
    );

    const funded = await fundWallet(publicKey);
    return funded
      ? ctx.reply("✅ Wallet funded with 1 SOL on Devnet!")
      : ctx.reply("⚠️ Faucet might be down, try later.");
  } catch {
    return ctx.reply("❌ Error while creating wallet.");
  }
});

// ✅ /balance
bot.command("balance", async (ctx) => {
  try {
    const telegram_id = ctx.from.id;
    const { data: user } = await supabase
      .from("users")
      .select("wallet_public_key")
      .eq("telegram_id", telegram_id)
      .maybeSingle();

    if (!user?.wallet_public_key)
      return ctx.reply("No wallet found. Run /start first.");

    const { connection } = await import("./utils/solana.js");
    const { LAMPORTS_PER_SOL, PublicKey } = await import("@solana/web3.js");
    const lamports = await connection.getBalance(new PublicKey(user.wallet_public_key));
    return ctx.reply(`💰 Balance: ${(lamports / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  } catch {
    return ctx.reply("❌ Could not fetch balance.");
  }
});

// ✅ /send
bot.command("send", async (ctx) => {
  try {
    const text = ctx.message.text.trim();
    const [_, amountStr, target] = text.split(/\s+/);

    if (!amountStr || !target)
      return ctx.reply("Usage: /send 0.01 <address or @username>");

    const amount = parseFloat(amountStr);
    if (!(amount > 0)) return ctx.reply("Enter a valid amount.");

    const telegram_id = ctx.from.id;
    const { data: me } = await supabase
      .from("users")
      .select("wallet_public_key, username")
      .eq("telegram_id", telegram_id)
      .single();

    if (!me) return ctx.reply("No wallet found. Run /start first.");

    let toAddress = target;
    if (target.startsWith("@")) {
      const handle = target.slice(1);
      const { data: other } = await supabase
        .from("users")
        .select("wallet_public_key")
        .eq("username", handle)
        .maybeSingle();
      if (!other?.wallet_public_key) return ctx.reply(`No wallet for @${handle}`);
      toAddress = other.wallet_public_key;
    }

    const blinkUrl = `${process.env.BLINK_SERVER_URL}/actions/send?to=${encodeURIComponent(toAddress)}&amount=${encodeURIComponent(amount)}`;
    return ctx.reply(`✨ Click to confirm:\n${blinkUrl}`, {
      disable_web_page_preview: true,
    });
  } catch {
    return ctx.reply("❌ Failed to create transaction.");
  }
});

// ✅ HELP
bot.help((ctx) =>
  ctx.reply("Commands:\n/start — Create wallet\n/balance — Check balance\n/send — Send SOL")
);

// ✅ WEBHOOK MODE
const WEBHOOK_URL = `${process.env.BLINK_SERVER_URL}/webhook`;
await bot.telegram.setWebhook(WEBHOOK_URL);

app.post("/webhook", (req, res) => bot.handleUpdate(req.body, res));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Webhook server running on ${PORT}`));
