import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
// Here we have imported all the necessary database (Firestore) tools required for operation
import { 
    getFirestore, 
    collection, 
    getDocs, 
    getDoc, 
    addDoc, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    onSnapshot, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// Settings for your new project (etsyShopIraq)
const firebaseConfig = {
    apiKey: "AIzaSyBZ4kbwr42QtMi3ujHwRZvttaTAjNUu6Kw",
    authDomain: "ioiu-8b57a.firebaseapp.com",
    projectId: "ioiu-8b57a",
    storageBucket: "ioiu-8b57a.firebasestorage.app",
    messagingSenderId: "128338798689",
    appId: "1:128338798689:web:fbc5c7dd14291660ba6220"
};

// Initialize the application
const app = initializeApp(firebaseConfig);

// Connect to the database
const db = getFirestore(app);

// This step is very important: we make the database tools available to the script.js file for its use
window.db = db;
window.firestore = {
    collection,
    getDocs,
    getDoc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    serverTimestamp
};

// Trigger a signal to the rest of the project files that the database connection is ready and they can begin
const event = new Event('firebaseReady');
window.dispatchEvent(event);
