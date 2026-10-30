import { describe, expect, it, vi } from "vitest";
import { chatKey, decryptChatId, encryptChatId } from "@/lib/telegram/chat-cipher";

const KEY_A = Buffer.alloc(32, 1);
const KEY_B = Buffer.alloc(32, 2);

describe("chat id encryption", () => {
  it("round-trips, and the stored form does not contain the chat id", () => {
    const stored = encryptChatId(KEY_A, "-1001234567890");
    expect(stored).not.toContain("1001234567890");
    expect(decryptChatId(KEY_A, stored)).toBe("-1001234567890");
  });

  it("uses a fresh nonce each time, so equal chats do not produce equal ciphertexts", () => {
    expect(encryptChatId(KEY_A, "42")).not.toBe(encryptChatId(KEY_A, "42"));
  });

  it("refuses another key", () => {
    expect(() => decryptChatId(KEY_B, encryptChatId(KEY_A, "42"))).toThrow();
  });

  it("refuses a tampered value", () => {
    const parts = encryptChatId(KEY_A, "42").split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptChatId(KEY_A, parts.join("."))).toThrow();
  });

  it("refuses a malformed value", () => {
    expect(() => decryptChatId(KEY_A, "not-a-cipher")).toThrow();
  });
});

describe("chatKey", () => {
  it("accepts 32 base64 bytes", () => {
    expect(chatKey({ TELEGRAM_CHAT_KEY: Buffer.alloc(32, 9).toString("base64") })).toHaveLength(32);
  });

  it("refuses a missing or wrong-length key, with a message that names no value", () => {
    expect(() => chatKey({})).toThrow(expect.objectContaining({ status: 503 }));
    expect(() => chatKey({ TELEGRAM_CHAT_KEY: "c2hvcnQ=" })).toThrow(expect.objectContaining({ status: 503 }));
    try {
      chatKey({ TELEGRAM_CHAT_KEY: "c2hvcnQ=" });
    } catch (e) {
      expect(JSON.stringify(e)).not.toContain("c2hvcnQ=");
    }
  });
});
void vi;
