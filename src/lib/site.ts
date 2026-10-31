type Environment = Record<string, string | undefined>;

function platformOrigin(host: string | undefined): string | undefined {
  if (!host) return undefined;
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(host) || !host.includes(".")) {
    throw new Error("The Vercel deployment hostname is invalid.");
  }
  return new URL(`https://${host}`).origin;
}

export function appOrigin(env: Environment = process.env): string {
  if (env.BETTER_AUTH_URL) {
    const url = new URL(env.BETTER_AUTH_URL);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
      throw new Error("BETTER_AUTH_URL must be a website origin without credentials, a path or query parameters.");
    }
    if (url.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
      throw new Error("BETTER_AUTH_URL requires HTTPS outside local development.");
    }
    return url.origin;
  }
  if (env.VERCEL === "1") {
    const origin = platformOrigin(env.VERCEL_PROJECT_PRODUCTION_URL) ?? platformOrigin(env.VERCEL_URL);
    if (!origin) throw new Error("The Vercel website origin is unavailable; configure BETTER_AUTH_URL.");
    return origin;
  }
  return "http://localhost:3000";
}

export function trustedOrigins(env: Environment = process.env): string[] {
  const origins = [appOrigin(env)];
  if (env.VERCEL === "1") {
    for (const host of [env.VERCEL_URL, env.VERCEL_BRANCH_URL]) {
      const origin = platformOrigin(host);
      if (origin) origins.push(origin);
    }
  }
  return [...new Set(origins)];
}
