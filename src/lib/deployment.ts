export function shouldPrepareDeploymentDatabase(env: Record<string, string | undefined>): boolean {
  return env.VERCEL === "1" && env.VERCEL_ENV === "production" && env.SKIP_DEPLOY_DB_SETUP !== "1";
}
