// firebase.js
// Replace the firebaseConfig object with your Firebase Web App config.
// (From Firebase Console -> Project -> Add Web App)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB84UjJrcR7CE0OhhyWhFJzgrNwzglm04M",
  authDomain: "fordatabase-2c541.firebaseapp.com",
  databaseURL: "https://fordatabase-2c541-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "fordatabase-2c541",
  storageBucket: "fordatabase-2c541.firebasestorage.app",
  messagingSenderId: "624817857038",
  appId: "1:624817857038:web:aab90c1a714f0f9863525f"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, onValue, update, get };
