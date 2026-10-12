export const REQUIRED_SERVER_SECRETS = ["OPENAI_API_KEY", "PEXELS_API_KEY"] as const;
export const REQUIRED_PRODUCTION_PUBLIC_CONFIG = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;
export type ProductionEnvironmentReport = { mode: string; ready: boolean; required: readonly { name: string; present: boolean }[]; publicRequired: readonly { name: string; present: boolean }[]; accidentalClientExposure: readonly string[]; betaTestModeEnabled: boolean };
export const validateProductionEnvironment = (env: NodeJS.ProcessEnv = process.env): ProductionEnvironmentReport => {
  const required = REQUIRED_SERVER_SECRETS.map((name) => ({ name, present: Boolean(env[name]?.trim()) }));
  const accidentalClientExposure = REQUIRED_SERVER_SECRETS.map((name) => `NEXT_PUBLIC_${name}`).filter((name) => Boolean(env[name]?.trim()));
  const isProduction = env.NODE_ENV === "production";
  const publicRequired = REQUIRED_PRODUCTION_PUBLIC_CONFIG.map((name) => ({ name, present: Boolean(env[name]?.trim()) }));
  const betaTestModeEnabled = env.NEXT_PUBLIC_BETA_TEST_MODE === "true";
  return { mode: env.NODE_ENV ?? "unknown", ready: required.every((entry) => entry.present) && accidentalClientExposure.length === 0 && (!isProduction || (publicRequired.every((entry) => entry.present) && !betaTestModeEnabled)), required, publicRequired, accidentalClientExposure, betaTestModeEnabled };
};
