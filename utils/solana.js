// utils/solana.js
import dotenv from "dotenv";
import { Keypair, Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";

dotenv.config();

// Use RPC_URL from .env or fallback to Devnet
export const connection = new Connection(
  process.env.RPC_URL || "https://api.devnet.solana.com",
  "confirmed"
);

// ✅ Generate a new Solana wallet
export function createSolanaWallet() {
  const keypair = Keypair.generate();
  const publicKey = keypair.publicKey.toBase58();
  const privateKey = bs58.encode(keypair.secretKey);
  return { publicKey, privateKey };
}

// 💸 Fund wallet with 1 SOL on Devnet
export async function fundWallet(publicKeyString) {
  try {
    const publicKey = new PublicKey(publicKeyString);
    console.log("💸 Requesting 1 SOL from faucet...");
    const signature = await connection.requestAirdrop(publicKey, 1 * LAMPORTS_PER_SOL);
    console.log("⏳ Waiting for confirmation...");
    await connection.confirmTransaction(signature, "confirmed");
    const balance = await connection.getBalance(publicKey);
    console.log(`✅ Airdrop confirmed! Current balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    return true;
  } catch (err) {
    console.error("❌ Error funding wallet:", err);
    return false;
  }
}

// 🚀 Send SOL between wallets
export async function sendSol(fromPrivateKeyBase58, toPublicKeyString, amountSol) {
  if (!fromPrivateKeyBase58) throw new Error("Sender private key missing");
  if (!toPublicKeyString) throw new Error("Recipient address missing");
  if (!(amountSol > 0)) throw new Error("Amount must be greater than zero");

  const secretKey = bs58.decode(fromPrivateKeyBase58);
  const fromKeypair = Keypair.fromSecretKey(secretKey);
  const toPubkey = new PublicKey(toPublicKeyString);
  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  // fee cushion check
  const fromBalance = await connection.getBalance(fromKeypair.publicKey);
  const feeEstimateLamports = 5000;
  if (fromBalance < lamports + feeEstimateLamports) {
    throw new Error("Insufficient funds");
  }

  const ix = SystemProgram.transfer({
    fromPubkey: fromKeypair.publicKey,
    toPubkey,
    lamports,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = fromKeypair.publicKey;

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;

  const sig = await connection.sendTransaction(tx, [fromKeypair], { skipPreflight: false });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");

  console.log(`✅ Sent ${amountSol} SOL | Signature: ${sig}`);
  return sig;
}
