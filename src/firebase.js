import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBR02O8GCYAIzl5Nc4nlXrXVXCnPIrE1AE",
  authDomain: "trailer-contremaitres.firebaseapp.com",
  projectId: "trailer-contremaitres",
  storageBucket: "trailer-contremaitres.firebasestorage.app",
  messagingSenderId: "276721282605",
  appId: "1:276721282605:web:183d8afd9ca3d04b8612a4",
  measurementId: "G-R8T2X45Y6N",
};

const app = initializeApp(firebaseConfig);

isSupported().then((supported) => {
  if (supported) {
    getAnalytics(app);
  }
});

export default app;