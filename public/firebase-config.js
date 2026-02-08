// Your Firebase settings go here!
// You'll get these from your Firebase Console
const firebaseConfig = {

  apiKey: "AIzaSyB0k233hqPLxhYxqqKDMo3SDsK0UtmtMS4",

  authDomain: "signsync-bef3d.firebaseapp.com",

  databaseURL: "https://signsync-bef3d-default-rtdb.asia-southeast1.firebasedatabase.app",

  projectId: "signsync-bef3d",

  storageBucket: "signsync-bef3d.firebasestorage.app",

  messagingSenderId: "589971208814",

  appId: "1:589971208814:web:8338a2f5be174342f1447f",

  measurementId: "G-KPXC1RCTBS"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();  // If you want to save chat history

console.log("🔥 Firebase is ready!");