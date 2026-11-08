import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAMRzU73x7uls24yeMNP_A9fYfiaMcxfPc",
  authDomain: "futplay-lite.firebaseapp.com",
  projectId: "futplay-lite",
  storageBucket: "futplay-lite.firebasestorage.app",
  messagingSenderId: "939786758088",
  appId: "1:939786758088:web:85cdacdb8fd4a47ec42fd",
  measurementId: "G-Z70QV4CY51"
};

export const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const firebaseAuth = getAuth(firebaseApp);
firebaseAuth.languageCode = 'pt-BR';
