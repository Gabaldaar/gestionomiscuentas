import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

function getServiceAccount() {
  const rawKey = process.env.SERVICE_ACCOUNT_KEY || process.env.FB_SERVICE_ACCOUNT_KEY;
  if (rawKey) {
    try {
      const parsed = typeof rawKey === 'string' ? JSON.parse(rawKey) : rawKey;
      if (parsed && parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      return parsed;
    } catch (e) {
      console.error("Error parsing service account key:", e);
    }
  }

  const clientEmail = process.env.FB_CLIENT_EMAIL;
  let privateKey = process.env.FB_PRIVATE_KEY;
  if (clientEmail && privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
    return {
      client_email: clientEmail,
      private_key: privateKey,
      project_id: process.env.FB_PROJECT_ID || 'studio-8566554728-8465b',
    };
  }

  return null;
}

function initAdmin(): App {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }

  const serviceAccount = getServiceAccount();
  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || "studio-8566554728-8465b",
    });
  }

  return initializeApp({
    projectId: "studio-8566554728-8465b",
  });
}

const adminApp = initAdmin();
const adminDb: Firestore = getFirestore(adminApp);

export { adminDb, adminApp };
