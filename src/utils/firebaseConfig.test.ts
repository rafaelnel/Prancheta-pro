import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFirebaseConfig } from './firebaseConfig';

test('resolveFirebaseConfig prioritizes valid local firebase-applet-config.json', () => {
  const result = resolveFirebaseConfig(
    {
      projectId: 'demo-proj',
      appId: '1:123:web:abc',
      apiKey: 'test-public-web-key-123',
      authDomain: 'demo-proj.firebaseapp.com',
      firestoreDatabaseId: 'custom-db-id',
    },
    {
      VITE_FIREBASE_PROJECT_ID: 'env-proj',
      VITE_FIREBASE_APP_ID: '1:999:web:xyz',
      VITE_FIREBASE_API_KEY: 'env-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'env-proj.firebaseapp.com',
    }
  );

  assert.ok(result);
  assert.equal(result.projectId, 'demo-proj');
  assert.equal(result.firestoreDatabaseId, 'custom-db-id');
});

test('resolveFirebaseConfig falls back to VITE_FIREBASE_* env vars when local JSON is absent', () => {
  const result = resolveFirebaseConfig(null, {
    VITE_FIREBASE_PROJECT_ID: 'gh-pages-proj',
    VITE_FIREBASE_APP_ID: '1:999:web:xyz',
    VITE_FIREBASE_API_KEY: 'gh-web-key-456',
    VITE_FIREBASE_AUTH_DOMAIN: 'gh-pages-proj.firebaseapp.com',
    VITE_FIREBASE_DATABASE_ID: 'ai-studio-db',
  });

  assert.ok(result);
  assert.equal(result.projectId, 'gh-pages-proj');
  assert.equal(result.firestoreDatabaseId, 'ai-studio-db');
});

test('resolveFirebaseConfig returns null when neither local config nor env vars are configured', () => {
  assert.equal(resolveFirebaseConfig(null, {}), null);
  assert.equal(resolveFirebaseConfig(undefined, undefined), null);
});

test('resolveFirebaseConfig rejects placeholder template values', () => {
  const result = resolveFirebaseConfig(
    {
      projectId: 'YOUR_FIREBASE_PROJECT_ID',
      appId: '1:000000000000:web:0000000000000000000000',
      apiKey: 'YOUR_FIREBASE_WEB_API_KEY',
      authDomain: 'YOUR_FIREBASE_PROJECT_ID.firebaseapp.com',
    },
    {}
  );

  assert.equal(result, null);
});
