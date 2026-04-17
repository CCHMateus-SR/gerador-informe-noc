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
    
    // 1. Limpa qualquer estado de "A GERAR..." ou travas anteriores
    btn.classList.remove('btn-copiado-sucesso'); 

    // 2. Define os nomes originais fixos para evitar que ele salve "A GERAR..." como nome original
    const nomesOriginais = {
        'btn-assunto': '✉️ ASSUNTO',
        'btn-assunto-itssm': '✉️ ASSUNTO ITSSM',
        'btn-copiar-img': '📸 COPIAR INFORME',
        'btn-copiar-itssm': '📝 TEXTO ITSSM'
    };

    // 3. Aplica o visual de sucesso
    btn.classList.add('btn-copiado-sucesso');
    btn.innerHTML = '✔️ COPIADO!';
    
    // 4. Reset forçado após 2 segundos
    setTimeout(() => {
        btn.classList.remove('btn-copiado-sucesso');
        // Devolve o nome correto baseado no ID, ignorando qualquer texto temporário
        btn.innerHTML = nomesOriginais[botaoId] || btn.innerHTML;
    }, 2000);
};
