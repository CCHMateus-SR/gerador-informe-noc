// ==========================================
// ARQUIVO PRINCIPAL (MAESTRO)
// ==========================================
import { db } from './firebase-config.js';
import { inicializarAuth } from './auth.js';
import { inicializarUI } from './ui.js';
import { carregarEstadoSLA, iniciarMonitoramentoSLA } from './sla.js';
import { iniciarBancoDeDados } from './dispatch.js';

console.log("Sistema NOC ITS Iniciado!");

window.onload = () => {
    inicializarAuth();
    inicializarUI();
    
    // Inicia os serviços pesados se o usuário estiver logado
    if (document.getElementById('user-display').innerText.includes('👤')) {
        carregarEstadoSLA();
        iniciarMonitoramentoSLA();
        iniciarBancoDeDados();
        window.update(); // Renderiza o preview visual do lado direito
    }
};
