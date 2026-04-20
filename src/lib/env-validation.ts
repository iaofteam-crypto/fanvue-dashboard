/**
 * @module env-validation
 * Runtime environment variable validation for Vercel deployments.
 *
 * Validates required env vars on startup (not build time) so that
 * Vercel builds succeed even in CI without real secrets.
 * Logs warnings for missing optional vars.
 *
 * @example
 * import { validateEnv } from '@/lib/env-validation';
 * validateEnv();
 */

interface EnvVarSpec {
  name: string;
  required: boolean;
  description: string;
  defaultValue?: string;
}

/** Environment variable specifications for the Fanvue dashboard. */
const ENV_SPECS: readonly EnvVarSpec[] = [
  {
    name: 'FANVUE_CLIENT_ID',
    required: false,
    description: 'Fanvue OAuth client ID',
  },
  {
    name: 'FANVUE_CLIENT_SECRET',
    required: false,
    description: 'Fanvue OAuth client secret',
  },
  {
    name: 'FANVUE_REDIRECT_URI',
    required: false,
    description: 'OAuth callback URL',
    defaultValue: 'http://localhost:3000/api/fanvue/callback',
  },
  {
    name: 'FANVUE_WEBHOOK_SECRET',
    required: false,
    description: 'HMAC-SHA256 secret for Fanvue webhook verification',
  },
  {
    name: 'KV_REST_API_URL',
    required: false,
    description: 'Vercel KV REST API URL for persistent storage',
  },
  {
    name: 'KV_REST_API_TOKEN',
    required: false,
    description: 'Vercel KV REST API token',
  },
  {
    name: 'GITHUB_TOKEN',
    required: false,
    description: 'GitHub personal access token for repo browser',
  },
  {
    name: 'GITHUB_REPO',
    required: false,
    description: 'GitHub repo in owner/repo format for repo browser',
  },
] as const;

interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
  present: string[];
}

/**
 * Validates all configured environment variables.
 * Returns a result object with validation status.
 * Logs warnings to console for missing optional vars.
 */
export function validateEnv(): EnvValidationResult {
  const result: EnvValidationResult = {
    valid: true,
    missing: [],
    warnings: [],
    present: [],
  };

  for (const spec of ENV_SPECS) {
    const value = process.env[spec.name];
    const hasValue = value !== undefined && value.length > 0;

    if (hasValue) {
      result.present.push(spec.name);
    } else if (spec.required) {
      result.missing.push(spec.name);
      result.valid = false;
    } else if (!spec.defaultValue) {
      result.warnings.push(
        `Optional env var ${spec.name} not set: ${spec.description}`
      );
    }
  }

  // Log warnings only in development
  if (process.env.NODE_ENV === 'development' && result.warnings.length > 0) {
    for (const warning of result.warnings) {
      console.warn(`[env] ${warning}`);
    }
  }

  // Log missing required vars
  if (result.missing.length > 0) {
    for (const name of result.missing) {
      console.error(`[env] REQUIRED env var ${name} is not set.`);
    }
  }

  return result;
}

/**
 * Returns the value of an environment variable or the default.
 * Returns empty string if neither exists.
 */
export function getEnv(name: string, fallback = ''): string {
  return process.env[name] || fallback;
}

/**
 * Returns a boolean env var (true/1/yes).
 * Useful for feature flags.
 */
export function getEnvBool(name: string, defaultValue = false): boolean {
  const value = process.env[name]?.toLowerCase();
  if (!value) return defaultValue;
  return ['true', '1', 'yes'].includes(value);
}

/**
 * Returns an array of all environment variable names that are set,
 * filtered by an optional prefix.
 */
export function getEnvKeys(prefix?: string): string[] {
  return Object.keys(process.env).filter(
    (key) => !prefix || key.startsWith(prefix)
  );
}
