import { getRequestConfig } from "next-intl/server";

import { getMessages } from "./messages";
import { getRequestLocale } from "./request-locale";

export default getRequestConfig(async () => {
  const locale = await getRequestLocale();
  return { locale, messages: getMessages(locale) };
});
