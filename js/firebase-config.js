// ==========================================
// CONFIGURAÇÃO DO FIREBASE (NOVO BANCO V2)
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyD1wUeJRZpTJBPlffI_HtSs20CLmEO80Dw",
  authDomain: "noc-its-v2.firebaseapp.com",
  databaseURL: "https://noc-its-v2-default-rtdb.firebaseio.com",
  projectId: "noc-its-v2",
  storageBucket: "noc-its-v2.firebasestorage.app",
  messagingSenderId: "629882027099",
  appId: "1:629882027099:web:d648e84a74d24d3c9d537e"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);

// Exporta o banco de dados para ser usado no resto do sistema
export const db = firebase.database();
