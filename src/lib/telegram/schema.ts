import { z } from "zod";

/** A Telegram user id: a positive integer of 5 to 20 digits. Anything else is rejected before any lookup. */
export const telegramIdSchema = z.string().regex(/^[1-9][0-9]{4,19}$/, "must be a Telegram user id");

/** A chat id: a Telegram user id (positive) or a group id (negative). */
export const chatIdSchema = z.string().regex(/^-?[0-9]{1,20}$/, "must be a Telegram chat id");
