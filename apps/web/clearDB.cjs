// clearDB.cjs
const { openDB } = require("idb");

async function clearIndexedDB() {
  const db = await openDB("chat-app-db", 1);
  const stores = ["chats", "messages", "meta"];

  for (const store of stores) {
    await db.clear(store);
  }

  console.log("✅ IndexedDB cleared successfully!");
  process.exit(0);
}

clearIndexedDB().catch((err) => {
  console.error("❌ Failed to clear IndexedDB:", err);
  process.exit(1);
});
