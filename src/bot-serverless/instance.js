// One bot per serverless instance, created on first use after the environment is validated. Reused across requests.
import { createApp } from "./app.js";

let instance;
export function getApp() {
  instance ??= createApp(process.env);
  return instance;
}
