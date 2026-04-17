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

// Função universal para dar o feedback visual (tátil) nos botões
window.animarBotaoCopia = function(botaoId) {
    const btn = document.getElementById(botaoId);
    if (!btn) return;
    
    // Salva o que estava escrito no botão antes do clique
    const textoOriginal = btn.innerHTML;
    
    // Aplica o visual de sucesso
    btn.classList.add('btn-copiado-sucesso');
    btn.innerHTML = '✔️ COPIADO!';
    
    // Programa para voltar ao normal exatamente após 2 segundos
    setTimeout(() => {
        btn.classList.remove('btn-copiado-sucesso');
        btn.innerHTML = textoOriginal;
    }, 2000);
};
