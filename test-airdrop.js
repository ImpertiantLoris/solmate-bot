import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import dotenv from "dotenv";
dotenv.config();

const connection = new Connection(process.env.RPC_URL || "https://api.devnet.solana.com", "confirmed");

// Replace this with your wallet public key
const walletAddress = "AZCbpdwmGA1Knik5a5Mn1ervK7gr7VQbAS1Ke1fXe3jq"; // paste full key here

async function airdrop() {
  try {
    console.log("💸 Requesting 1 SOL airdrop...");
    const signature = await connection.requestAirdrop(new PublicKey(walletAddress), 1 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(signature, "confirmed");

    const balance = await connection.getBalance(new PublicKey(walletAddress));
    console.log(`✅ Airdrop complete! New balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  } catch (err) {
    console.error("❌ Airdrop failed:", err);
  }
}

airdrop();
