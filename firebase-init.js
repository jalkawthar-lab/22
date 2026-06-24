<script type="module">
  // 1. استدعاء التطبيق الأساسي
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
  
  // 2. استدعاء دوال قاعدة البيانات (Firestore) الضرورية لعمل المتجر
  import { 
    getFirestore, doc, collection, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc, serverTimestamp, onSnapshot 
  } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
  
  // إعدادات الربط الخاصة بك
  const firebaseConfig = {
    apiKey: "AIzaSyBZ4kbwr42QtMi3ujHwRZvttaTAjNUu6Kw",
    authDomain: "ioiu-8b57a.firebaseapp.com",
    projectId: "ioiu-8b57a",
    storageBucket: "ioiu-8b57a.firebasestorage.app",
    messagingSenderId: "128338798689",
    appId: "1:128338798689:web:fbc5c7dd14291660ba6220"
  };

  // تهيئة فايربيس
  const app = initializeApp(firebaseConfig);
  
  // تهيئة قاعدة البيانات
  const db = getFirestore(app);

  // جعل قاعدة البيانات والدوال متاحة لملف script.js لكي يتمكن من استخدامها
  window.db = db;
  window.firestore = {
    doc, collection, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc, serverTimestamp, onSnapshot
  };

  // إرسال إشعار للمتجر والآدمن بأن قاعدة البيانات أصبحت جاهزة للعمل
  window.dispatchEvent(new Event("firebaseReady"));
</script>
