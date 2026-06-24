import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
// قمنا هنا باستدعاء جميع أدوات قاعدة البيانات (Firestore) اللازمة للعمل
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

// إعدادات مشروعك الجديد (etsyShopIraq)
const firebaseConfig = {
    apiKey: "AIzaSyBZ4kbwr42QtMi3ujHwRZvttaTAjNUu6Kw",
    authDomain: "ioiu-8b57a.firebaseapp.com",
    projectId: "ioiu-8b57a",
    storageBucket: "ioiu-8b57a.firebasestorage.app",
    messagingSenderId: "128338798689",
    appId: "1:128338798689:web:fbc5c7dd14291660ba6220"
};

// تهيئة التطبيق
const app = initializeApp(firebaseConfig);

// الاتصال بقاعدة البيانات
const db = getFirestore(app);

// هذه الخطوة مهمة جداً: نجعل أدوات قاعدة البيانات متاحة لملف script.js لكي يستخدمها
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

// إطلاق إشارة لباقي ملفات المشروع أن الاتصال بقاعدة البيانات جاهز ويمكنهم البدء
const event = new Event('firebaseReady');
window.dispatchEvent(event);
