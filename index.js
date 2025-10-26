// index.js
import dotenv from "dotenv";
import { Telegraf } from "telegraf";
import { createSolanaWallet, fundWallet } from "./utils/solana.js";
import { supabase } from "./database/supabase.js";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// 🚀 /start — Create wallet
bot.start(async (ctx) => {
  const telegram_id = ctx.from.id;
  const username = ctx.from.first_name || ctx.from.username || "Unknown";

  try {
    // 1️⃣ Check if user already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", telegram_id)
      .maybeSingle();

    // 2️⃣ If user already has a wallet
    if (existingUser && existingUser.wallet_public_key) {
      await ctx.reply(
        `Hey ${username}, welcome back! 👋\n\nYour wallet:\n${existingUser.wallet_public_key}`
      );
      return;
    }

    // 3️⃣ Otherwise, create new wallet
    const { publicKey, privateKey } = createSolanaWallet();

    // Save wallet to Supabase
    const { error } = await supabase.from("users").upsert(
      {
        telegram_id,
        username,
        wallet_public_key: publicKey,
        wallet_private_key: privateKey,
      },
      { onConflict: "telegram_id" }
    );

    if (error) {
      console.error("❌ Supabase insert error:", error);
      await ctx.reply(`Error saving wallet: ${error.message || "unknown error"} 😭`);
      return;
    }

    // 4️⃣ Attempt airdrop
    await ctx.reply(
      `Hey ${username}, your Solana wallet is ready! 🪙\n\nPublic Key:\n${publicKey}\n\nRequesting 1 SOL for you... 💸`
    );
    const funded = await fundWallet(publicKey);

    if (funded) {
      await ctx.reply("✅ Wallet funded successfully with 1 SOL on Devnet!");
    } else {
      await ctx.reply("⚠️ Couldn't fund wallet automatically — faucet might be down. Try again later.");
    }
  } catch (err) {
    console.error("❌ Error in /start:", err);
    await ctx.reply("Something went wrong while setting up your wallet 😭");
  }
});

// 💰 /balance — Check wallet balance
bot.command("balance", async (ctx) => {
  try {
    const telegram_id = ctx.from.id;
    const { data: user, error } = await supabase
      .from("users")
      .select("wallet_public_key")
      .eq("telegram_id", telegram_id)
      .maybeSingle();

    if (error || !user?.wallet_public_key) {
      await ctx.reply("No wallet found. Run /start first to create one.");
      return;
    }

    const { connection } = await import("./utils/solana.js");
    const { LAMPORTS_PER_SOL, PublicKey } = await import("@solana/web3.js");
    const balanceLamports = await connection.getBalance(new PublicKey(user.wallet_public_key));
    const balanceSol = balanceLamports / LAMPORTS_PER_SOL;

    await ctx.reply(`💰 Wallet Balance: ${balanceSol.toFixed(4)} SOL`);
  } catch (err) {
    console.error("❌ Error fetching balance:", err);
    await ctx.reply("Couldn't fetch balance. Try again later.");
  }
});

// 💸 /send <amount> <address or @username>
bot.command("send", async (ctx) => {
  try {
    const text = ctx.message.text.trim();
    const parts = text.split(/\s+/);

    if (parts.length < 3) {
      await ctx.reply("Usage: /send 0.01 <address or @username>");
      return;
    }

    const amount = parseFloat(parts[1]);
    const targetRaw = parts[2];

    if (!(amount > 0)) {
      await ctx.reply("Amount must be a positive number like 0.01");
      return;
    }

    // fetch sender wallet from supabase
    const telegram_id = ctx.from.id;
    const { data: me, error: meErr } = await supabase
      .from("users")
      .select("wallet_public_key, username")
      .eq("telegram_id", telegram_id)
      .single();

    if (meErr || !me) {
      await ctx.reply("No wallet found. Run /start first.");
      return;
    }

    // resolve recipient: either a base58 address or @username lookup
    let toAddress = targetRaw;
    if (targetRaw.startsWith("@")) {
      const handle = targetRaw.slice(1);
      const { data: other, error: otherErr } = await supabase
        .from("users")
        .select("wallet_public_key")
        .eq("username", handle)
        .maybeSingle();

      if (otherErr || !other?.wallet_public_key) {
        await ctx.reply(`Could not find a wallet for @${handle}`);
        return;
      }
      toAddress = other.wallet_public_key;
    }

    // ✅ Generate Blink link (new format — NO from=)
    const blinkUrl = `${process.env.BLINK_SERVER_URL}/actions/send?to=${encodeURIComponent(
      toAddress
    )}&amount=${encodeURIComponent(amount)}`;

    await ctx.reply(
      `✨ Transaction ready!\n\nClick below to confirm via Solana Blink:\n👉 ${blinkUrl}`,
      { disable_web_page_preview: true }
    );

  } catch (err) {
    console.error("send error:", err);
    const msg = err?.message || "Transaction failed";
    await ctx.reply(`❌ ${msg}`);
  }
});

bot.help((ctx) =>
  ctx.reply("Commands:\n/start — Create wallet\n/balance — Check SOL balance\n/send — Send SOL via Blink")
);

bot.launch();
console.log("✅ SolMate Bot is running...");
