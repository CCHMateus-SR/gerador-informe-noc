// ==========================================
// MÓDULO DE INTERFACE E UTILITÁRIOS (UI)
// ==========================================

let themeAtual = 'light';
let blinkInterval = null;
let isBlinking = false;
const originalTitle = document.title;

export function inicializarUI() {
    // 1. Liga o Relógio do Topo
    setInterval(() => {
        const now = new Date();
        const relogio = document.getElementById('relogio-noc');
        if (relogio) relogio.innerText = now.toLocaleTimeString('pt-BR');
    }, 1000);

    // 2. Monitora se a internet caiu
    window.addEventListener('online', atualizarStatusConexao);
    window.addEventListener('offline', atualizarStatusConexao);
    atualizarStatusConexao();

    // 3. Puxa o tema que o usuário usou por último
    const savedTheme = localStorage.getItem('noc_theme_its');
    if (savedTheme) { themeAtual = savedTheme; }
    aplicarTema(themeAtual);

    // 4. Para a aba de piscar quando o usuário volta pro sistema
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) stopTabBlink();
    });
}

function atualizarStatusConexao() {
    const statusEl = document.getElementById('conexao-status');
    if (!statusEl) return;
    if (navigator.onLine) {
        statusEl.innerHTML = '🟢 Online';
        statusEl.className = 'status-conn conn-online';
    } else {
        statusEl.innerHTML = '🔴 Offline';
        statusEl.className = 'status-conn conn-offline';
    }
}

function aplicarTema(tema) {
    document.body.classList.remove('dark-mode', 'pro-mode');
    let icon = '☀️';
    if (tema === 'dark') {
        document.body.classList.add('dark-mode'); icon = '🌙';
    } else if (tema === 'pro') {
        document.body.classList.add('pro-mode'); icon = '⚙️';
    }
    const btnTheme = document.querySelector('.btn-theme');
    if(btnTheme) btnTheme.innerText = icon;
}

// Funções penduradas no window (Para o HTML conseguir clicar)
window.cycleTheme = function() {
    if (themeAtual === 'light') themeAtual = 'dark';
    else if (themeAtual === 'dark') themeAtual = 'pro';
    else themeAtual = 'light';
    try { localStorage.setItem('noc_theme_its', themeAtual); } catch(e){}
    aplicarTema(themeAtual);
}

window.toggleSecao = function(secaoId, iconId) {
    const secao = document.getElementById(secaoId);
    const icon = document.getElementById(iconId);
    if (secao.style.display === 'none') {
        secao.style.display = 'grid';
        icon.style.transform = 'rotate(0deg)';
    } else {
        secao.style.display = 'none';
        icon.style.transform = 'rotate(-90deg)';
    }
}

window.copiarTextoInline = function(event, texto) {
    event.stopPropagation();
    navigator.clipboard.writeText(texto).then(() => {
        mostrarToast("📋 Copiado: " + texto, "info", 2000);
    });
}

window.fecharHistorico = function() {
    document.getElementById('modal-historico').style.display = 'none';
}

// ==========================================
// FUNÇÕES EXPORTADAS (Usadas pelos outros arquivos JS)
// ==========================================

export function mostrarToast(mensagem, tipo = 'info', tempo = 3000) {
    // 1. Procura ou cria o container na tela
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    // 2. Cria a notificação
    const toast = document.createElement('div');
    toast.className = `toast-premium toast-${tipo}`;
    
    // 3. Injeta a mensagem e a barrinha de tempo (que usa o tempo passado na função!)
    toast.innerHTML = `
        <div style="position: relative; z-index: 2;">${mensagem}</div>
        <div class="toast-progress" style="animation-duration: ${tempo}ms;"></div>
    `;

    // 4. Joga na tela
    container.appendChild(toast);

    // 5. Programa a autodestruição exata quando a barrinha zerar
    setTimeout(() => {
        toast.classList.add('hide'); // Inicia a animação de sumir
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 400); // Espera o slide de saída terminar para apagar do HTML
    }, tempo);
}

// Penduramos no window também, porque alguns botões no HTML chamam o toast diretamente
window.mostrarToast = mostrarToast;

export function startTabBlink(msg) {
    if (!document.hidden || isBlinking) return;
    isBlinking = true;
    let showMsg = true;
    blinkInterval = setInterval(() => {
        document.title = showMsg ? msg : originalTitle;
        showMsg = !showMsg;
    }, 1000);
}

export function stopTabBlink() {
    clearInterval(blinkInterval);
    isBlinking = false;
    document.title = originalTitle;
}

// ==========================================
// FUNÇÃO DO BOTÃO (ABRIR E FECHAR)
// ==========================================
window.abrirGavetaHistorico = function(event) {
    // 1. Cria um escudo absoluto contra o clique vazar (suporta qualquer navegador)
    const e = event || window.event;
    if (e && e.stopPropagation) {
        e.stopPropagation();
    }

    const painel = document.getElementById('history-container');
    if (painel) {
        painel.classList.toggle('aberto');
    }
}

// ==========================================
// FECHAR GAVETA AO CLICAR FORA (CLICK OUTSIDE)
// ==========================================
document.addEventListener('click', function(event) {
    const painel = document.getElementById('history-container');
    
    // Verifica se a gaveta existe e se está aberta (se não, nem perde tempo)
    if (!painel || !painel.classList.contains('aberto')) return;

    // Se o clique foi DENTRO da própria gaveta, ignora (não queremos fechar)
    if (painel.contains(event.target)) return;

    // Se o clique foi NO BOTÃO de abrir (ou no ícone dentro dele), ignora 
    // Isso é uma camada extra de segurança!
    const botaoAbrir = document.querySelector('.btn-toggle-historico');
    if (botaoAbrir && botaoAbrir.contains(event.target)) return;

    // Se passou por todas as barreiras acima, é porque clicou no fundo da tela. Aí sim, fecha!
    painel.classList.remove('aberto');
});
