// ==========================================
// CONFIGURAÇÃO DO FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyDfs3d6GS9pmVmaRJgMaKNViaGoXErCQgo",
    authDomain: "noc-its-logs.firebaseapp.com",
    databaseURL: "https://noc-its-logs-default-rtdb.firebaseio.com",
    projectId: "noc-its-logs",
    storageBucket: "noc-its-logs.firebasestorage.app",
    messagingSenderId: "872743555303",
    appId: "1:872743555303:web:61be8c8f9fe0ae8ccf1242"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);

// Exporta o banco de dados para ser usado nos outros arquivos
export const db = firebase.database();
