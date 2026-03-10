// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// เอา config ของคุณมาใส่ตรงนี้ครับ
const firebaseConfig = {
  apiKey: "AIzaSyA8nsuAjHA5lATszkN4yuWUGyXJthgeVn0",
  authDomain: "haru-carbooking.firebaseapp.com",
  projectId: "haru-carbooking",
  storageBucket: "haru-carbooking.firebasestorage.app",
  messagingSenderId: "184742891217",
  appId: "1:184742891217:web:e5fddda202e7c7d9977ff0",
  measurementId: "G-2BP0R5NLC7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);