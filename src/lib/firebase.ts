// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  "projectId": "studio-8566554728-8465b",
  "appId": "1:379404616301:web:3c4ef29d4f108744e1b564",
  "storageBucket": "studio-8566554728-8465b.firebasestorage.app",
  "apiKey": "AIzaSyDvHweiXK8uI2-iR-JHSrR_1-jrZf0K-8g",
  "authDomain": "studio-8566554728-8465b.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "379404616301"
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
