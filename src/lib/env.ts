import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_FIREBASE_API_KEY: optionalString,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: optionalString,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: optionalString,
  NEXT_PUBLIC_FIREBASE_APP_ID: optionalString,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: optionalString,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: optionalString,
  FIREBASE_ADMIN_ENABLED: z.enum(["true", "false"]).default("false"),
  FIREBASE_PROJECT_ID: optionalString,
  FIREBASE_CLIENT_EMAIL: optionalString,
  FIREBASE_PRIVATE_KEY: optionalString,
  FIREBASE_SESSION_COOKIE_NAME: z.string().min(1).default("gold-intel-firebase-session"),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  OPENAI_API_KEY: optionalString,
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  ALPHA_VANTAGE_API_KEY: optionalString,
  FRED_API_KEY: optionalString,
  ESTAT_APP_ID: optionalString,
  TRADING_ECONOMICS_API_KEY: optionalString,
  FINNHUB_API_KEY: optionalString,
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_ENABLE_DEMO_MODE: z.enum(["true", "false"]).default("true"),
  APP_DEMO_EMAIL: z.string().email().default("demo@goldintel.local"),
  APP_DEMO_PASSWORD: z.string().min(8).default("gold-demo"),
  APP_DEMO_SESSION_SECRET: z.string().min(8).default("gold-intel-demo-session"),
  APP_REFRESH_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  APP_SYNC_SECRET: optionalString,
  MT5_CONNECTOR_SECRET: optionalString,
  MT5_SYNC_LIVE_SECONDS: z.coerce.number().int().positive().default(30),
  MT5_SYNC_OFFLINE_SECONDS: z.coerce.number().int().positive().default(300),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;

export const isSupabaseConfigured = Boolean(
  env.NEXT_PUBLIC_SUPABASE_URL &&
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    env.SUPABASE_SERVICE_ROLE_KEY,
);

export const isFirebaseWebConfigured = Boolean(
  env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    env.NEXT_PUBLIC_FIREBASE_APP_ID,
);

export const hasExplicitFirebaseAdminCredentials = Boolean(
  (env.FIREBASE_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) &&
    env.FIREBASE_CLIENT_EMAIL &&
    env.FIREBASE_PRIVATE_KEY,
);

export const isFirebaseAdminConfigured = Boolean(
  env.FIREBASE_ADMIN_ENABLED === "true" || hasExplicitFirebaseAdminCredentials,
);

export const isFirebaseConfigured = isFirebaseWebConfigured && isFirebaseAdminConfigured;

export const isDemoModeEnabled =
  env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true" ||
  (!isFirebaseConfigured && !isSupabaseConfigured);

export const hasLiveMarketConnectors = Boolean(
  env.ALPHA_VANTAGE_API_KEY && env.FRED_API_KEY,
);

export const hasOpenAI = Boolean(env.OPENAI_API_KEY);

export const hasEconomicCalendarConnector = Boolean(
  env.TRADING_ECONOMICS_API_KEY || env.FINNHUB_API_KEY,
);
