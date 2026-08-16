export const ROLE_KEY_CONFLICT_ERROR =
  "A role with this generated key already exists. Choose a different role name.";
export const ROLE_KEY_EMPTY_ERROR = "Role name must include at least one Latin letter or number.";

const ROLE_KEY_MAX_LENGTH = 50;

export function deriveRoleKey(name: string): string {
  const key = name
    .trim()
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/[ø]/g, "o")
    .replace(/[ł]/g, "l")
    .replace(/[đð]/g, "d")
    .replace(/þ/g, "th")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, ROLE_KEY_MAX_LENGTH)
    .replace(/\.+$/g, "");

  if (!key) throw new Error(ROLE_KEY_EMPTY_ERROR);
  return key;
}
