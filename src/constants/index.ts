export const APP_NAME = "oi-nextjs";
export const API_ROUTES = {
  AUTH: {
    LOGIN: "/api/auth/login",
    REGISTER: "/api/auth/register",
    LOGOUT: "/api/auth/logout",
    SESSION: "/api/auth/session",
  },
} as const;
