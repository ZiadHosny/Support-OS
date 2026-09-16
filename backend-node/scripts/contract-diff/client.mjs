/**
 * Token acquisition, health preflight, and a timed `fetch` wrapper — the
 * harness is a black-box HTTP client against two already-running services,
 * never an in-process test.
 */

const REQUEST_TIMEOUT_MS = 10_000;
const HEALTH_TIMEOUT_MS = 3_000;

export function getConfig() {
  return {
    djangoBaseUrl: (
      process.env.DJANGO_BASE_URL ?? 'http://127.0.0.1:8000'
    ).replace(/\/$/, ''),
    nodeBaseUrl: (process.env.NODE_BASE_URL ?? 'http://127.0.0.1:8002').replace(
      /\/$/,
      '',
    ),
    email: process.env.DIFF_EMAIL ?? 'admin@supportos.local',
    password: process.env.DIFF_PASSWORD ?? 'Passw0rd!2026',
  };
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * `/api/health/` is the preflight probe precisely because both services
 * already answer it identically and it is not in the contract — a failure
 * here can only be "the service is not running", never a contract mismatch.
 */
export async function preflight({ djangoBaseUrl, nodeBaseUrl }) {
  const targets = [
    {
      name: 'Django',
      baseUrl: djangoBaseUrl,
      startCmd: 'python manage.py runserver (from backend/)',
    },
    {
      name: 'Node',
      baseUrl: nodeBaseUrl,
      startCmd: 'npm run dev (from backend-node/), or node dist/main.js',
    },
  ];

  const problems = [];
  for (const target of targets) {
    try {
      const response = await fetchWithTimeout(
        `${target.baseUrl}/api/health/`,
        { headers: { Accept: 'application/json' } },
        HEALTH_TIMEOUT_MS,
      );
      if (!response.ok && response.status !== 503) {
        problems.push(
          `${target.name} (${target.baseUrl}) answered /api/health/ with HTTP ${response.status}`,
        );
      }
    } catch (error) {
      problems.push(
        `${target.name} is not reachable at ${target.baseUrl}/api/health/ (${error.message}). ` +
          `Start it with: ${target.startCmd}`,
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Preflight failed:\n` + problems.map((p) => `  - ${p}`).join('\n'),
    );
  }
}

/** Acquires a JWT access token from Django. Both services receive it unchanged. */
export async function acquireToken({ djangoBaseUrl, email, password }) {
  const response = await fetchWithTimeout(
    `${djangoBaseUrl}/api/auth/token/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email, password }),
    },
    REQUEST_TIMEOUT_MS,
  );

  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.data?.access) {
    throw new Error(
      `Could not acquire a token from ${djangoBaseUrl}/api/auth/token/ for ${email} ` +
        `(HTTP ${response.status}). Check DIFF_EMAIL/DIFF_PASSWORD and that the seed data exists.`,
    );
  }
  return body.data.access;
}

/**
 * One HTTP call, normalised. Network-level failure (timeout, connection
 * refused, DNS) is distinct from a real HTTP response and is surfaced as
 * `{ networkError: <message> }` rather than a fabricated status code.
 */
async function send({ baseUrl, method, path, token, jsonBody }) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (jsonBody !== undefined) headers['Content-Type'] = 'application/json';

  try {
    const response = await fetchWithTimeout(
      `${baseUrl}${path}`,
      {
        method: method.toUpperCase(),
        headers,
        body: jsonBody !== undefined ? JSON.stringify(jsonBody) : undefined,
      },
      REQUEST_TIMEOUT_MS,
    );
    const text = await response.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = undefined; // non-JSON body — comparison treats this as its own mismatch
    }
    return { status: response.status, body: json, rawBody: text };
  } catch (error) {
    return { networkError: error.message };
  }
}

/**
 * `ApiClient` wraps one target (Django or Node) with its own token, and
 * re-acquires once on an unexpected 401 from DJANGO specifically — Django
 * is authenticated today, so a 401 there mid-run is a token expiry
 * (JWT_ACCESS_TOKEN_LIFETIME_MINUTES defaults to 15), not a real mismatch,
 * and reporting it as one would be a lie about port parity.
 */
export class ApiClient {
  constructor({ baseUrl, token, isDjango, reauth }) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.isDjango = isDjango;
    this.reauth = reauth;
  }

  async request(method, path, jsonBody) {
    let result = await send({
      baseUrl: this.baseUrl,
      method,
      path,
      token: this.token,
      jsonBody,
    });
    if (this.isDjango && result.status === 401 && this.reauth) {
      this.token = await this.reauth();
      result = await send({
        baseUrl: this.baseUrl,
        method,
        path,
        token: this.token,
        jsonBody,
      });
    }
    return result;
  }
}
