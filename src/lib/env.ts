export function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;

  if (!value) {
    throw new Error(
      "DATABASE_URL is required. Add a PostgreSQL connection string to .env.local.",
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    !url.username ||
    !url.password
  ) {
    throw new Error(
      "DATABASE_URL must include a PostgreSQL protocol, host, username and password.",
    );
  }

  return value;
}

export function validateEnvironment(): void {
  getDatabaseUrl();
}
