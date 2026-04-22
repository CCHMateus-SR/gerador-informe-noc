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

// ==========================================
// MOTOR DE SONOPLASTIA DO NOC
// ==========================================
window.tocarSomNOC = function(tipo) {
    // Usando sons curtos e profissionais direto de um repositório online
    // (Você pode baixar e trocar por arquivos locais depois, ex: 'sounds/beep.mp3')
    const bancoDeSons = {
        'aviso': 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3', // Pop suave para avisos rápidos
        'alerta': 'https://assets.mixkit.co/active_storage/sfx/2867/2867-preview.mp3'  // Beep duplo para chamados novos
    };

    if (bancoDeSons[tipo]) {
        const audio = new Audio(bancoDeSons[tipo]);
        audio.volume = 0.5; // Volume em 50% para não assustar ninguém de madrugada
        
        // O catch evita erros se o navegador bloquear o som automático antes do primeiro clique do usuário
        audio.play().catch(e => console.log("Som bloqueado pelo navegador até o usuário interagir com a tela."));
    }
};

// Motor da Cópia Cirúrgica
window.copiarCirurgico = function(idOuTexto, btnElement) {
    // Se passarmos o ID da div, ele pega o texto dela. Se passarmos texto direto, ele copia.
    let texto = document.getElementById(idOuTexto) ? document.getElementById(idOuTexto).innerText : idOuTexto;
    if (!texto || texto === '---') return;

    navigator.clipboard.writeText(texto).then(() => {
        const txtOriginal = btnElement.innerHTML;
        btnElement.innerHTML = '✔️';
        btnElement.style.background = '#10B981';
        btnElement.style.color = '#FFF';

        setTimeout(() => {
            btnElement.innerHTML = txtOriginal;
            btnElement.style.background = '';
            btnElement.style.color = '';
        }, 1500);
    });
};

// Motor da Sanfona do Formulário
window.toggleSanfona = function(idConteudo, setaElement) {
    const conteudo = document.getElementById(idConteudo);
    if (!conteudo) return;

    // Alterna a classe 'fechada' no conteúdo e na seta
    conteudo.classList.toggle('fechada');
    if (setaElement) setaElement.classList.toggle('fechada');
};

// ==========================================
// 14. MOTOR DA SANFONA INTELIGENTE (AUTO-FECHAMENTO)
// ==========================================
window.sanfonaStatus = { s1: false, s2: false, s3: false };

window.forcarEstadoSanfona = function(idConteudo, abrir) {
    const conteudo = document.getElementById(idConteudo);
    if (!conteudo) return;
    
    // Procura a setinha correspondente para girar junto
    const header = conteudo.previousElementSibling;
    let seta = null;
    if (header && header.classList.contains('sanfona-header')) {
        seta = header.querySelector('.sanfona-seta');
    }

    if (abrir) {
        conteudo.classList.remove('fechada');
        if (seta) seta.classList.remove('fechada');
    } else {
        conteudo.classList.add('fechada');
        if (seta) seta.classList.add('fechada');
    }
};

// Função que reseta a inteligência quando limpamos o formulário
window.resetarSanfona = function() {
    window.sanfonaStatus = { s1: false, s2: false, s3: false };
    window.forcarEstadoSanfona('secao-1', true);
    window.forcarEstadoSanfona('secao-2', true);
    window.forcarEstadoSanfona('secao-3', true);
};

window.verificarSanfonaInteligente = function() {
    // Descobre onde o cursor do analista está agora (para não roubar o foco)
    const activeId = document.activeElement ? document.activeElement.id : null;

    // --- LÓGICA DA SEÇÃO 1 (Identificação) ---
    const c = document.getElementById('cliente').value.trim();
    const h = document.getElementById('host').value.trim();
    const i = document.getElementById('item').value.trim();
    const s = document.getElementById('severidade').value;
    const info = document.getElementById('statusinfo').value.trim();

    if (c && h && i && s && info && !window.sanfonaStatus.s1) {
        // Se ele NÃO estiver digitando nesses campos agora, executa o fechamento
        const digitandoS1 = ['cliente', 'host', 'item', 'severidade', 'statusinfo'].includes(activeId);
        if (!digitandoS1) {
            window.forcarEstadoSanfona('secao-1', false); // Fecha 1
            window.forcarEstadoSanfona('secao-2', true);  // Garante que a 2 está aberta
            window.sanfonaStatus.s1 = true; // Marca como validada
        }
    }

    // --- LÓGICA DA SEÇÃO 2 (SLA e Acompanhamento) ---
    const status = document.getElementById('status').value;
    const inicio = document.getElementById('inicio').value.trim();
    const itssm = document.getElementById('itssm').value.trim();
    const protLibbs = document.getElementById('protocolo-libbs') ? document.getElementById('protocolo-libbs').value.trim() : '';
    
    // Regra especial para a Libbs
    const isLibbs = (c.toUpperCase() === 'LIBBS' && h.toUpperCase() !== 'LIBBS-DIGIBEE');
    const regValido = isLibbs ? protLibbs : itssm;
    
    const prot = document.getElementById('protocolo').value.trim();
    const fgrid = document.getElementById('f-grid').value.trim();
    const term = document.getElementById('termino').value.trim();

    let s2Completo = false;
    
    // Sua lógica cirúrgica de fluxos de SLA:
    if (status === 'EM ABERTO') {
        if (status && inicio && regValido) s2Completo = true;
    } 
    else if (status === 'FOLLOW-UP') {
        if (prot && fgrid && term) s2Completo = true;
    } 
    else if (status === 'RESOLVIDO') {
        if (status && inicio && regValido && prot && fgrid && term) s2Completo = true;
    }

    if (s2Completo && !window.sanfonaStatus.s2) {
        const digitandoS2 = ['status', 'inicio', 'itssm', 'protocolo-libbs', 'protocolo', 'f-grid', 'termino'].includes(activeId);
        if (!digitandoS2) {
            window.forcarEstadoSanfona('secao-2', false); // Fecha 2
            window.forcarEstadoSanfona('secao-3', true);  // Abre 3
            window.sanfonaStatus.s2 = true;
        }
    }

    // --- LÓGICA DA SEÇÃO 3 (Tratativa e Diagnóstico) ---
    const soluc = document.getElementById('solucionador').value.trim();
    const desc = document.getElementById('desc').value.trim();
    
    if (soluc && desc && !window.sanfonaStatus.s3) {
        const digitandoS3 = ['solucionador', 'desc', 'macro-template'].includes(activeId);
        if (!digitandoS3) {
            window.forcarEstadoSanfona('secao-3', false); // Fecha a 3
            window.sanfonaStatus.s3 = true;
        }
    }
};

// Escuta Mágica: Monitora todo o formulário. Se o analista tirar o cursor de um campo (focusout), ele checa as regras!
document.addEventListener('DOMContentLoaded', () => {
    const formContainer = document.getElementById('form-container');
    if (formContainer) {
        formContainer.addEventListener('focusout', () => {
            // Delay minúsculo para garantir que o navegador atualizou o cursor
            setTimeout(window.verificarSanfonaInteligente, 100);
        });
    }
});
