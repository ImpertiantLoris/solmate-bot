import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// RPC Connection
const connection = new Connection(process.env.RPC_URL || "https://api.devnet.solana.com", "confirmed");

// ✅ Health Route
app.get("/", (req, res) => {
  res.send("🟢 SolMate Blink Server is LIVE on Railway!");
});

// ✅ STEP 1 (GET) — Wallet discovers the SEND action
app.get("/actions/send", async (req, res) => {
  try {
    const { to, amount } = req.query;

    const base = process.env.BLINK_SERVER_URL;
    const label = amount && to ? `Send ${amount} SOL` : "Send SOL";

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");

    return res.status(200).json({
      title: "Send SOL",
      description: "Transfer SOL using a Solana Blink",
      icon: "https://cryptologos.cc/logos/solana-sol-logo.png",
      links: {
        actions: [
          {
            label,
            href: `${base}/actions/send?to=${encodeURIComponent(to || "")}&amount=${encodeURIComponent(amount || "")}`,
          },
        ],
      },
      input: [
        { name: "to", label: "Recipient Address", required: true },
        { name: "amount", label: "Amount (SOL)", required: true },
      ],
    });
  } catch (err) {
    console.error("GET /actions/send error", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ✅ STEP 2 (POST) — Wallet sends its public key & we return unsigned TX
app.post("/actions/send", async (req, res) => {
  try {
    const { to, amount } = req.query;
    const { account } = req.body; // wallet address of the sender

    if (!to || !amount || !account) {
      return res.status(400).json({ error: "Missing to, amount, or account" });
    }

    const fromPubkey = new PublicKey(account);
    const toPubkey = new PublicKey(to);
    const lamports = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);

    const ix = SystemProgram.transfer({
      fromPubkey,
      toPubkey,
      lamports,
    });

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

    const tx = new Transaction({
      feePayer: fromPubkey,
      recentBlockhash: blockhash,
    }).add(ix);

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    const b64 = Buffer.from(serialized).toString("base64");

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");

    return res.status(200).json({
      transaction: b64,
      message: `Send ${amount} SOL to ${to}`,
      lastValidBlockHeight,
    });
  } catch (err) {
    console.error("POST /actions/send error", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ✅ Wallet Discovery Route (.well-known)
app.get("/.well-known/solana/actions.json", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({
    name: "SolMate Blink Server",
    description: "Execute Solana transfers from Telegram via Blinks",
    icon: "https://cryptologos.cc/logos/solana-sol-logo.png",
    actions: [
      {
        type: "transfer",
        title: "Send SOL",
        url: `${process.env.BLINK_SERVER_URL}/actions/send`,
      },
    ],
  });
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`⚡ SolMate Blink Server running on port ${PORT}`)
);
