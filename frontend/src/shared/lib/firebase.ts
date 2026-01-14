import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyC-cN_5EKGlfbVi61AD0_-1AED24kghSWk",
  authDomain: "kuma-eye.firebaseapp.com",
  projectId: "kuma-eye",
  storageBucket: "kuma-eye.firebasestorage.app",
  messagingSenderId: "52533905728",
  appId: "1:52533905728:web:dfaad07ea9822b081252a5",
  measurementId: "G-Q6P2RCQWSL"
};

// Initialize Firebase (avoid duplicate initialization)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
