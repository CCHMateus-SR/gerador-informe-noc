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

export function mostrarToast(mensagem, tipo = 'success', duracao = null) {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    if (tipo === 'info') {
        toast.style.background = '#3B82F6'; toast.style.boxShadow = '0 10px 25px rgba(59, 130, 246, 0.3)';
    } else if (tipo === 'warning') {
        toast.classList.add('toast-warning');
    } else {
        toast.style.pointerEvents = 'none';
    }
    toast.innerHTML = mensagem;
    container.appendChild(toast);
    let time = duracao || (tipo === 'success' ? 3000 : 5000);
    setTimeout(() => {
        toast.style.opacity = '0'; toast.style.transform = 'translateX(-100%)';
        setTimeout(() => { if (container.contains(toast)) container.removeChild(toast); }, 400);
    }, time);
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

export function tocarSom(tipo) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const gainNode = audioCtx.createGain();
        gainNode.connect(audioCtx.destination);

        if (tipo === 'aviso') {
            const osc1 = audioCtx.createOscillator(); osc1.type = 'sine'; osc1.frequency.setValueAtTime(880, audioCtx.currentTime); osc1.connect(gainNode);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            osc1.start(audioCtx.currentTime); osc1.stop(audioCtx.currentTime + 0.1);
            const osc2 = audioCtx.createOscillator(); osc2.type = 'sine'; osc2.frequency.setValueAtTime(1108.73, audioCtx.currentTime + 0.15); osc2.connect(gainNode);
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime + 0.15); gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
            osc2.start(audioCtx.currentTime + 0.15); osc2.stop(audioCtx.currentTime + 0.4);
        } else if (tipo === 'sla') {
            const osc = audioCtx.createOscillator(); osc.type = 'square'; osc.frequency.setValueAtTime(600, audioCtx.currentTime); osc.frequency.setValueAtTime(0, audioCtx.currentTime + 0.15); osc.frequency.setValueAtTime(600, audioCtx.currentTime + 0.25);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            osc.start(); osc.stop(audioCtx.currentTime + 0.5);
        } else if (tipo === 'critical') {
            const osc = audioCtx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(400, audioCtx.currentTime); osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.4); osc.frequency.linearRampToValueAtTime(400, audioCtx.currentTime + 0.8);
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime); gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.7); gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
            osc.start(); osc.stop(audioCtx.currentTime + 0.8);
        }
    } catch(e) {}
}