// Sends the due community messages. Call it once a minute from an external scheduler, with Authorization: Bearer <CRON_SECRET>.
import { getApp } from "@/bot-serverless/instance.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  return getApp().deliver(request);
}
