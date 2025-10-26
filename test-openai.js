import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function test() {
  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hey, this is Solmate Bot!" }]
    });
    console.log("✅ OpenAI Connected!\nResponse:", res.choices[0].message.content);
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

test();
