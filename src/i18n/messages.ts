import en from "../../messages/en.json";
import es from "../../messages/es.json";
import type { Locale } from "./config";

export type AppMessages = typeof en;

const messages: Record<Locale, AppMessages> = { en, es };

export function getMessages(locale: Locale): AppMessages {
  return messages[locale];
}
