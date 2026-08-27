export const REQUIRED_SERVER_SECRETS = ["OPENAI_API_KEY", "PEXELS_API_KEY"] as const;
export type ProductionEnvironmentReport = { mode: string; ready: boolean; required: readonly { name: string; present: boolean }[]; accidentalClientExposure: readonly string[] };
export const validateProductionEnvironment = (env: NodeJS.ProcessEnv = process.env): ProductionEnvironmentReport => {
  const required = REQUIRED_SERVER_SECRETS.map((name) => ({ name, present: Boolean(env[name]?.trim()) }));
  const accidentalClientExposure = REQUIRED_SERVER_SECRETS.map((name) => `NEXT_PUBLIC_${name}`).filter((name) => Boolean(env[name]?.trim()));
  return { mode: env.NODE_ENV ?? "unknown", ready: required.every((entry) => entry.present) && accidentalClientExposure.length === 0, required, accidentalClientExposure };
};
