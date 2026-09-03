export interface ProfileUser {
  id: string;
  name: string;
  email: string;
  username: string | null;
  image: string | null;
  locale: "en" | "es" | null;
}
