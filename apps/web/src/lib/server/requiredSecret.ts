export function requireSecret(envName: string, testFallback: string): string {
  const configured = process.env[envName]?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "test") return testFallback;
  throw new Error(`${envName} must be configured outside test environments.`);
}
