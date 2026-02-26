// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
export const db = getDatabase(app);
export { ref, set, onValue, update };

// Global Audio Context (to be used in index.html)
export const playSound = (soundId) => {
    const audio = document.getElementById(soundId);
    if(audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.log("Audio play blocked until user interaction", e));
    }
};
