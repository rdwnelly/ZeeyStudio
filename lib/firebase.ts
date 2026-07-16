import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDccuXwunmJZxB4LiMo49giRf7R5ovEvS0",
  authDomain: "zeeystudio.firebaseapp.com",
  projectId: "zeeystudio",
  storageBucket: "zeeystudio.firebasestorage.app",
  messagingSenderId: "286326363941",
  appId: "1:286326363941:web:88d0483636de3ea8d36ccc"
};

// Initialize Firebase (Singleton pattern for Next.js API routes)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const storage = getStorage(app);

export { app, db, storage };
