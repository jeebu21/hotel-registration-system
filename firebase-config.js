import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCIWPFFwyPIagjevYinvdbtupYDwl1WRwQ",
  authDomain: "hotel-booking-system-468e9.firebaseapp.com",
  projectId: "hotel-booking-system-468e9",
  storageBucket: "hotel-booking-system-468e9.firebasestorage.app",
  messagingSenderId: "295336316523",
  appId: "1:295336316523:web:495b4be2cd8589103c2b2e"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
