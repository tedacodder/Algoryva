// Telegram webhook. Telegram sends every update here as a POST, with the webhook secret in a header that grammY checks.
import { getApp } from "@/bot-serverless/instance.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  return getApp().webhook(request);
}
