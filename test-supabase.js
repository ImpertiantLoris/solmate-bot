import { supabase } from "./database/supabase.js";
import dotenv from "dotenv";
dotenv.config();

async function testDB() {
  try {
    const { data, error } = await supabase.from("users").select("*");
    if (error) throw error;
    console.log("✅ Supabase Connected! Rows fetched:", data.length);
  } catch (err) {
    console.error("❌ Error connecting to Supabase:", err.message);
  }
}

testDB();
