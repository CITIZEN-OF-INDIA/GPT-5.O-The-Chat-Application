// web/src/db/indexedDB.ts
import { openDB, DBSchema, IDBPDatabase } from "idb";
import type { Message } from "../../../../packages/shared-types/message";
import type { ChatID } from "../../../../packages/shared-types/chat";

export interface ChatDB {
  id: ChatID; // always string
  participants: { id: string; username: string }[];
  lastMessage?: Message;
  updatedAt: number;
}

interface MetaDB {
  key: string;
  value: any;
}

interface AppDB extends DBSchema {
  chats: {
    key: string;
    value: ChatDB;
  };
  messages: {
    key: string;
    value: Message;
    indexes: {
      "by-chat": string;
      "by-status": string;
      "by-createdAt": number;
      "by-chat-createdAt": [string, number];
    };
  };
  meta: {
    key: string;
    value: MetaDB;
  };
}

// 🔑 IMPORTANT: cache the PROMISE, not the DB
let dbPromise: Promise<IDBPDatabase<AppDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<AppDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AppDB>("chat-app-db", 2, {
      upgrade(database, _oldVersion, _newVersion, transaction) {
        // Chats
        if (!database.objectStoreNames.contains("chats")) {
          database.createObjectStore("chats", { keyPath: "id" });
        }

        // Messages
        if (!database.objectStoreNames.contains("messages")) {
          const store = database.createObjectStore("messages", {
            keyPath: "id",
          });
          store.createIndex("by-chat", "chatId");
          store.createIndex("by-status", "status");
          store.createIndex("by-createdAt", "createdAt");
          store.createIndex("by-chat-createdAt", ["chatId", "createdAt"]);
        } else {
          const store = transaction.objectStore("messages");
          if (!store.indexNames.contains("by-chat-createdAt")) {
            store.createIndex("by-chat-createdAt", ["chatId", "createdAt"]);
          }
        }

        // Meta
        if (!database.objectStoreNames.contains("meta")) {
          database.createObjectStore("meta", { keyPath: "key" });
        }
      },
    }).then((db) => {
      // 🔥 CRITICAL: if DB closes, reset promise
      db.onclose = () => {
        dbPromise = null;
      };
      return db;
    });
  }

  return dbPromise;
}
