// src/lib/firebase.ts
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  "projectId": "studio-8566554728-8465b",
  "appId": "1:379404616301:web:3c4ef29d4f108744e1b564",
  "storageBucket": "studio-8566554728-8465b.firebasestorage.app",
  "apiKey": "AIzaSyDvHweiXK8uI2-iR-JHSrR_1-jrZf0K-8g",
  "authDomain": "studio-8566554728-8465b.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "379404616301"
};

// This is the client-side instance
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

auth = getAuth(app);
db = getFirestore(app);

export { app, db, auth };
