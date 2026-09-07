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
      projectId: "studio-8566554728-8465b",
    });
  } else {
    admin.initializeApp({
      projectId: "studio-8566554728-8465b",
    });
  }
}

const db = getFirestore();

export { db as adminDb };
