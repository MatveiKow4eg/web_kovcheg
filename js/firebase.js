// firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyDHNEIG6WOriQVmsxSJ9GkLQOluizstaYI",
  authDomain: "kovchegee.firebaseapp.com",
  projectId: "kovchegee",
  storageBucket: "kovchegee.appspot.com",
  messagingSenderId: "576183567033",
  appId: "1:576183567033:web:52c9a991cb4038ba40d168",
  measurementId: "G-2G1M4MT7M6"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);