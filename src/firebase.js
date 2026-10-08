// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAOF7C07UA6DYX1TqsFpQ0nj_OBS5jMfsk",
  authDomain: "cbt-tkr-smekisa.firebaseapp.com",
  projectId: "cbt-tkr-smekisa",
  storageBucket: "cbt-tkr-smekisa.firebasestorage.app",
  messagingSenderId: "27077619572",
  appId: "1:27077619572:web:17ef4fd64356db36fb8621",
  measurementId: "G-ZRPKF231DV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);