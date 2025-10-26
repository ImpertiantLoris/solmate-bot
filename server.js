  // server.js
  import express from "express";
  import cors from "cors";
  import dotenv from "dotenv";
  import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";

  dotenv.config();

  const app = express();
  app.use(cors());
  app.use(express.json());

  const connection = new Connection(process.env.RPC_URL || "https://api.devnet.solana.com", "confirmed");

  // ✅ Default route
  app.get("/", (req, res) => {
    res.send("🟢 SolMate Blink Server running...");
  });

  // ✅ STEP 1 — GET metadata for Blink (wallet discovers the action)
  app.get("/actions/send", async (req, res) => {
    try {
      const { to, amount } = req.query;

      if (!to || !amount) {
        return res.status(400).json({ error: "Missing to or amount" });
      }

      const label = `Send ${amount} SOL`;
      const href = `${process.env.BLINK_SERVER_URL}/actions/send?to=${encodeURIComponent(to)}&amount=${encodeURIComponent(amount)}`;

      res.setHeader("Content-Type", "application/json");
      return res.status(200).json({
        title: "Send SOL",
        description: "Create a SOL transfer and sign it in your wallet",
        icon: "https://cryptologos.cc/logos/solana-sol-logo.png",
        links: {
          actions: [{ label, href }],
        },
      });
    } catch (err) {
      console.error("GET /actions/send error", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  // ✅ STEP 2 — POST builds unsigned transaction (wallet will sign)
  app.post("/actions/send", async (req, res) => {
    try {
      const { to, amount } = req.query;
      const { account } = req.body; // wallet public key of the sender

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

  // ✅ Discovery Route for wallets
  app.get("/.well-known/solana/action.json", (req, res) => {
    res.json({
      name: "SolMate Blink Server",
      description: "Execute Solana transfers from Telegram via BlinkVerse",
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
  app.listen(PORT, () => {
    console.log(`⚡ SolMate Blink Server running on port ${PORT}`);
  });
