import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
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

const firebaseConfig = {
    apiKey: "AIzaSyBZ4kbwr42QtMi3ujHwRZvttaTAjNUu6Kw",
    authDomain: "ioiu-8b57a.firebaseapp.com",
    projectId: "ioiu-8b57a",
    storageBucket: "ioiu-8b57a.firebasestorage.app",
    messagingSenderId: "128338798689",
    appId: "1:128338798689:web:fbc5c7dd14291660ba6220"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

const event = new Event('firebaseReady');
window.dispatchEvent(event);
