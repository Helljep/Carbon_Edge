import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC7ZUp7MweGn-_pmbR6E9IMCBXLFXdz0bg",
  authDomain: "carbonedge-3df44.firebaseapp.com",
  projectId: "carbonedge-3df44",
  storageBucket: "carbonedge-3df44.firebasestorage.app",
  messagingSenderId: "50292431716",
  appId: "1:50292431716:web:3cc27b998cc6eabd54f871"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
