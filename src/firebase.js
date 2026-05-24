import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Online play needs at least an API key and a database URL.
export const firebaseReady = Boolean(config.apiKey && config.databaseURL);

let _db = null;
export function getDb() {
  if (!firebaseReady) {
    throw new Error('Firebase is not configured — add VITE_FIREBASE_* to .env.local');
  }
  if (!_db) _db = getDatabase(initializeApp(config));
  return _db;
}
