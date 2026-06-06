import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// IMPORTANT: Service account key is stored in an environment variable.
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : null;

if (!admin.apps.length) {
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // This will likely only work in a Google Cloud environment.
    // For Netlify, the service account key is required.
    console.warn("FIREBASE_SERVICE_ACCOUNT_KEY not found. Initializing without credentials.");
    admin.initializeApp();
  }
}

const db = getFirestore();

export { db as adminDb };
