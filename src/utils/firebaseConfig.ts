export interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  oAuthClientId?: string;
  recaptchaSiteKey?: string;
}

export interface FirebaseEnvVars {
  VITE_FIREBASE_API_KEY?: string;
  VITE_FIREBASE_AUTH_DOMAIN?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_STORAGE_BUCKET?: string;
  VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  VITE_FIREBASE_APP_ID?: string;
  VITE_FIREBASE_MEASUREMENT_ID?: string;
  VITE_FIREBASE_DATABASE_ID?: string;
}

function cleanConfigValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const upper = trimmed.toUpperCase();
  if (
    upper.startsWith('YOUR_FIREBASE_') ||
    upper.startsWith('MY_FIREBASE_') ||
    trimmed === 'remixed-project-id'
  ) {
    return undefined;
  }
  return trimmed;
}

function normalizeCandidate(
  candidate: Partial<FirebaseAppletConfig> | null | undefined
): FirebaseAppletConfig | null {
  if (!candidate) return null;
  const apiKey = cleanConfigValue(candidate.apiKey);
  const authDomain = cleanConfigValue(candidate.authDomain);
  const projectId = cleanConfigValue(candidate.projectId);
  const appId = cleanConfigValue(candidate.appId);

  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    firestoreDatabaseId: cleanConfigValue(candidate.firestoreDatabaseId),
    storageBucket: cleanConfigValue(candidate.storageBucket),
    messagingSenderId: cleanConfigValue(candidate.messagingSenderId),
    measurementId: cleanConfigValue(candidate.measurementId),
    oAuthClientId: cleanConfigValue(candidate.oAuthClientId),
    recaptchaSiteKey: cleanConfigValue(candidate.recaptchaSiteKey),
  };
}

/**
 * Resolves Firebase configuration from either the local gitignored
 * `firebase-applet-config.json` (used in AI Studio / local dev) or Vite
 * environment variables (`VITE_FIREBASE_*`, used in GitHub Actions / Pages).
 * Returns null if neither source provides a complete non-placeholder config.
 */
export function resolveFirebaseConfig(
  localConfig?: Partial<FirebaseAppletConfig> | null,
  env?: FirebaseEnvVars | null
): FirebaseAppletConfig | null {
  const fromLocal = normalizeCandidate(localConfig);
  if (fromLocal) return fromLocal;

  if (!env) return null;

  return normalizeCandidate({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
    firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
  });
}
