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
        
        // --- 👑 REVELA O BOTÃO DE GESTÃO SE FOR O CHEFE ---
        const salvo = localStorage.getItem('noc_user_info');
        if (salvo) {
            const user = JSON.parse(salvo);
            if (user.turno === "Gestão") {
                const btnGestao = document.getElementById('btn-painel-gestao');
                if (btnGestao) btnGestao.style.display = 'inline-block';
            }
        }
        // --------------------------------------------------
    }
};

// ==========================================
// MOTOR DE ROTEAMENTO POR PERFIL (WORKSPACE)
// ==========================================
window.construirWorkspaceGestao = function() {
    document.body.classList.add('modo-gestao');
    
    // 1. Esconde a visão do analista
    const appAnalista = document.getElementById('app-analista');
    if (appAnalista) appAnalista.style.display = 'none';
    
    // 2. Revela o Workspace da Gestão
    document.getElementById('app-gestao').style.display = 'flex';

    // 3. O TELETRANSPORTE: Move o Menu de Usuário da barra preta para a barra lateral!
    const userContainer = document.querySelector('.user-menu-container');
    const gestaoFooter = document.getElementById('gestao-user-footer');
    if (userContainer && gestaoFooter) {
        gestaoFooter.appendChild(userContainer);
    }

    // 4. MOVE AS TELAS E REMOVE ESTILOS INLINE (Para o CSS assumir o controle)
    const area = document.getElementById('gestao-content-area');
    document.getElementById('loading-gestao').style.display = 'none';
    
    const moverPainel = (idOriginal, novoId) => {
        const elemento = document.getElementById(idOriginal);
        if (elemento) {
            const content = elemento.classList.contains('modal-overlay') ? elemento.querySelector('.modal-content') : elemento;
            if(content) {
                if(novoId) content.id = novoId;
                content.classList.add('gestao-pane-ativo');
                
                content.style.display = ''; 
                content.style.flexDirection = '';
                content.style.height = '';
                content.style.width = '';
                content.style.maxWidth = '';
                
                area.appendChild(content);
            }
        }
    };

    moverPainel('aba-gestao-auditoria');
    moverPainel('aba-gestao-tracking');
    moverPainel('aba-gestao-base');
    moverPainel('modal-historico', 'painel-radar-gestao');
    moverPainel('modal-base-analista', 'painel-procedimentos-gestao');
    moverPainel('caixa-modal-aceite'); 

    // Inicia na aba Auditoria
    window.ativarPainelGestao('auditoria');

    // Libera Configurações
    document.getElementById('tab-cfg-clientes').style.display = 'block';
    document.getElementById('tab-cfg-analistas').style.display = 'block';
};

window.restringirConfiguracoesAnalista = function() {
    document.getElementById('tab-cfg-clientes').style.display = 'none';
    document.getElementById('tab-cfg-analistas').style.display = 'none';
    
    // Força o analista a ver apenas a aba de escalas se abrir a config
    window.trocarAbaConfig = function(aba) {
        if (aba === 'clientes' || aba === 'analistas') return; 
        document.querySelectorAll('.cfg-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.cfg-panel').forEach(p => p.style.display = 'none');
        event.target.classList.add('active');
        document.getElementById('cfg-aba-' + aba).style.display = 'block';
    };
    document.getElementById('tab-cfg-escalas').classList.add('active');
    document.querySelectorAll('.cfg-panel').forEach(p => p.style.display = 'none');
    document.getElementById('cfg-aba-escalas').style.display = 'block';
};

window.ativarPainelGestao = function(painel, btnElement) {
    if (btnElement) {
        document.querySelectorAll('.btn-gestao-menu').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
    }

    // DESLIGA TODAS AS TELAS (Remove a classe .is-active)
    ['aba-gestao-auditoria', 'aba-gestao-tracking', 'aba-gestao-base', 'painel-radar-gestao', 'painel-procedimentos-gestao', 'caixa-modal-aceite'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.remove('is-active');
    });

    // Função que ACENDE a tela escolhida
    const ativar = (id) => {
        const el = document.getElementById(id);
        if(el) el.classList.add('is-active');
    };

    // Dispara a visualização e o carregamento de dados
    if (painel === 'auditoria') {
        ativar('aba-gestao-auditoria');
        if(typeof carregarAuditoriaPassagens === 'function') carregarAuditoriaPassagens();
    }
    else if (painel === 'tracking') {
        ativar('aba-gestao-tracking');
        
        // 🔥 A MÁGICA DO TRACKING: Preenche com a data de HOJE automaticamente!
        const hoje = new Date();
        // Ajuste de fuso horário local para evitar bugs de virada de dia
        const dataLocal = new Date(hoje.getTime() - (hoje.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        
        const inputIni = document.getElementById('track-data-ini');
        const inputFim = document.getElementById('track-data-fim');
        
        // Se os campos estiverem vazios, injeta a data atual
        if (inputIni && !inputIni.value) inputIni.value = dataLocal;
        if (inputFim && !inputFim.value) inputFim.value = dataLocal;
        
        // Já manda o banco de dados buscar a produção do dia instantaneamente!
        if(typeof carregarTracking === 'function') carregarTracking();
    }
    else if (painel === 'base') {
        ativar('aba-gestao-base');
    }
    else if (painel === 'radar') {
        ativar('painel-radar-gestao');
        if(typeof abrirHistorico === 'function') abrirHistorico(); 
        setTimeout(() => {
            if(typeof filtrarRadar === 'function') filtrarRadar();
        }, 100);
    }
    else if (painel === 'procedimentos') {
        ativar('painel-procedimentos-gestao');
        if(typeof renderizarBaseAnalista === 'function') renderizarBaseAnalista();
    }
    else if (painel === 'ultima') {
        ativar('caixa-modal-aceite');
        if(typeof lerUltimaPassagem === 'function') lerUltimaPassagem();
    }
};

// O Vigia Implacável: Verifica constantemente quem está logado
setInterval(() => {
    const salvo = localStorage.getItem('noc_user_info');
    if (salvo && !document.body.classList.contains('layout-aplicado')) {
        const user = JSON.parse(salvo);
        document.body.classList.add('layout-aplicado');
        if (user.turno === "Gestão") window.construirWorkspaceGestao();
        else window.restringirConfiguracoesAnalista();
    }
}, 500);

// Função universal para dar o feedback visual (tátil) nos botões
window.animarBotaoCopia = function(botaoId) {
    const btn = document.getElementById(botaoId);
    if (!btn) return;
    
    // 1. Limpa qualquer estado de "A GERAR..." ou travas anteriores
    btn.classList.remove('btn-copiado-sucesso'); 

    // 2. Define os nomes originais fixos para evitar que ele salve "A GERAR..." como nome original
    const nomesOriginais = {
        'btn-assunto': '<span style="font-size: 9px; color: #94A3B8; font-weight: 700; line-height: 1;">✉️ ASSUNTO</span><span style="font-size: 12px; font-weight: 900; line-height: 1; color: #F8FAFC;">E-MAIL</span>',
        'btn-assunto-itssm': '<span style="font-size: 9px; color: #94A3B8; font-weight: 700; line-height: 1;">✉️ ASSUNTO</span><span style="font-size: 12px; font-weight: 900; line-height: 1; color: #F8FAFC;">ITSSM</span>',
        'btn-copiar-img': '📸 COPIAR INFORME VISUAL',
        'btn-copiar-itssm': '<span style="font-size: 9px; color: #94A3B8; font-weight: 700; line-height: 1;">📝 TEXTO</span><span style="font-size: 12px; font-weight: 900; line-height: 1; color: #F8FAFC;">ITSSM</span>'
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

// ==========================================
// CENTRAL DE NOTIFICAÇÕES E TIMELINE (COM MEMÓRIA)
// ==========================================

window.abrirTimeline = function() {
    document.getElementById('modal-timeline').style.display = 'flex';
    
    // Zera o contador visual e salva na memória que foi lido
    window.totalNotificacoesNaoLidas = 0;
    const contadorNotificacoes = document.getElementById('contador-notificacoes');
    if (contadorNotificacoes) {
        contadorNotificacoes.innerText = window.totalNotificacoesNaoLidas;
        contadorNotificacoes.classList.add('badge-oculto');
    }
    localStorage.setItem('noc_timeline_count', 0);
};

window.fecharTimeline = function() {
    document.getElementById('modal-timeline').style.display = 'none';
};

function iniciarNotificacoes() {
    const contadorNotificacoes = document.getElementById('contador-notificacoes');
    const btnLimparNotificacoes = document.getElementById('btn-limpar-notificacoes');
    const listaNotificacoes = document.getElementById('lista-notificacoes');

    if(!listaNotificacoes) return;

    // 🧠 1. RECUPERA DA MEMÓRIA AO ABRIR A PÁGINA
    window.totalNotificacoesNaoLidas = parseInt(localStorage.getItem('noc_timeline_count')) || 0;
    const historicoSalvo = localStorage.getItem('noc_timeline_html');
    
    if (historicoSalvo) {
        listaNotificacoes.innerHTML = historicoSalvo;
    }
    
    if (window.totalNotificacoesNaoLidas > 0 && contadorNotificacoes) {
        contadorNotificacoes.innerText = window.totalNotificacoesNaoLidas;
        contadorNotificacoes.classList.remove('badge-oculto');
    }

    // 3. LÓGICA DO BOTÃO LIMPAR (APAGA A MEMÓRIA)
    if (btnLimparNotificacoes) {
        btnLimparNotificacoes.addEventListener('click', () => {
            listaNotificacoes.innerHTML = '<p class="notificacao-vazia" style="color: #64748B; text-align: center; font-size: 14px; margin: 30px 0; font-weight: bold;">Nenhuma notificação nova no radar.</p>';
            window.totalNotificacoesNaoLidas = 0;
            if (contadorNotificacoes) contadorNotificacoes.classList.add('badge-oculto');
            
            // Limpa o HD do navegador
            localStorage.removeItem('noc_timeline_html');
            localStorage.setItem('noc_timeline_count', 0);
        });
    }
}
setTimeout(iniciarNotificacoes, 1000);

window.salvarNotificacaoNoPainel = function(mensagem, corBorda = '#38bdf8') {
    const modalTimeline = document.getElementById('modal-timeline');
    const listaNotificacoes = document.getElementById('lista-notificacoes');
    if(!listaNotificacoes) return;

    const msgVazia = listaNotificacoes.querySelector('.notificacao-vazia');
    if(msgVazia) msgVazia.remove();

    const novoItem = document.createElement('div');
    novoItem.classList.add('item-notificacao');
    
    // Deixa os itens maiores e mais espaçados agora que temos um modal grande
    novoItem.style.borderLeftColor = corBorda;
    novoItem.style.padding = '15px';
    novoItem.style.fontSize = '12px';
    
    const horaExata = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    novoItem.innerHTML = `<strong>[${horaExata}]</strong> ${mensagem}`;

    listaNotificacoes.prepend(novoItem);

    // Só aumenta o contador se o modal estiver fechado
    if(modalTimeline && modalTimeline.style.display !== 'flex') {
        window.totalNotificacoesNaoLidas++;
        const contadorNotificacoes = document.getElementById('contador-notificacoes');
        if (contadorNotificacoes) {
            contadorNotificacoes.innerText = window.totalNotificacoesNaoLidas;
            contadorNotificacoes.classList.remove('badge-oculto');
        }
    }
    
    // 🧠 MÁGICA DA PERSISTÊNCIA
    localStorage.setItem('noc_timeline_html', listaNotificacoes.innerHTML);
    localStorage.setItem('noc_timeline_count', window.totalNotificacoesNaoLidas);
};

// Função para Navegação das Abas do Formulário (1, 2 e 3)
window.mudarSecao = function(secaoIndex) {
    // Esconde todas as seções
    document.getElementById('sec-1').style.display = 'none';
    document.getElementById('sec-2').style.display = 'none';
    document.getElementById('sec-3').style.display = 'none';
    
    // Tira a classe 'active' de todos os botões
    document.getElementById('btn-sec-1').classList.remove('active');
    document.getElementById('btn-sec-2').classList.remove('active');
    document.getElementById('btn-sec-3').classList.remove('active');
    
    // Mostra a seção desejada e pinta o botão
    document.getElementById('sec-' + secaoIndex).style.display = 'grid'; // Ou 'block'
    document.getElementById('btn-sec-' + secaoIndex).classList.add('active');
};

// Função para mostrar/esconder o Preview da Imagem (Botão Visualizar)
window.togglePreview = function() {
    const preview = document.querySelector('.preview-side');
    if (preview) {
        preview.classList.toggle('show');
    }
};

// Como apagamos a sanfona antiga, vamos neutralizar o verificarSanfonaInteligente
// para ele não dar erro no console procurando as setinhas antigas.
window.verificarSanfonaInteligente = function() {
    // Desativado intencionalmente para o novo layout de Abas.
    // Você pode reativar a lógica depois para trocar a aba ativa automaticamente!
    return; 
};

// ==========================================
// LÓGICA DO MENU DO USUÁRIO (DROPDOWN)
// ==========================================
window.toggleUserMenu = function(event) {
    event.stopPropagation(); // Evita que o clique vaze
    const painel = document.getElementById('painel-user-menu');
    
    // Alterna a visibilidade
    painel.classList.toggle('painel-visivel');
};

// Fechar o menu do usuário ao clicar fora dele
document.addEventListener('click', (e) => {
    const painelUser = document.getElementById('painel-user-menu');
    const btnUser = document.getElementById('user-display');
    
    // Se o menu estiver aberto, e o clique NÃO for dentro do menu, e o clique NÃO for no botão que abre... ele fecha!
    if (painelUser && painelUser.classList.contains('painel-visivel')) {
        if (!painelUser.contains(e.target) && !btnUser.contains(e.target)) {
            painelUser.classList.remove('painel-visivel');
        }
    }
});

window.abrirConfiguracoes = function() {
    document.getElementById('modal-config').style.display = 'flex';
    // Esconde o menu do usuário que ficou aberto
    document.getElementById('painel-user-menu').classList.add('painel-oculto');
};

window.fecharConfiguracoes = function() {
    document.getElementById('modal-config').style.display = 'none';
};

window.trocarAbaConfig = function(aba) {
    document.querySelectorAll('.cfg-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.cfg-panel').forEach(p => p.style.display = 'none');
    
    event.target.classList.add('active');
    document.getElementById('cfg-aba-' + aba).style.display = 'block';
};

window.mostrarNomeArquivo = function(input) {
    const fileName = input.files[0] ? input.files[0].name : "Nenhum arquivo selecionado";
    document.getElementById('cfg-file-name').innerText = fileName;
};

// ==========================================
// MOTOR DE CONFIGURAÇÕES (FIREBASE + BASE64)
// ==========================================

// Referências seguras no Banco de Dados (usando o 'db' oficial do sistema)
const dbConfigClientes = db.ref('configuracoes/clientes');
const dbConfigAnalistas = db.ref('configuracoes/analistas');

// ----------------------------------------------------
// 1. GESTÃO DE CLIENTES & LOGOS (COM MODO EDIÇÃO)
// ----------------------------------------------------

window.editarCliente = function(id, nome, apelidos) {
    document.getElementById('cfg-edit-cliente-id').value = id;
    document.getElementById('cfg-nome-cliente').value = nome || '';
    if(document.getElementById('cfg-apelidos-cliente')) document.getElementById('cfg-apelidos-cliente').value = apelidos || '';
    
    // Muda a cara do botão para o modo de Edição
    const btnSalvar = document.querySelector('#cfg-aba-clientes .btn-cfg-salvar');
    btnSalvar.innerText = "🔄 ATUALIZAR CLIENTE";
    btnSalvar.style.background = "#F59E0B";
    
    document.getElementById('btn-cancelar-edit-cliente').style.display = 'block';
};

window.salvarNovoCliente = function() {
    const editId = document.getElementById('cfg-edit-cliente-id').value;
    const nome = document.getElementById('cfg-nome-cliente').value.trim();
    const apelidosStr = document.getElementById('cfg-apelidos-cliente') ? document.getElementById('cfg-apelidos-cliente').value.trim() : '';
    const fileInput = document.getElementById('cfg-logo-cliente');

    if (!nome) return alert('⚠️ Por favor, digite o nome oficial do cliente!');
    
    const btnSalvar = document.querySelector('#cfg-aba-clientes .btn-cfg-salvar');
    btnSalvar.innerText = "⏳ Salvando...";
    btnSalvar.style.background = "#F59E0B";

    const file = fileInput.files[0];
    
    // Função interna super blindada (Não apaga a logo velha se não enviar uma nova!)
    const enviarParaNuvem = (logoBase64) => {
        let payload = { nome: nome, apelidos: apelidosStr };
        if (logoBase64 !== null) payload.logo = logoBase64; 
        
        if (editId) {
            // Modo Edição
            dbConfigClientes.child(editId).update(payload)
                .then(() => limparFormularioCliente())
                .catch(err => { alert("Erro: " + err.message); limparFormularioCliente(); });
        } else {
            // Modo Criação
            if (logoBase64 === null) payload.logo = '';
            dbConfigClientes.push(payload)
                .then(() => limparFormularioCliente())
                .catch(err => { alert("Erro: " + err.message); limparFormularioCliente(); });
        }
    };

    if (file) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = function(e) {
            const img = new Image();
            img.src = e.target.result;
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 200; 
                let width = img.width; let height = img.height;
                if (width > height && width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                else if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                enviarParaNuvem(canvas.toDataURL('image/png', 0.8)); 
            };
        };
    } else {
        enviarParaNuvem(null); // null avisa o sistema que a logo velha deve ser mantida
    }
};

window.limparFormularioCliente = function() {
    document.getElementById('cfg-edit-cliente-id').value = '';
    document.getElementById('cfg-nome-cliente').value = '';
    if(document.getElementById('cfg-apelidos-cliente')) document.getElementById('cfg-apelidos-cliente').value = '';
    document.getElementById('cfg-logo-cliente').value = '';
    document.getElementById('cfg-file-name').innerText = 'Nenhum arquivo selecionado';
    
    const btnSalvar = document.querySelector('#cfg-aba-clientes .btn-cfg-salvar');
    if (btnSalvar) {
        btnSalvar.innerText = "➕ Salvar Cliente";
        btnSalvar.style.background = "#10B981";
    }
    
    const btnCancel = document.getElementById('btn-cancelar-edit-cliente');
    if (btnCancel) btnCancel.style.display = 'none';

    if (typeof window.mostrarToast === 'function') window.mostrarToast('✅ Operação concluída com sucesso!', 'success');
};

window.removerCliente = function(idBanco, nomeCliente) {
    if (confirm(`⚠️ ATENÇÃO: Tem certeza que deseja remover o cliente "${nomeCliente}"?`)) {
        dbConfigClientes.child(idBanco).remove().then(() => {
            if (typeof window.mostrarToast === 'function') window.mostrarToast('🗑️ Cliente removido.', 'info');
        });
    }
};

// Monitora o Banco em Tempo Real (Com Botão de Edição)
window.bancoDeLogos = {}; 
window.bancoDeApelidos = {}; 

dbConfigClientes.on('value', (snapshot) => {
    const lista = document.getElementById('lista-cfg-clientes');
    const datalist = document.getElementById('lista-clientes'); 
    
    if(lista) lista.innerHTML = ''; 
    let htmlDatalist = ''; 
    window.bancoDeLogos = {}; window.bancoDeApelidos = {};
    
    if (!snapshot.exists()) {
        if(lista) lista.innerHTML = '<li style="color: #64748B; font-size: 12px; justify-content: center;">Nenhum cliente cadastrado ainda.</li>';
        if (datalist) datalist.innerHTML = '';
        return;
    }

    snapshot.forEach((childSnapshot) => {
        const key = childSnapshot.key;
        const data = childSnapshot.val();
        
        if (data.nome) {
            const nomeUpper = data.nome.trim().toUpperCase();
            if (data.logo) window.bancoDeLogos[nomeUpper] = data.logo;
            
            // Alimenta a inteligência de correlação!
            if (data.apelidos) {
                window.bancoDeApelidos[nomeUpper] = data.apelidos.split(',').map(a => a.trim().toUpperCase()).filter(a => a !== '');
            }

            htmlDatalist += `<option value="${data.nome}"></option>`;
        }

        const preview = data.logo ? `<img src="${data.logo}" style="height: 24px; max-width: 60px; object-fit: contain; background: white; padding: 2px; border-radius: 4px;">` : `<span style="font-size: 18px;">🏢</span>`;
        const badgeApelidos = (data.apelidos) ? `<div style="font-size: 9px; color: #38BDF8; margin-top: 3px;">Siglas: ${data.apelidos}</div>` : '';
        const safeNome = data.nome ? data.nome.replace(/'/g, "\\'") : '';
        const safeApelidos = data.apelidos ? data.apelidos.replace(/'/g, "\\'") : '';

        if(lista) {
            lista.innerHTML += `
                <li style="align-items: flex-start; display: flex; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        ${preview}
                        <div>
                            <strong style="color: #F8FAFC; font-size: 13px;">${data.nome}</strong>
                            ${badgeApelidos}
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 2px;">
                        <button class="btn-remover-item" onclick="editarCliente('${key}', '${safeNome}', '${safeApelidos}')" style="background: #334155; color: #F8FAFC; border: 1px solid #475569;">✏️ Editar</button>
                        <button class="btn-remover-item" onclick="removerCliente('${key}', '${safeNome}')">✖ Remover</button>
                    </div>
                </li>
            `;
        }
    });
    
    if (datalist) datalist.innerHTML = htmlDatalist;
    if(typeof window.update === 'function') window.update();
});

// ----------------------------------------------------
// 2. GESTÃO DE ANALISTAS DA EQUIPE
// ----------------------------------------------------

window.salvarNovoAnalista = function() {
    const nome = document.getElementById('cfg-nome-analista').value.trim();
    const turno = document.getElementById('cfg-turno-analista').value;

    if (!nome) return alert('⚠️ Por favor, digite o nome do analista!');

    dbConfigAnalistas.push({ nome: nome, turno: turno }).then(() => {
        document.getElementById('cfg-nome-analista').value = '';
        if (typeof window.mostrarToast === 'function') window.mostrarToast('✅ Analista adicionado!', 'success');
    });
};

window.removerAnalista = function(idBanco, nomeAnalista) {
    if (confirm(`⚠️ Tem certeza que deseja remover o analista "${nomeAnalista}" da equipe?`)) {
        dbConfigAnalistas.child(idBanco).remove().then(() => {
            if (typeof window.mostrarToast === 'function') window.mostrarToast('🗑️ Analista removido.', 'info');
        });
    }
};

// Monitora o Banco em Tempo Real (Com Auto-Completar no Login)
dbConfigAnalistas.on('value', (snapshot) => {
    const lista = document.getElementById('lista-cfg-analistas');
    const selectLogin = document.getElementById('login-nome');
    
    lista.innerHTML = '';
    
    // Reseta o select do Login mantendo a primeira opção E INJETA A CHAVE MESTRA
    if (selectLogin) {
        selectLogin.innerHTML = `
            <option value="" disabled selected>Selecione na lista...</option>
            <option value="Gestão ITS">Gestão ITS</option>
        `;
    }
    
    if (!snapshot.exists()) {
        lista.innerHTML = '<li style="color: #64748B; font-size: 12px; justify-content: center;">Nenhum analista cadastrado ainda.</li>';
        return;
    }

    // Cria as caixinhas (grupos) para organizar o pessoal do Login
    const gruposTurno = { 'Gestão': [], 'Manhã': [], 'Tarde': [], 'Madrugada': [] };

    snapshot.forEach((childSnapshot) => {
        const key = childSnapshot.key;
        const data = childSnapshot.val();
        
        let turnoBadge = '';
        if (data.turno === 'Manhã') turnoBadge = '🌅 Manhã';
        else if (data.turno === 'Tarde') turnoBadge = '☀️ Tarde';
        else if (data.turno === 'Madrugada') turnoBadge = '🌙 Madrugada';
        else turnoBadge = '💼 Gestão';

        // 1. Desenha o analista na lista de Configurações
        lista.innerHTML += `
            <li>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 16px;">👤</span>
                    <div>
                        <strong style="color: #F8FAFC; display: block; font-size: 13px;">${data.nome}</strong>
                        <span style="color: #94A3B8; font-size: 10px; background: #0F172A; padding: 2px 6px; border-radius: 4px;">${turnoBadge}</span>
                    </div>
                </div>
                <button class="btn-remover-item" onclick="removerAnalista('${key}', '${data.nome}')">✖ Remover</button>
            </li>
        `;

        // 2. Separa os analistas nas caixinhas por turno
        if (data.nome && data.turno && gruposTurno[data.turno] !== undefined) {
            gruposTurno[data.turno].push(data.nome);
        }
    });

    // 3. 🪄 MÁGICA: Constrói os optgroups do Login na ordem correta
    if (selectLogin) {
        const titulosTurno = { 'Gestão': 'Gestão', 'Manhã': 'Turno da Manhã', 'Tarde': 'Turno da Tarde', 'Madrugada': 'Turno da Madrugada' };
        
        ['Gestão', 'Manhã', 'Tarde', 'Madrugada'].forEach(turno => {
            if (gruposTurno[turno].length > 0) {
                let optgroup = document.createElement('optgroup');
                optgroup.label = titulosTurno[turno];
                
                // Coloca os nomes em ordem alfabética antes de injetar
                gruposTurno[turno].sort().forEach(nome => {
                    let option = document.createElement('option');
                    option.value = nome;
                    option.innerText = nome;
                    optgroup.appendChild(option);
                });
                
                selectLogin.appendChild(optgroup);
            }
        });
    }
});

// ==========================================
// MÓDULO DE LEITURA DE EXCEL (ROBÔ BLINDADO PARA DATAS, SERIAL EXCEL + AUDITORIA)
// ==========================================
window.processarPlanilhasExcel = async function() {
    const fileInfra = document.getElementById('upload-infra').files[0];
    const fileDba = document.getElementById('upload-dba').files[0];
    const fileWindows = document.getElementById('upload-windows').files[0];
    const fileLinux = document.getElementById('upload-linux').files[0];

    if (!fileInfra && !fileDba && !fileWindows && !fileLinux) {
        if(typeof window.mostrarToast === 'function') window.mostrarToast("Nenhuma planilha anexada para processamento!", "warning");
        return;
    }

    if(typeof window.mostrarToast === 'function') window.mostrarToast("🤖 Lendo calendário do mês... Aguarde.", "info");

    let responsavelUpload = "Analista Desconhecido";
    const userDisplay = document.getElementById('user-display');
    if (userDisplay && userDisplay.innerText.includes('👤')) {
        responsavelUpload = userDisplay.innerText.replace('👤', '').trim();
    }
    const dataUpload = `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;

    const extrairMesCompleto = (file) => {
        return new Promise((resolve) => {
            if (!file) return resolve(null);

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    const primeiraAba = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[primeiraAba];
                    
                    const matriz = XLSX.utils.sheet_to_json(worksheet, {header: 1, raw: false, defval: ""});
                    
                    let dadosDoMes = {};
                    let diaEsperado = 1;

                    for (let linha = 0; linha < matriz.length; linha++) {
                        for (let coluna = 0; coluna < matriz[linha].length; coluna++) {
                            
                            let strValor = String(matriz[linha][coluna]).trim();
                            if(!strValor) continue;

                            let isMatch = false;
                            let diaEncontrado = null;
                            
                            // 1. Número puro (Ex: 1, 15, 31)
                            if (/^\d{1,2}$/.test(strValor)) {
                                diaEncontrado = parseInt(strValor, 10);
                            }
                            // 2. Data Serial do Excel (Ex: 46235) -> Mágica para ler a planilha DBA!
                            else if (/^\d{5}$/.test(strValor) && parseInt(strValor, 10) > 40000) {
                                let dataJS = new Date((parseInt(strValor, 10) - 25569) * 86400 * 1000);
                                diaEncontrado = dataJS.getUTCDate();
                            }
                            // 3. Data em formato texto (Ex: 11/08/2026 ou 2026-08-11)
                            else if (strValor.includes('/') || strValor.includes('-')) {
                                let d = new Date(strValor);
                                if (!isNaN(d.getTime())) {
                                    if (d.getDate() === diaEsperado || d.getUTCDate() === diaEsperado) {
                                        diaEncontrado = diaEsperado; 
                                    }
                                } else {
                                    let partes = strValor.split(/[T\s]/)[0].split(/[/\-]/);
                                    if (partes.length === 3) {
                                        if (partes[0].length === 2 && partes[2].length === 4) diaEncontrado = parseInt(partes[0], 10);
                                        else if (partes[0].length === 4 && partes[2].length === 2) diaEncontrado = parseInt(partes[2], 10);
                                    }
                                }
                            }

                            if (diaEncontrado === diaEsperado) {
                                isMatch = true;
                            }

                            if (isMatch) {
                                let nomes = [];
                                for(let i = 1; i <= 4; i++) {
                                    if (matriz[linha + i] && matriz[linha + i][coluna]) {
                                        let txt = String(matriz[linha + i][coluna]).trim();
                                        if (!txt) continue;
                                        
                                        // BLOQUEIO: Para de ler os nomes se bater na data do próximo dia
                                        let isDateBlocker = false;
                                        if (/^\d{1,2}$/.test(txt)) isDateBlocker = true;
                                        else if (/^\d{5}$/.test(txt) && parseInt(txt, 10) > 40000) isDateBlocker = true;
                                        else if ((txt.includes('/') || txt.includes('-')) && txt.length < 15) {
                                             let pts = txt.split(/[T\s]/)[0].split(/[/\-]/);
                                             if (pts.length === 3 && (pts[2].length === 4 || pts[0].length === 4)) isDateBlocker = true;
                                        }
                                        
                                        if (isDateBlocker) break; 
                                        
                                        txt = txt.replace(/[\n\r]+/g, ' '); 
                                        txt = txt.replace(/\s*\/\s*/g, ' / ');
                                        txt = txt.replace(/\s+/g, ' ').trim();
                                        
                                        if (txt && txt !== '/') nomes.push(txt);
                                    }
                                }

                                let finalName = nomes.join(' / ').replace(/\s*\/\s*\/\s*/g, ' / ').trim();
                                finalName = finalName.replace(/^[/\s]+|[/\s]+$/g, '').trim();

                                dadosDoMes[diaEsperado] = finalName || "Sem plantonista";
                                diaEsperado++; 
                                if (diaEsperado > 31) break; 
                            }
                        }
                        if (diaEsperado > 31) break;
                    }
                    resolve(dadosDoMes);
                } catch (error) {
                    console.error("Erro ao ler o Excel:", error);
                    resolve(null);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    };

    try {
        const pInfra = await extrairMesCompleto(fileInfra);
        const pDba = await extrairMesCompleto(fileDba);
        const pWindows = await extrairMesCompleto(fileWindows);
        const pLinux = await extrairMesCompleto(fileLinux);

        const ref = firebase.database().ref('configuracoes/escalas_mensais');
        
        if (pInfra) await ref.child('infra').set(pInfra);
        if (pDba) await ref.child('dba').set(pDba);
        if (pWindows) await ref.child('windows').set(pWindows);
        if (pLinux) await ref.child('linux').set(pLinux);
        
        await ref.child('metadados').set({
            data: dataUpload,
            responsavel: responsavelUpload,
            timestamp: Date.now()
        });
        
        if(typeof window.mostrarToast === 'function') window.mostrarToast("✅ Calendário mensal e Trocas de Bastão salvos!", "success");
        
        document.getElementById('upload-infra').value = '';
        document.getElementById('upload-dba').value = '';
        document.getElementById('upload-windows').value = '';
        document.getElementById('upload-linux').value = '';

    } catch (error) {
        console.error("Falha geral:", error);
        if(typeof window.mostrarToast === 'function') window.mostrarToast("Erro ao processar as planilhas.", "error");
    }
};

// ==========================================
// MÓDULO DE PASSAGEM DE TURNO ENTERPRISE (EDITÁVEL E INTELIGENTE)
// ==========================================

window.nomeResponsavelPassagem = "Não definido";

window.fecharPassagemTurno = () => { document.getElementById('modal-passagem').style.display = 'none'; };

window.assumirPassagem = function() {
    let nome = "";
    
    // Tenta ler do crachá do usuário logado na barra superior
    const userDisplay = document.getElementById('user-display');
    if (userDisplay && userDisplay.innerText.includes('👤')) {
        nome = userDisplay.innerText.replace('👤', '').trim();
    } else {
        // Fallback apenas se o usuário de alguma forma bizarra não estiver logado
        nome = prompt("Qual o seu nome?");
    }
    
    if (nome) {
        window.nomeResponsavelPassagem = nome;
        const labelResp = document.getElementById('passagem-responsavel');
        if(labelResp) labelResp.innerHTML = `<span style="color: #10B981; font-weight: bold;">${nome}</span>`;
        if(typeof window.mostrarToast === 'function') window.mostrarToast("Você é o responsável por esta passagem!", "success");
    }
};

window.adicionarLinhaParada = function(cli = '', ini = '', fim = '', desc = '') {
    const container = document.getElementById('lista-paradas-programadas');
    if(!container) return;
    const msgVazia = container.querySelector('.msg-sem-parada');
    if (msgVazia) msgVazia.remove();

    const div = document.createElement('div');
    div.className = 'linha-parada';
    div.style = 'display: flex; flex-direction: column; gap: 5px; background: #0F172A; padding: 10px; border-radius: 6px; border: 1px solid #475569;';
    div.innerHTML = `
        <div style="display: flex; gap: 10px; align-items: center;">
            <input type="text" placeholder="Cliente/Host" value="${cli}" class="input-parada-cli" style="flex: 1; padding: 8px; font-size: 12px; background: #1E293B; border: 1px solid #475569; color: white; border-radius: 4px;">
            <input type="text" placeholder="Início (Ex: 23:00)" value="${ini}" class="input-parada-ini" style="width: 140px; padding: 8px; font-size: 12px; background: #1E293B; border: 1px solid #475569; color: white; border-radius: 4px;">
            <input type="text" placeholder="Fim (Ex: 04:00)" value="${fim}" class="input-parada-fim" style="width: 140px; padding: 8px; font-size: 12px; background: #1E293B; border: 1px solid #475569; color: white; border-radius: 4px;">
            <button onclick="aplicarRealce(this)" style="background: transparent; color: #FCD34D; border: 1px solid #78350F; padding: 6px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;" title="Realçar texto da descrição">🖍️</button>
            <button onclick="this.parentElement.parentElement.remove()" style="background: transparent; color: #EF4444; border: none; cursor: pointer; font-size: 14px;">✖</button>
        </div>
        <textarea placeholder="Descrição da parada..." class="input-parada-desc" rows="1" style="width: 100%; padding: 8px; font-size: 12px; background: #1E293B; border: 1px solid #475569; color: #94A3B8; border-radius: 4px; resize: vertical; box-sizing: border-box;">${desc}</textarea>
    `;
    container.appendChild(div);
    if (typeof window.ajustarTodasTextareas === 'function') window.ajustarTodasTextareas();
};

window.adicionarLinhaAvisoCliente = function(cli = '', txt = '') {
    const container = document.getElementById('lista-avisos-cliente');
    const msgVazia = container.querySelector('.msg-sem-aviso');
    if (msgVazia) msgVazia.remove();

    const div = document.createElement('div');
    div.className = 'linha-aviso-cliente';
    div.style = 'display: flex; flex-direction: column; gap: 5px; background: #0F172A; padding: 10px; border-radius: 6px; border: 1px solid #334155;';
    div.innerHTML = `
        <div style="display: flex; justify-content: space-between;">
            <input type="text" placeholder="Nome do Cliente (Ex: Cogna, Libbs)..." value="${cli}" class="input-aviso-cli" style="width: 60%; padding: 6px; font-size: 12px; background: #1E293B; border: 1px solid #475569; color: #38BDF8; font-weight: bold; border-radius: 4px;">
            <div style="display: flex; gap: 8px; align-items: center;">
                
                <!-- BOTÕES SVGs COMPACTOS (DESFAZER/REFAZER) -->
                <div style="display: flex; gap: 6px; border-right: 1px solid #475569; padding-right: 10px; margin-right: 4px;">
                    <button type="button" onclick="desfazerTexto(this)" style="background: transparent; color: #94A3B8; border: none; padding: 0; cursor: pointer; transition: 0.2s; display: flex; align-items: center;" title="Desfazer (Ctrl+Z)" onmouseover="this.style.color='#38BDF8'" onmouseout="this.style.color='#94A3B8'">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>
                    </button>
                    <button type="button" onclick="refazerTexto(this)" style="background: transparent; color: #94A3B8; border: none; padding: 0; cursor: pointer; transition: 0.2s; display: flex; align-items: center;" title="Refazer (Ctrl+Y)" onmouseover="this.style.color='#38BDF8'" onmouseout="this.style.color='#94A3B8'">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"></path><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"></path></svg>
                    </button>
                </div>

                <button onclick="inserirLinhaDivisoria(this)" style="background: transparent; color: #94A3B8; border: 1px solid #475569; padding: 2px 8px; border-radius: 4px; font-size: 10px; cursor: pointer; font-weight: bold; transition: 0.2s;" title="Inserir linha divisória" onmouseover="this.style.background='#1E293B'; this.style.color='#F8FAFC'" onmouseout="this.style.background='transparent'; this.style.color='#94A3B8'">➖ DIVIDIR</button>
                <button onclick="aplicarRealce(this)" style="background: #422006; color: #FCD34D; border: 1px solid #78350F; padding: 2px 8px; border-radius: 4px; font-size: 10px; cursor: pointer; font-weight: bold;" title="Selecione um texto abaixo e clique para destacar">🖍️ DESTACAR</button>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: transparent; color: #EF4444; border: none; cursor: pointer; font-size: 14px; margin-left: 4px;">✖</button>
            </div>
        </div>
        <textarea placeholder="Descreva os procedimentos ou tratativas deste cliente..." class="input-aviso-texto" rows="1" style="width: 100%; padding: 8px; font-size: 12px; background: #1E293B; border: 1px solid #475569; color: white; border-radius: 4px; resize: vertical; box-sizing: border-box;">${txt}</textarea>
    `;
    container.appendChild(div);
    if (typeof window.ajustarTodasTextareas === 'function') window.ajustarTodasTextareas();
};

window.inserirLinhaDivisoria = function(elemento) {
    let textarea = null;
    if (typeof elemento === 'string') {
        textarea = document.getElementById(elemento);
    } else {
        const container = elemento.closest('div[class^="linha-"]');
        if (container) textarea = container.querySelector('textarea');
    }
    if (!textarea) return;

    // Foca na caixa (obrigatório para o comando do navegador funcionar)
    textarea.focus({ preventScroll: true });

    const linhaPontilhada = "\n\n--------------------------------------------------\n\n";

    // A MÁGICA: Em vez de forçar o texto, mandamos o navegador "digitar", salvando no Ctrl+Z!
    if (!document.execCommand('insertText', false, linhaPontilhada)) {
        // Fallback de segurança caso falhe em navegadores antigos
        const cursor = textarea.selectionStart;
        const text = textarea.value;
        textarea.value = text.substring(0, cursor) + linhaPontilhada + text.substring(textarea.selectionEnd);
        textarea.setSelectionRange(cursor + linhaPontilhada.length, cursor + linhaPontilhada.length);
    }

    if (typeof window.autoExpandTextarea === 'function') window.autoExpandTextarea(textarea);
};

window.renderizarLinhaPendencia = function(cli = '', host = '', status = 'EM ABERTO', falha = '', chamado = '') {
    const container = document.getElementById('lista-pendencias-passagem');
    const msgVazia = container.querySelector('.msg-sem-pendencia');
    if (msgVazia) msgVazia.remove();

    const div = document.createElement('div');
    div.className = 'linha-pendencia';
    div.style = 'background: #0F172A; padding: 10px; border-radius: 6px; border: 1px solid #047857; display: flex; flex-direction: column; gap: 8px;';
    
    div.innerHTML = `
        <div style="display: flex; gap: 10px; align-items: center;">
            <input type="text" placeholder="Cliente" value="${cli}" class="p-cli" style="width: 25%; padding: 6px; font-size: 11px; background: #1E293B; border: 1px solid #475569; color: white; font-weight: bold;">
            <input type="text" placeholder="Host / Serviço" value="${host}" class="p-host" style="flex: 1; padding: 6px; font-size: 11px; background: #1E293B; border: 1px solid #475569; color: white;">
            <select class="p-status" style="width: 120px; padding: 6px; font-size: 11px; background: #1E293B; border: 1px solid #475569; color: ${status === 'FOLLOW-UP' ? '#F59E0B' : '#EF4444'}; font-weight: bold;">
                <option value="EM ABERTO" ${status === 'EM ABERTO' ? 'selected' : ''}>EM ABERTO</option>
                <option value="FOLLOW-UP" ${status === 'FOLLOW-UP' ? 'selected' : ''}>FOLLOW-UP</option>
            </select>
            <input type="text" placeholder="Chamado ITS" value="${chamado}" class="p-chamado" style="width: 100px; padding: 6px; font-size: 11px; background: #1E293B; border: 1px solid #475569; color: white;">
            <button onclick="aplicarRealce(this)" style="background: transparent; color: #FCD34D; border: 1px solid #78350F; padding: 4px 6px; border-radius: 4px; font-size: 10px; cursor: pointer;" title="Realçar texto da observação">🖍️</button>
            <button onclick="this.parentElement.parentElement.remove()" style="background: transparent; color: #EF4444; border: none; cursor: pointer; font-size: 14px;">✖</button>
        </div>
        <textarea placeholder="Observações operacionais..." class="p-obs" rows="1" style="width: 100%; padding: 6px; font-size: 11px; background: #1E293B; border: 1px solid #475569; color: #94A3B8; box-sizing: border-box;">${falha}</textarea>
    `;
    container.appendChild(div);
    if (typeof window.ajustarTodasTextareas === 'function') window.ajustarTodasTextareas();
};

// A INTELIGÊNCIA DE ABERTURA: Puxa Radar, Excel e mescla com a Herança
window.abrirPassagemTurno = async function() {
    document.getElementById('lista-avisos-cliente').innerHTML = '<div class="msg-sem-aviso" style="font-size: 12px; color: #64748B; text-align: center; font-style: italic;">Nenhum aviso específico.</div>';
    document.getElementById('lista-paradas-programadas').innerHTML = '<div class="msg-sem-parada" style="font-size: 12px; color: #64748B; text-align: center; font-style: italic;">Nenhuma parada programada inserida.</div>';
    document.getElementById('lista-pendencias-passagem').innerHTML = '<div class="msg-sem-pendencia" style="font-size: 12px; color: #64748B; text-align: center; font-style: italic;">Nenhuma pendência ativa no radar no momento.</div>';
    document.getElementById('passagem-avisos').value = '';
    document.getElementById('escala-obs').value = '';

    let mapPendencias = {};

    // 1. Puxa as Pendências Automáticas do Radar
    if (typeof chamadosDoTurno !== 'undefined' && chamadosDoTurno.length > 0) {
        let estadoRecente = {};
        chamadosDoTurno.forEach(log => {
            if (log.form) {
                let chave = `${log.form.cliente}-${log.form.host}`;
                if (!estadoRecente[chave] || log.timestamp > estadoRecente[chave].timestamp) {
                    estadoRecente[chave] = log;
                }
            }
        });

        Object.values(estadoRecente).forEach(log => {
            if (log.form.status === 'EM ABERTO' || log.form.status === 'FOLLOW-UP') {
                let chaveObj = `${log.form.cliente}-${log.form.host}`;
                mapPendencias[chaveObj] = {
                    cliente: log.form.cliente,
                    host: log.form.host,
                    status: log.form.status,
                    chamado: log.form.itssm || log.form.chamado || '',
                    obs: log.form.falha || ''
                };
            }
        });
    }

    // 2. Puxa as Escalas Mensais (A Base do Excel entra primeiro!)
    try {
        const snapshot = await firebase.database().ref('configuracoes/escalas_mensais').once('value');
        const diaHoje = new Date().getDate(); 
        
        const calcularFimPlantao = (equipeBase) => {
            if (!equipeBase || !equipeBase[diaHoje]) return '';
            let atual = String(equipeBase[diaHoje]).replace(/\n/g, ' / ');
            let dataG = new Date();
            let mesAno = `${String(dataG.getMonth()+1).padStart(2, '0')}/${dataG.getFullYear()}`;
            
            if (atual.includes('/')) return `${String(diaHoje).padStart(2, '0')}/${mesAno} às 18:00`;
            
            for (let d = diaHoje + 1; d <= 31; d++) {
                if (equipeBase[d]) {
                    let futuro = String(equipeBase[d]).replace(/\n/g, ' / ');
                    if (futuro !== atual) return `${String(d).padStart(2, '0')}/${mesAno} às 18:00`;
                }
            }
            return 'Fim do Mês';
        };

        if (snapshot.exists()) {
            const base = snapshot.val();
            document.getElementById('escala-infra').value = (base.infra && base.infra[diaHoje]) ? String(base.infra[diaHoje]).replace(/\n/g, ' / ') : '-';
            document.getElementById('ate-infra').value = calcularFimPlantao(base.infra);

            document.getElementById('escala-dba').value = (base.dba && base.dba[diaHoje]) ? String(base.dba[diaHoje]).replace(/\n/g, ' / ') : '-';
            document.getElementById('ate-dba').value = calcularFimPlantao(base.dba);

            document.getElementById('escala-windows').value = (base.windows && base.windows[diaHoje]) ? String(base.windows[diaHoje]).replace(/\n/g, ' / ') : '-';
            document.getElementById('ate-windows').value = calcularFimPlantao(base.windows);

            document.getElementById('escala-linux').value = (base.linux && base.linux[diaHoje]) ? String(base.linux[diaHoje]).replace(/\n/g, ' / ') : '-';
            document.getElementById('ate-linux').value = calcularFimPlantao(base.linux);
        }
    } catch (err) {}

    // 3. Puxa a Herança do Turno Anterior (Para sobrescrever o Excel se houver edição MANUAL HOJE)
    try {
        const lastPassagemSnap = await firebase.database().ref('passagens_turno').orderByKey().limitToLast(1).once('value');
        if (lastPassagemSnap.exists()) {
            const lastData = Object.values(lastPassagemSnap.val())[0];
            const dataHojeString = new Date().toLocaleDateString('pt-BR');

            if (lastData.avisos && lastData.avisos !== "Sem avisos operacionais para este turno.") document.getElementById('passagem-avisos').value = lastData.avisos;
            if (lastData.avisos_clientes) lastData.avisos_clientes.forEach(ac => window.adicionarLinhaAvisoCliente(ac.cliente, ac.texto));
            if (lastData.paradas) lastData.paradas.forEach(p => window.adicionarLinhaParada(p.cliente, p.inicio, p.fim, (p.desc || '')));
            
            // --- A MÁGICA DA ESCALA (PERSISTÊNCIA INTELIGENTE) ---
            if (lastData.plantonistas) {
                if (lastData.plantonistas.obs) document.getElementById('escala-obs').value = lastData.plantonistas.obs;
                
                // Verifica se a última passagem foi hoje
                const isMesmoDia = (lastData.data === dataHojeString);

                // INFRA: Sobrescreve se for o mesmo dia (edição manual) OU se o Excel estiver vazio (-)
                if (isMesmoDia || document.getElementById('escala-infra').value === '-') {
                    if (lastData.plantonistas.infra && lastData.plantonistas.infra !== '-') document.getElementById('escala-infra').value = lastData.plantonistas.infra;
                    if (lastData.plantonistas.ate_infra) document.getElementById('ate-infra').value = lastData.plantonistas.ate_infra;
                }

                // DBA: A salvação! Se o Excel não conseguiu ler, ele puxa o que você digitou ontem e mantém!
                if (isMesmoDia || document.getElementById('escala-dba').value === '-') {
                    if (lastData.plantonistas.dba && lastData.plantonistas.dba !== '-') document.getElementById('escala-dba').value = lastData.plantonistas.dba;
                    if (lastData.plantonistas.ate_dba) document.getElementById('ate-dba').value = lastData.plantonistas.ate_dba;
                }

                // WINDOWS
                if (isMesmoDia || document.getElementById('escala-windows').value === '-') {
                    if (lastData.plantonistas.windows && lastData.plantonistas.windows !== '-') document.getElementById('escala-windows').value = lastData.plantonistas.windows;
                    if (lastData.plantonistas.ate_windows) document.getElementById('ate-windows').value = lastData.plantonistas.ate_windows;
                }

                // LINUX
                if (isMesmoDia || document.getElementById('escala-linux').value === '-') {
                    if (lastData.plantonistas.linux && lastData.plantonistas.linux !== '-') document.getElementById('escala-linux').value = lastData.plantonistas.linux;
                    if (lastData.plantonistas.ate_linux) document.getElementById('ate-linux').value = lastData.plantonistas.ate_linux;
                }
            }
            
            if (lastData.escalonamento) {
                document.getElementById('esc-win-1').value = lastData.escalonamento.win[0] || ''; document.getElementById('esc-win-2').value = lastData.escalonamento.win[1] || ''; document.getElementById('esc-win-3').value = lastData.escalonamento.win[2] || '';
                document.getElementById('esc-lin-1').value = lastData.escalonamento.lin[0] || ''; document.getElementById('esc-lin-2').value = lastData.escalonamento.lin[1] || ''; document.getElementById('esc-lin-3').value = lastData.escalonamento.lin[2] || '';
                document.getElementById('esc-bck-1').value = lastData.escalonamento.bck[0] || ''; document.getElementById('esc-bck-2').value = lastData.escalonamento.bck[1] || ''; document.getElementById('esc-bck-3').value = lastData.escalonamento.bck[2] || '';
            }

            // MESCLANDO AS PENDÊNCIAS
            if (lastData.pendencias && lastData.pendencias.length > 0) {
                lastData.pendencias.forEach(p => {
                    let chaveObj = `${p.cliente}-${p.host}`;
                    if (mapPendencias[chaveObj]) {
                        if (p.obs) mapPendencias[chaveObj].obs = p.obs;
                        if (p.chamado && !mapPendencias[chaveObj].chamado) mapPendencias[chaveObj].chamado = p.chamado;
                    } else {
                        mapPendencias[chaveObj] = {
                            cliente: p.cliente,
                            host: p.host,
                            status: p.status,
                            chamado: p.chamado || '',
                            obs: p.obs || ''
                        };
                    }
                });
            }
        }
    } catch (err) {
        console.warn("Nenhum histórico anterior para herdar.", err);
    }

    // 4. Imprime as pendências mescladas na tela
    Object.values(mapPendencias).forEach(p => {
        window.renderizarLinhaPendencia(p.cliente, p.host, p.status, p.obs, p.chamado);
    });

    // Força todas as gavetas a iniciarem fechadas para limpar a tela
    document.querySelectorAll('#modal-passagem .sanfona-conteudo').forEach(el => el.classList.add('fechada'));
    document.querySelectorAll('#modal-passagem .sanfona-seta').forEach(el => el.classList.add('fechada'));

    document.getElementById('modal-passagem').style.display = 'flex';
    
    if (typeof window.ajustarTodasTextareas === 'function') window.ajustarTodasTextareas();
};

window.salvarPassagemTurno = async function() {
    if(!window.nomeResponsavelPassagem || window.nomeResponsavelPassagem === "Não definido") return;

    if(typeof window.mostrarToast === 'function') window.mostrarToast("⏳ Registrando passagem na nuvem...", "info");

    let dataAtual = new Date().toLocaleDateString('pt-BR');
    let horaExata = new Date().toLocaleTimeString('pt-BR');
    let hora = new Date().getHours();
    let turnoStr = (hora >= 7 && hora < 13) ? "Manhã" : (hora >= 13 && hora < 22) ? "Tarde" : "Madrugada";

    let avisosGerais = document.getElementById('passagem-avisos').value.trim();

    let avisosClientes = [];
    document.querySelectorAll('.linha-aviso-cliente').forEach(linha => {
        let cli = linha.querySelector('.input-aviso-cli').value.trim();
        let txt = linha.querySelector('.input-aviso-texto').value.trim();
        if(cli) avisosClientes.push({ cliente: cli, texto: txt });
    });

    let paradas = [];
    document.querySelectorAll('.linha-parada').forEach(linha => {
        let cli = linha.querySelector('.input-parada-cli').value.trim();
        if(cli) paradas.push({ cliente: cli, inicio: linha.querySelector('.input-parada-ini').value || '-', fim: linha.querySelector('.input-parada-fim').value || '-', desc: linha.querySelector('.input-parada-desc').value.trim() });
    });

    let pendencias = [];
    document.querySelectorAll('.linha-pendencia').forEach(linha => {
        let cli = linha.querySelector('.p-cli').value.trim();
        if(cli) pendencias.push({ cliente: cli, host: linha.querySelector('.p-host').value.trim(), status: linha.querySelector('.p-status').value, chamado: linha.querySelector('.p-chamado').value.trim(), obs: linha.querySelector('.p-obs').value.trim() });
    });

    let plantonistas = {
        infra: document.getElementById('escala-infra').value.trim(),
        ate_infra: document.getElementById('ate-infra').value.trim(),
        dba: document.getElementById('escala-dba').value.trim(),
        ate_dba: document.getElementById('ate-dba').value.trim(),
        windows: document.getElementById('escala-windows').value.trim(),
        ate_windows: document.getElementById('ate-windows').value.trim(),
        linux: document.getElementById('escala-linux').value.trim(),
        ate_linux: document.getElementById('ate-linux').value.trim(),
        obs: document.getElementById('escala-obs').value.trim()
    };

    let escalonamento = {
        win: [document.getElementById('esc-win-1').value.trim(), document.getElementById('esc-win-2').value.trim(), document.getElementById('esc-win-3').value.trim()],
        lin: [document.getElementById('esc-lin-1').value.trim(), document.getElementById('esc-lin-2').value.trim(), document.getElementById('esc-lin-3').value.trim()],
        bck: [document.getElementById('esc-bck-1').value.trim(), document.getElementById('esc-bck-2').value.trim(), document.getElementById('esc-bck-3').value.trim()]
    };

    const novaPassagem = {
        id: Date.now(), data: dataAtual, hora: horaExata, turno: turnoStr, responsavel_envio: window.nomeResponsavelPassagem,
        avisos: avisosGerais, avisos_clientes: avisosClientes, paradas: paradas, pendencias: pendencias, plantonistas: plantonistas, escalonamento: escalonamento,
        aceite: { status: "Aguardando", responsavel_aceite: "", hora_aceite: "" }
    };

    try {
        await firebase.database().ref('passagens_turno/' + novaPassagem.id).set(novaPassagem);
        if(typeof window.mostrarToast === 'function') window.mostrarToast("✅ Passagem de Turno registrada com sucesso!", "success");
        fecharPassagemTurno();
    } catch (err) {}
};

window.idPassagemPendente = null;

// O Escutador de Passagens Pendentes
firebase.database().ref('passagens_turno').orderByKey().limitToLast(1).on('value', (snapshot) => {
    if (!snapshot.exists()) return;

    snapshot.forEach((childSnapshot) => {
        const id = childSnapshot.key;
        const dados = childSnapshot.val();

        // Lógica blindada para descobrir quem está na frente da tela (Crachá ou Memória)
        let meuNome = "";
        const userDisplay = document.getElementById('user-display');
        if (userDisplay && userDisplay.innerText.includes('👤')) {
            meuNome = userDisplay.innerText.replace('👤', '').trim();
        } else {
            const salvo = localStorage.getItem('noc_user_info');
            if (salvo) meuNome = JSON.parse(salvo).nome;
        }

        // Se está aguardando aceite E não fui eu que enviei -> BLOQUEIA A TELA!
        if (dados.aceite && dados.aceite.status === "Aguardando" && dados.responsavel_envio !== meuNome) {
            window.idPassagemPendente = id;
            mostrarTelaDeAceite(dados);
        } 
        // Se alguém já aceitou E a minha tela ainda estava bloqueada -> LIBERA A TELA!
        else if (dados.aceite && dados.aceite.status === "Concluído" && window.idPassagemPendente === id) {
            document.getElementById('modal-aceite-passagem').style.display = 'none';
            window.idPassagemPendente = null;
        }
    });
});

// ==========================================
// O DETETIVE DE LINKS, E-MAILS, REALCES E DIVISÓRIAS!
// ==========================================
const formatarTextoRico = (texto) => {
    if (!texto) return '';
    let formatado = texto.replace(/</g, "&lt;").replace(/>/g, "&gt;"); // Proteção contra quebra de layout
    
    // Procura E-mails e pinta de verde vibrante
    formatado = formatado.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g, '<a href="mailto:$1" style="color: #34D399; text-decoration: underline; font-weight: bold;">📧 $1</a>');
    
    // Procura Links e pinta de azul vibrante
    formatado = formatado.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: #38BDF8; text-decoration: underline; font-weight: bold;">🔗 $1</a>');
    
    // Procura o marcador ==texto== e transforma no Marca-Texto Amarelo!
    formatado = formatado.replace(/==([^=]+)==/g, '<mark style="background: #F59E0B; color: #1E293B; padding: 2px 6px; border-radius: 4px; font-weight: 900; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">$1</mark>');

    // 🔥 NOVO: Procura a linha de traços e transforma numa linha de divisão física!
    formatado = formatado.replace(/-{10,}/g, '<hr style="border: none; border-top: 1px solid #475569; margin: 15px 0;">');

    return formatado.replace(/\n/g, '<br>');
};

// A Mágica de abrir a Passagem antiga
window.visualizarPassagemHistorica = function(key) {
    const index = window.historicoPassagensCache.findIndex(i => i.key === key);
    if (index !== -1) {
        const itemAtual = window.historicoPassagensCache[index];
        const itemAnterior = window.historicoPassagensCache[index + 1]; 
        const diffHTML = window.gerarDiffDePassagens(itemAtual.data, itemAnterior ? itemAnterior.data : null);
        
        // Manda o sistema renderizar o conteúdo apontando para o NOVO MODAL da Máquina do Tempo!
        window.mostrarTelaDeAceite(itemAtual.data, true, diffHTML, 'conteudo-auditoria-historica');
    }
};

// O Motor GIGANTE que desenha a tela (Agora com mira Laser para 2 alvos diferentes)
window.mostrarTelaDeAceite = function(dados, isLeitura = false, diffHTML = '', targetId = 'conteudo-aceite-passagem') {
    const container = document.getElementById(targetId);
    if (!container) return;

    // -- 1. GERAÇÃO DO CONTEÚDO HTML --
    let htmlAvisosClientes = '';
    if (dados.avisos_clientes && dados.avisos_clientes.length > 0) {
        htmlAvisosClientes = `<div style="border: 1px solid #334155; border-radius: 8px; padding: 15px; background: #1E293B; margin-top: 15px;">
                                <h4 style="color: #38BDF8; margin-top: 0; border-bottom: 1px solid #334155; padding-bottom: 8px;">🏢 Avisos Específicos (Clientes)</h4>`;
        dados.avisos_clientes.forEach(ac => {
            htmlAvisosClientes += `<div style="background: #0F172A; padding: 10px; border-left: 3px solid #38BDF8; margin-bottom: 8px; font-size: 13px;">
                                    <strong style="color: #F8FAFC; display: block; margin-bottom: 4px;">${ac.cliente}</strong>
                                    <span style="color: #CBD5E1; line-height: 1.4;">${formatarTextoRico(ac.texto)}</span>
                                   </div>`;
        });
        htmlAvisosClientes += `</div>`;
    }

    let htmlPendencias = '';
    if (dados.pendencias && dados.pendencias.length > 0) {
        dados.pendencias.forEach(p => {
            let cor = p.status === 'EM ABERTO' ? '#EF4444' : '#F59E0B';
            htmlPendencias += `<div style="background: #0F172A; padding: 10px; border-left: 3px solid ${cor}; margin-bottom: 8px; font-size: 13px; color: #F8FAFC;">
                                <strong>${p.cliente}</strong> | <span style="color: #CBD5E1;">${p.host}</span> <br>
                                <span style="color: #94A3B8; font-size: 11px;">Chamado: ${p.chamado || '-'}</span>
                                ${p.obs ? `<div style="margin-top: 5px; padding: 6px; background: #1E293B; color: #FCD34D; font-size: 11px; border-radius: 4px; border: 1px dashed #475569;">💬 ${formatarTextoRico(p.obs)}</div>` : ''}
                               </div>`;
        });
    } else {
        htmlPendencias = '<div style="color: #10B981; font-weight: bold; background: #064E3B; padding: 10px; border-radius: 6px;">Tudo limpo! Nenhuma pendência. 🎉</div>';
    }

    let htmlParadas = '';
    if (dados.paradas && dados.paradas.length > 0) {
        dados.paradas.forEach(p => {
            htmlParadas += `<div style="background: #0F172A; padding: 10px; border-left: 3px solid #FCA5A5; margin-bottom: 8px; font-size: 13px; color: #F8FAFC;">
                                <strong>${p.cliente}</strong> <br>
                                <span style="color: #94A3B8; font-size: 11px;">Início: ${p.inicio} | Fim: ${p.fim}</span>
                                ${p.desc ? `<div style="margin-top: 4px; color: #CBD5E1; font-size: 11px;">${formatarTextoRico(p.desc)}</div>` : ''}
                            </div>`;
        });
    } else {
        htmlParadas = '<div style="color: #64748B; font-style: italic;">Nenhuma parada programada inserida.</div>';
    }

    let pObs = (dados.plantonistas && dados.plantonistas.obs) ? `<div style="margin-top: 10px; padding: 8px; background: #422006; color: #FCD34D; border: 1px solid #78350F; border-radius: 4px; font-size: 11px;">⚠️ ${dados.plantonistas.obs}</div>` : '';
    let htmlPlantonistas = `
        <div style="border: 1px solid #334155; border-radius: 8px; padding: 15px; background: #1E293B; margin-top: 15px;">
            <h4 style="color: #A78BFA; margin-top: 0; border-bottom: 1px solid #334155; padding-bottom: 8px;">📞 Escalas de Plantão do Dia</h4>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 11px;">
                <div style="background: #0F172A; padding: 10px; border-radius: 6px; border: 1px solid #4C1D95;">
                    <strong style="color: #C4B5FD; display: block; margin-bottom: 5px;">🛠️ Infraestrutura</strong><span style="color: #F8FAFC; display: block;">${dados.plantonistas?.infra || '-'}</span>
                    <span style="color: #38BDF8; font-size: 9px; font-weight: bold; margin-top: 5px; display: block;">Até: ${dados.plantonistas?.ate_infra || '-'}</span>
                </div>
                <div style="background: #0F172A; padding: 10px; border-radius: 6px; border: 1px solid #4C1D95;">
                    <strong style="color: #C4B5FD; display: block; margin-bottom: 5px;">🗄️ DBA</strong><span style="color: #F8FAFC; display: block;">${dados.plantonistas?.dba || '-'}</span>
                    <span style="color: #38BDF8; font-size: 9px; font-weight: bold; margin-top: 5px; display: block;">Até: ${dados.plantonistas?.ate_dba || '-'}</span>
                </div>
                <div style="background: #0F172A; padding: 10px; border-radius: 6px; border: 1px solid #4C1D95;">
                    <strong style="color: #C4B5FD; display: block; margin-bottom: 5px;">🪟 Windows</strong><span style="color: #F8FAFC; display: block;">${dados.plantonistas?.windows || '-'}</span>
                    <span style="color: #38BDF8; font-size: 9px; font-weight: bold; margin-top: 5px; display: block;">Até: ${dados.plantonistas?.ate_windows || '-'}</span>
                </div>
                <div style="background: #0F172A; padding: 10px; border-radius: 6px; border: 1px solid #4C1D95;">
                    <strong style="color: #C4B5FD; display: block; margin-bottom: 5px;">🐧 Linux</strong><span style="color: #F8FAFC; display: block;">${dados.plantonistas?.linux || '-'}</span>
                    <span style="color: #38BDF8; font-size: 9px; font-weight: bold; margin-top: 5px; display: block;">Até: ${dados.plantonistas?.ate_linux || '-'}</span>
                </div>
            </div>
            ${pObs}
        </div>
    `;

    let htmlEscalonamento = '';
    if (dados.escalonamento) {
        const d = dados.escalonamento;
        htmlEscalonamento = `
        <div style="border: 1px solid #334155; border-radius: 8px; padding: 15px; background: #1E293B; margin-top: 15px;">
            <h4 style="color: #F8FAFC; margin-top: 0; border-bottom: 1px solid #334155; padding-bottom: 8px;">⚠️ Hierarquia de Escalonamento (Backup)</h4>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <div style="border: 1px solid #0C4A6E; border-radius: 4px; overflow: hidden;"><div style="background: #0C4A6E; color: white; text-align: center; font-size: 11px; font-weight: bold; padding: 6px;">🖥️ WINDOWS / DBA</div><div style="display: grid; grid-template-columns: 1fr 1fr 1fr; background: #0F172A; color: #CBD5E1; text-align: center; font-size: 11px;"><div style="padding: 8px; border-right: 1px solid #1E293B;">1º ${d.win[0] || '-'}</div><div style="padding: 8px; border-right: 1px solid #1E293B;">2º ${d.win[1] || '-'}</div><div style="padding: 8px;">3º ${d.win[2] || '-'}</div></div></div>
                <div style="border: 1px solid #064E3B; border-radius: 4px; overflow: hidden;"><div style="background: #064E3B; color: white; text-align: center; font-size: 11px; font-weight: bold; padding: 6px;">🐧 REDES / LINUX</div><div style="display: grid; grid-template-columns: 1fr 1fr 1fr; background: #0F172A; color: #CBD5E1; text-align: center; font-size: 11px;"><div style="padding: 8px; border-right: 1px solid #1E293B;">1º ${d.lin[0] || '-'}</div><div style="padding: 8px; border-right: 1px solid #1E293B;">2º ${d.lin[1] || '-'}</div><div style="padding: 8px;">3º ${d.lin[2] || '-'}</div></div></div>
                <div style="border: 1px solid #4C1D95; border-radius: 4px; overflow: hidden;"><div style="background: #4C1D95; color: white; text-align: center; font-size: 11px; font-weight: bold; padding: 6px;">💾 BACKUP</div><div style="display: grid; grid-template-columns: 1fr 1fr 1fr; background: #0F172A; color: #CBD5E1; text-align: center; font-size: 11px;"><div style="padding: 8px; border-right: 1px solid #1E293B;">1º ${d.bck[0] || '-'}</div><div style="padding: 8px; border-right: 1px solid #1E293B;">2º ${d.bck[1] || '-'}</div><div style="padding: 8px;">3º ${d.bck[2] || '-'}</div></div></div>
            </div>
        </div>`;
    }

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; background: #1E293B; padding: 12px; border-radius: 6px; border: 1px solid #334155; color: #94A3B8; font-size: 13px;">
            <span>Enviado por: <strong style="color: #F8FAFC;">${dados.responsavel_envio}</strong></span>
            <span>Turno: <strong style="color: #F8FAFC;">${dados.turno}</strong></span>
            <span>Data: <strong style="color: #F8FAFC;">${dados.data} às ${dados.hora}</strong></span>
        </div>
        ${diffHTML}
        ${dados.avisos ? `<div style="border: 1px solid #334155; border-radius: 8px; padding: 15px; background: #1E293B; margin-top: 15px;"><h4 style="color: #F8FAFC; margin-top: 0; border-bottom: 1px solid #334155; padding-bottom: 8px;">📝 Avisos Gerais</h4><div style="white-space: pre-wrap; color: #CBD5E1; font-size: 14px; line-height: 1.5;">${formatarTextoRico(dados.avisos)}</div></div>` : ''}
        ${htmlAvisosClientes}
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
            <div style="border: 1px solid #334155; border-radius: 8px; padding: 15px; background: #1E293B;"><h4 style="color: #EF4444; margin-top: 0; border-bottom: 1px solid #334155; padding-bottom: 8px;">📡 Pendências</h4>${htmlPendencias}</div>
            <div style="border: 1px solid #334155; border-radius: 8px; padding: 15px; background: #1E293B;"><h4 style="color: #FCA5A5; margin-top: 0; border-bottom: 1px solid #334155; padding-bottom: 8px;">⛔ Paradas Programadas</h4>${htmlParadas}</div>
        </div>
        ${htmlPlantonistas}
        ${htmlEscalonamento}
    `;

    // -- 2. CONTROLE DE ROTA DE EXIBIÇÃO --
    
    // ROTA A: É o Modal da Auditoria Histórica (O novo que criamos!)
    if (targetId === 'conteudo-auditoria-historica') {
        document.getElementById('modal-auditoria-historica').style.display = 'flex';
        return; // Para a execução aqui, deixando a lista de auditoria intacta por baixo
    }

    // ROTA B: É o Painel Fixo da Última Passagem (Ou a tela de Alarme)
    const modal = document.getElementById('modal-aceite-passagem');
    const caixaModal = document.getElementById('caixa-modal-aceite');
    const headerModal = document.getElementById('header-modal-aceite');
    const tituloModal = document.getElementById('titulo-modal-aceite');
    const subTituloModal = document.getElementById('subtitulo-modal-aceite');
    const rodapeModal = document.getElementById('rodape-modal-aceite');
    const btnFechar = document.getElementById('btn-fechar-leitura');

    if (isLeitura) {
        caixaModal.style.border = '2px solid #0284C7';
        caixaModal.style.boxShadow = '0 0 40px rgba(2, 132, 199, 0.3)';
        headerModal.style.background = '#0F172A';
        headerModal.style.borderBottom = '2px solid #0284C7';
        tituloModal.style.color = '#38BDF8';
        tituloModal.innerText = '📖 ÚLTIMA PASSAGEM DE TURNO';
        subTituloModal.innerText = 'Modo de consulta. Você pode reler as instruções deixadas pelo turno anterior.';
        rodapeModal.style.display = 'none'; 
        btnFechar.style.display = 'block';  
    } else {
        caixaModal.style.border = '2px solid #EF4444';
        caixaModal.style.boxShadow = '0 0 40px rgba(239, 68, 68, 0.4)';
        headerModal.style.background = '#450a0a';
        headerModal.style.borderBottom = '2px solid #EF4444';
        tituloModal.style.color = '#FCA5A5';
        tituloModal.innerText = '🚨 ATENÇÃO: NOVA PASSAGEM DE TURNO 🚨';
        subTituloModal.innerText = 'Você não pode operar o Radar até ler e assumir as pendências abaixo.';
        rodapeModal.style.display = 'block'; 
        btnFechar.style.display = 'none';  
    }
    
    modal.style.display = 'flex';
};

// NOVA FUNÇÃO: Busca na nuvem a última passagem e joga no Modo Leitura
window.lerUltimaPassagem = async function() {
    if(typeof window.mostrarToast === 'function') window.mostrarToast("Buscando última passagem na nuvem...", "info");
    
    try {
        const snapshot = await firebase.database().ref('passagens_turno').orderByKey().limitToLast(1).once('value');
        if (snapshot.exists()) {
            const dados = Object.values(snapshot.val())[0];
            // O "true" aqui liga a Mágica Camaleão (Modo Leitura / Azul)
            window.mostrarTelaDeAceite(dados, true); 
        } else {
            if(typeof window.mostrarToast === 'function') window.mostrarToast("Nenhuma passagem de turno registrada ainda.", "warning");
        }
    } catch (error) {
        console.error("Erro ao buscar passagem:", error);
        if(typeof window.mostrarToast === 'function') window.mostrarToast("Erro de conexão ao buscar os dados.", "error");
    }
};

window.confirmarAceitePassagem = async function() {
    if (!window.idPassagemPendente) return;

    let meuNome = "";
    
    // Lê do crachá superior perfeitamente
    const userDisplay = document.getElementById('user-display');
    if (userDisplay && userDisplay.innerText.includes('👤')) {
        meuNome = userDisplay.innerText.replace('👤', '').trim();
    } else {
        meuNome = prompt("Qual o seu nome para assinar o aceite da passagem?");
    }
    
    if (!meuNome) {
        if(typeof window.mostrarToast === 'function') window.mostrarToast("⚠️ Identificação obrigatória!", "warning");
        return;
    }

    const horaExata = new Date().toLocaleTimeString('pt-BR');

    try {
        await firebase.database().ref('passagens_turno/' + window.idPassagemPendente + '/aceite').update({
            status: "Concluído",
            responsavel_aceite: meuNome,
            hora_aceite: horaExata
        });
        if(typeof window.mostrarToast === 'function') window.mostrarToast("✅ Turno assumido com sucesso! O sistema foi desbloqueado.", "success");
        document.getElementById('modal-aceite-passagem').style.display = 'none';
        window.idPassagemPendente = null;
    } catch (error) {
        console.error("Erro ao aceitar passagem: ", error);
        if(typeof window.mostrarToast === 'function') window.mostrarToast("❌ Falha na conexão ao registrar o aceite.", "error");
    }
};

// ==========================================
// MONITOR DE AUDITORIA DAS ESCALAS
// ==========================================
firebase.database().ref('configuracoes/escalas_mensais/metadados').on('value', (snapshot) => {
    const painelAlerta = document.getElementById('alerta-escalas-metadados');
    const spanData = document.getElementById('meta-data-escala');
    const spanUser = document.getElementById('meta-user-escala');
    
    if (painelAlerta && spanData && spanUser) {
        if (snapshot.exists()) {
            const dados = snapshot.val();
            spanData.innerText = dados.data || '-';
            spanUser.innerText = dados.responsavel || '-';
            painelAlerta.style.display = 'block'; // Mostra a caixa
        } else {
            painelAlerta.style.display = 'none'; // Oculta se não houver dados
        }
    }
});

// ==========================================
// MOTOR DE TEXTAREAS INTELIGENTES (AUTO-EXPANSÍVEIS)
// ==========================================

// 1. A Função Mágica que calcula a altura (Definitiva com Suporte Nativo)
window.autoExpandTextarea = function(field) {
    if (!field) return;

    // 1. Se o navegador já suporta a expansão nativa (Chrome 121+), o JS não interfere!
    if (CSS.supports('field-sizing', 'content')) {
        field.style.removeProperty('height');
        return;
    }

    // 2. Fallback para navegadores antigos
    const scrollContainer = field.closest('.form-side') || field.closest('#modal-passagem') || document.documentElement;
    const scrollPos = scrollContainer ? scrollContainer.scrollTop : 0;

    // Esmaga a caixa (agora funciona perfeito porque tiramos a transição de altura no CSS)
    field.style.setProperty('height', '1px', 'important');
    
    // Lê o tamanho matemático exato da caixa e estica
    let novaAltura = field.scrollHeight;
    field.style.setProperty('height', (novaAltura + 2) + 'px', 'important');

    // Devolve a tela pro lugar para não pular
    if (scrollContainer) scrollContainer.scrollTop = scrollPos;
};

// 2. O Vigia Global: Fica escutando qualquer digitação ou "Colar" (Ctrl+V) em qualquer textarea da tela inteira!
document.addEventListener('input', function(event) {
    if (event.target.tagName.toLowerCase() === 'TEXTAREA') {
        window.autoExpandTextarea(event.target);
    }
});

// 3. O Ajuste em Massa (Com tempo extra de respiro)
window.ajustarTodasTextareas = function() {
    // 200ms de delay para garantir que a animação do Modal (display: flex) já terminou
    // antes do Javascript tentar calcular a altura.
    setTimeout(() => {
        document.querySelectorAll('textarea').forEach(ta => window.autoExpandTextarea(ta));
    }, 200); 
};

// ==========================================
// MOTOR DE REALCE DE TEXTO (MARCA-TEXTO INTELIGENTE LIGA/DESLIGA)
// ==========================================
window.aplicarRealce = function(elemento) {
    let textarea = null;
    
    if (typeof elemento === 'string') {
        textarea = document.getElementById(elemento);
    } else {
        const container = elemento.closest('div[class^="linha-"]');
        if (container) textarea = container.querySelector('textarea');
    }

    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    if (start === end) {
        if(typeof window.mostrarToast === 'function') window.mostrarToast("⚠️ Selecione um pedaço do texto primeiro para destacá-lo!", "warning");
        return;
    }

    const selectedText = text.substring(start, end);
    const trimmedText = selectedText.trimEnd();
    const trailingSpaces = selectedText.substring(trimmedText.length);
    
    let textoFinal = "";

    // CENÁRIO 1: Tira os marcadores de dentro
    if (trimmedText.startsWith("==") && trimmedText.endsWith("==") && trimmedText.length >= 4) {
        textoFinal = trimmedText.substring(2, trimmedText.length - 2) + trailingSpaces;
        textarea.setSelectionRange(start, end);
    } 
    // CENÁRIO 2: Tira os marcadores de fora
    else if (start >= 2 && text.substring(start - 2, start) === "==" && text.substring(start + trimmedText.length, start + trimmedText.length + 2) === "==") {
        textoFinal = trimmedText + trailingSpaces;
        textarea.setSelectionRange(start - 2, start + trimmedText.length + 2); // Expande a seleção para cobrir os iguais
    } 
    // CENÁRIO 3: Coloca os marcadores
    else {
        textoFinal = "==" + trimmedText + "==" + trailingSpaces;
        textarea.setSelectionRange(start, end);
    }

    const scrollContainer = textarea.closest('.form-side') || textarea.closest('#modal-passagem') || document.documentElement;
    const containerScrollTop = scrollContainer.scrollTop;

    // Devolve o foco SEM deixar o navegador "pular" a tela
    textarea.focus({ preventScroll: true });
    
    // A MÁGICA: O execCommand vai substituir APENAS o pedaço selecionado e salvar no Ctrl+Z!
    if (!document.execCommand('insertText', false, textoFinal)) {
        // Fallback
        textarea.value = text.substring(0, textarea.selectionStart) + textoFinal + text.substring(textarea.selectionEnd);
    }
    
    if (typeof window.autoExpandTextarea === 'function') {
        window.autoExpandTextarea(textarea);
    }

    scrollContainer.scrollTop = containerScrollTop;
};

// ==========================================
// EFEITO SANFONA (ACCORDION) PARA PASSAGEM DE TURNO
// ==========================================
window.toggleSanfona = function(elemento) {
    const seta = elemento.querySelector('.sanfona-seta');
    const conteudo = elemento.nextElementSibling;
    
    // Se estiver fechada, abre
    if (conteudo.classList.contains('fechada')) {
        conteudo.classList.remove('fechada');
        seta.classList.remove('fechada');
        
        // Espera a animação de descer a gaveta terminar (400ms) e ajusta as caixas de texto
        if (typeof window.ajustarTodasTextareas === 'function') {
            setTimeout(window.ajustarTodasTextareas, 400); 
        }
    } 
    // Se estiver aberta, fecha
    else {
        conteudo.classList.add('fechada');
        seta.classList.add('fechada');
    }
};

// ==========================================
// MÓDULO DE GESTÃO (PILAR 1: AUDITORIA)
// ==========================================

// 1. Abrir e Fechar o Painel Master
window.abrirPainelGestao = () => {
    document.getElementById('modal-gestao').style.display = 'flex';
    mudarAbaGestao('auditoria'); // Força abrir sempre na primeira aba
};
window.fecharPainelGestao = () => document.getElementById('modal-gestao').style.display = 'none';

// 2. Trocar de Abas sem fechar o modal (Versão Blindada)
window.mudarAbaGestao = function(aba) {
    // 1. Escurece todos os botões e oculta os painéis com segurança
    ['auditoria', 'tracking', 'base'].forEach(id => {
        const btn = document.getElementById('btn-aba-' + id);
        if (btn) { // Só muda a cor se o botão existir no HTML
            btn.style.background = 'transparent';
            btn.style.color = '#94A3B8';
            btn.style.border = '1px solid transparent';
            btn.style.fontWeight = 'bold';
        }
        
        const painel = document.getElementById('aba-gestao-' + id);
        if (painel) { // Só oculta se o painel existir
            painel.style.display = 'none';
        }
    });

    // 2. Acende o botão selecionado e mostra o painel correspondente
    const btnAtivo = document.getElementById('btn-aba-' + aba);
    if (btnAtivo) {
        btnAtivo.style.background = '#F59E0B';
        btnAtivo.style.color = '#1E293B';
        btnAtivo.style.fontWeight = '900';
    }
    
    const painelAtivo = document.getElementById('aba-gestao-' + aba);
    if (painelAtivo) {
        painelAtivo.style.display = 'block';
    }

    // 3. Gatilhos de carregamento (Auditoria e Tracking)
    if (aba === 'auditoria') { 
        if (typeof carregarAuditoriaPassagens === 'function') carregarAuditoriaPassagens(); 
    }
    
    if (aba === 'tracking') {
        const hoje = new Date().toISOString().split('T')[0];
        const inputIni = document.getElementById('track-data-ini');
        const inputFim = document.getElementById('track-data-fim');
        
        if (inputIni && !inputIni.value) inputIni.value = hoje;
        if (inputFim && !inputFim.value) inputFim.value = hoje;
    }
};

// 3. O Motor que busca e desenha o histórico
window.historicoPassagensCache = []; // Banco de memória local

window.carregarAuditoriaPassagens = async function() {
    // Agora o sistema pega as duas caixas (A da Gestão e a do Analista)
    const containerGestao = document.getElementById('lista-auditoria-passagens');
    const containerAnalista = document.getElementById('container-lista-turnos-analista'); 
    
    const showLoading = () => {
        const loadingHtml = '<div style="color: #94A3B8; text-align: center; padding: 30px;">⏳ Buscando dados seguros na nuvem...</div>';
        if (containerGestao) containerGestao.innerHTML = loadingHtml;
        if (containerAnalista) containerAnalista.innerHTML = loadingHtml;
    };
    
    showLoading();

    try {
        const snapshot = await firebase.database().ref('passagens_turno').limitToLast(60).once('value');
        if (snapshot.exists()) {
            window.historicoPassagensCache = [];
            snapshot.forEach(child => {
                window.historicoPassagensCache.push({ key: child.key, data: child.val() });
            });

            window.historicoPassagensCache.reverse();

            let html = '';
            window.historicoPassagensCache.forEach(item => {
                const d = item.data;
                const statusAceite = (d.aceite && d.aceite.status === "Concluído") 
                    ? `<span style="color: #10B981; font-weight: bold;">✔️ Assumido por ${d.aceite.responsavel_aceite} às ${d.aceite.hora_aceite}</span>` 
                    : `<span style="color: #F59E0B; font-weight: bold;">⏳ Aguardando Aceite</span>`;

                html += `
                <div class="card-auditoria" onclick="visualizarPassagemHistorica('${item.key}')">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <strong style="color: #38BDF8; font-size: 14px;">📅 ${d.data} - Turno da ${d.turno}</strong>
                        <span style="background: #1E293B; padding: 4px 8px; border-radius: 4px; font-size: 10px; color: #CBD5E1; border: 1px solid #334155;">Enviado às ${d.hora}</span>
                    </div>
                    <div style="font-size: 12px; color: #94A3B8; display: flex; justify-content: space-between;">
                        <span>Enviado por: <strong style="color: #F8FAFC;">${d.responsavel_envio}</strong></span>
                        ${statusAceite}
                    </div>
                </div>`;
            });
            
            // Joga os cards de histórico nas duas telas ao mesmo tempo!
            if (containerGestao) containerGestao.innerHTML = html;
            if (containerAnalista) containerAnalista.innerHTML = html;
        } else {
            const emptyHtml = '<div style="color: #64748B; text-align: center; padding: 30px;">Nenhuma passagem registrada no banco de dados.</div>';
            if (containerGestao) containerGestao.innerHTML = emptyHtml;
            if (containerAnalista) containerAnalista.innerHTML = emptyHtml;
        }
    } catch (e) {
        const errorHtml = '<div style="color: #EF4444; text-align: center; padding: 30px;">Erro de conexão ao buscar os dados.</div>';
        if (containerGestao) containerGestao.innerHTML = errorHtml;
        if (containerAnalista) containerAnalista.innerHTML = errorHtml;
    }
};

// Nova função apenas para abrir a tela da equipe
window.abrirHistoricoTurnosAnalista = function() {
    document.getElementById('modal-lista-turnos-analista').style.display = 'flex';
    carregarAuditoriaPassagens();
};

// A Mágica de abrir a Passagem antiga
window.visualizarPassagemHistorica = function(key) {
    const index = window.historicoPassagensCache.findIndex(i => i.key === key);
    if (index !== -1) {
        const itemAtual = window.historicoPassagensCache[index];
        const itemAnterior = window.historicoPassagensCache[index + 1]; 
        const diffHTML = window.gerarDiffDePassagens(itemAtual.data, itemAnterior ? itemAnterior.data : null);
        
        // Manda o sistema renderizar o conteúdo apontando para o NOVO MODAL da Máquina do Tempo!
        window.mostrarTelaDeAceite(itemAtual.data, true, diffHTML, 'conteudo-auditoria-historica');
    }
};

// 5. Motor de Auditoria (Diff): Compara o plantão atual com o anterior
window.gerarDiffDePassagens = function(atual, anterior) {
    if (!anterior) return `<div style="background: #1E293B; padding: 10px; border-radius: 6px; color: #64748B; font-size: 12px; text-align: center; margin-bottom: 15px;">Nenhum plantão anterior na memória para comparação.</div>`;

    let html = '';
    let temAlteracao = false;

    const addSecao = (titulo, conteudo) => {
        html += `<div style="margin-bottom: 10px;"><strong style="color: #94A3B8; font-size: 11px; text-transform: uppercase;">${titulo}</strong><div style="margin-top: 4px; display: flex; flex-direction: column; gap: 4px;">${conteudo}</div></div>`;
        temAlteracao = true;
    };

    // -> Compara Avisos Gerais
    if ((atual.avisos || '') !== (anterior.avisos || '')) {
        addSecao("📝 Avisos Gerais", `<span style="color: #FCD34D; font-size: 12px; display: flex; align-items: center; gap: 6px;"><span>✏️</span> O texto de avisos gerais foi modificado.</span>`);
    }

    // -> Compara Pendências do Radar (O Coração da Auditoria)
    let pendAtual = atual.pendencias || [];
    let pendAnt = anterior.pendencias || [];
    let mapAtual = {}; pendAtual.forEach(p => mapAtual[`${p.cliente}-${p.host}`] = p);
    let mapAnt = {}; pendAnt.forEach(p => mapAnt[`${p.cliente}-${p.host}`] = p);
    let mudancasPend = '';
    
    for (let key in mapAtual) {
        if (!mapAnt[key]) { // Não existia antes = NOVA
            mudancasPend += `<span style="color: #34D399; font-size: 12px; display: flex; align-items: center; gap: 6px;"><span>➕</span> <strong>NOVA:</strong> ${mapAtual[key].cliente} | ${mapAtual[key].host}</span>`;
        } else { // Existia, mas vamos ver se ele editou
            let pAt = mapAtual[key]; let pAn = mapAnt[key];
            if (pAt.status !== pAn.status || pAt.obs !== pAn.obs || pAt.chamado !== pAn.chamado) {
                mudancasPend += `<span style="color: #60A5FA; font-size: 12px; display: flex; align-items: center; gap: 6px;"><span>✏️</span> <strong>EDITADA:</strong> ${pAt.cliente} | ${pAt.host} (Status, OBS ou Chamado)</span>`;
            }
        }
    }
    for (let key in mapAnt) {
        if (!mapAtual[key]) { // Existia antes e sumiu = RESOLVIDA/BAIXADA
            mudancasPend += `<span style="color: #F87171; font-size: 12px; display: flex; align-items: center; gap: 6px;"><span>✔️</span> <strong style="text-decoration: line-through;">BAIXADA:</strong> ${mapAnt[key].cliente} | ${mapAnt[key].host}</span>`;
        }
    }
    if (mudancasPend) addSecao("📡 Pendências do Radar", mudancasPend);

    // -> Compara Avisos de Clientes Específicos
    let cliAtual = atual.avisos_clientes || []; let cliAnt = anterior.avisos_clientes || [];
    let mapCliAtual = {}; cliAtual.forEach(c => mapCliAtual[c.cliente] = c);
    let mapCliAnt = {}; cliAnt.forEach(c => mapCliAnt[c.cliente] = c);
    let mudancasCli = '';

    for (let key in mapCliAtual) {
        if (!mapCliAnt[key]) mudancasCli += `<span style="color: #34D399; font-size: 12px; display: flex; align-items: center; gap: 6px;"><span>➕</span> <strong>NOVO AVISO:</strong> ${key}</span>`;
        else if (mapCliAtual[key].texto !== mapCliAnt[key].texto) mudancasCli += `<span style="color: #60A5FA; font-size: 12px; display: flex; align-items: center; gap: 6px;"><span>✏️</span> <strong>AVISO EDITADO:</strong> ${key}</span>`;
    }
    for (let key in mapCliAnt) {
        if (!mapCliAtual[key]) mudancasCli += `<span style="color: #F87171; font-size: 12px; display: flex; align-items: center; gap: 6px;"><span>🗑️</span> <strong style="text-decoration: line-through;">AVISO REMOVIDO:</strong> ${key}</span>`;
    }
    if (mudancasCli) addSecao("🏢 Avisos Específicos", mudancasCli);

    // -> Compara Paradas Programadas
    let parAtual = atual.paradas || []; let parAnt = anterior.paradas || [];
    if (parAtual.length !== parAnt.length || JSON.stringify(parAtual) !== JSON.stringify(parAnt)) {
        addSecao("⛔ Paradas Programadas", `<span style="color: #FCD34D; font-size: 12px; display: flex; align-items: center; gap: 6px;"><span>✏️</span> A lista de manutenções sofreu alterações.</span>`);
    }

    if (!temAlteracao) {
        return `<div style="background: #064E3B; border: 1px solid #047857; padding: 12px; border-radius: 8px; color: #34D399; font-size: 13px; font-weight: bold; text-align: center; margin-bottom: 15px;">✔️ Nenhuma alteração operacional detectada em relação ao plantão anterior (Cópia exata).</div>`;
    }

    return `<div style="background: #0F172A; border: 1px dashed #38BDF8; padding: 15px; border-radius: 8px; margin-bottom: 15px; box-shadow: inset 0 0 15px rgba(0,0,0,0.2);">
                <h4 style="color: #38BDF8; margin-top: 0; margin-bottom: 15px; font-size: 14px; border-bottom: 1px solid #334155; padding-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                    <span>🔍</span> Análise de Alterações (Diff)
                </h4>
                ${html}
            </div>`;
};

// ==========================================
// MÓDULO DE GESTÃO (PILAR 2: TRACKING ITSSM)
// ==========================================
window.dadosTrackingCache = [];

window.carregarTracking = async function() {
    const tbody = document.getElementById('lista-tracking-body');
    const dataIni = document.getElementById('track-data-ini').value;
    const dataFim = document.getElementById('track-data-fim').value;
    const analistaFiltro = document.getElementById('track-analista').value.toLowerCase().trim();

    if (!dataIni || !dataFim) {
        if(typeof window.mostrarToast === 'function') window.mostrarToast("⚠️ Selecione o período inicial e final.", "warning");
        return;
    }

    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: #38BDF8;">⏳ Coletando métricas e informes na nuvem...</td></tr>';

    // Converte as datas visuais para a linguagem do banco (Timestamp)
    const startTS = new Date(dataIni + "T00:00:00").getTime();
    const endTS = new Date(dataFim + "T23:59:59").getTime();

    try {
        // Puxa toda a produção do período selecionado
        const snapshot = await firebase.database().ref('historico_noc')
                                .orderByChild('timestamp')
                                .startAt(startTS)
                                .endAt(endTS)
                                .once('value');
        
        window.dadosTrackingCache = [];
        let kpiAb = 0, kpiFo = 0, kpiRe = 0;

        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const log = child.val();
                // Considera apenas formulários (Ignora aqueles 'aviso_rapido' de assumir análise)
                if (log.tipo === 'relatorio' && log.form) {
                    
                    // Se o gestor digitou um nome, filtra só ele. Se não, traz todo mundo!
                    if (analistaFiltro && log.nome.toLowerCase().indexOf(analistaFiltro) === -1) return;

                    window.dadosTrackingCache.push(log);

                    const acao = log.assunto ? log.assunto.split(' | ')[5] || '' : '';
                    if (acao.includes('ABERTURA') || log.form.status === 'EM ABERTO') kpiAb++;
                    else if (acao.includes('FOLLOW') || log.form.status === 'FOLLOW-UP') kpiFo++;
                    else if (acao.includes('ENCERRAMENTO') || log.form.status === 'RESOLVIDO') kpiRe++;
                }
            });
        }

        // Atualiza os Painéis de KPI Gigantes
        document.getElementById('kpi-track-total').innerText = window.dadosTrackingCache.length;
        document.getElementById('kpi-track-aberturas').innerText = kpiAb;
        document.getElementById('kpi-track-follow').innerText = kpiFo;
        document.getElementById('kpi-track-resolvidos').innerText = kpiRe;

        if (window.dadosTrackingCache.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: #FCA5A5;">Nenhum registro encontrado para este filtro.</td></tr>';
            return;
        }

        // Inverte para exibir do mais novo para o mais velho
        window.dadosTrackingCache.reverse();
        
        let html = '';
        window.dadosTrackingCache.forEach(log => {
            const dataFormatada = new Date(log.timestamp).toLocaleDateString('pt-BR');
            const acao = log.form.status || '-';
            
            // Colore a badge da ação na tabela
            let corAcao = '#94A3B8';
            if (acao === 'EM ABERTO') corAcao = '#EF4444';
            if (acao === 'FOLLOW-UP') corAcao = '#F59E0B';
            if (acao === 'RESOLVIDO') corAcao = '#10B981';

            const ticket = log.form.itssm || log.form.protocoloLibbs || '-';
            
            // 🪄 BOTÃO MÁGICO COPIADOR: Clique e Copie!
            const btnTicket = ticket !== '-' 
                ? `<button onclick="navigator.clipboard.writeText('${ticket}'); this.innerText='✔️ COPIADO'; this.style.background='#10B981'; this.style.color='#FFF'; setTimeout(()=> { this.innerText='📄 ${ticket}'; this.style.background='#312E81'; this.style.color='#C4B5FD'; }, 1500);" style="background: #312E81; color: #C4B5FD; border: 1px solid #4C1D95; padding: 6px; border-radius: 4px; font-family: monospace; font-size: 11px; font-weight: bold; cursor: pointer; transition: 0.2s; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="Clique para copiar o registro">📄 ${ticket}</button>` 
                : '<span style="color: #475569; font-weight: bold;">-</span>';

            html += `
            <tr style="border-bottom: 1px solid #1E293B; transition: 0.2s;" onmouseover="this.style.background='#1E293B'" onmouseout="this.style.background='transparent'">
                <!-- Quebra Data e Hora para poupar espaço -->
                <td style="padding: 12px; white-space: nowrap;">${dataFormatada}<br><span style="color:#64748B; font-size: 10px;">${log.hora}</span></td>
                
                <td style="padding: 12px; color: #38BDF8; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${log.nome}">${log.nome}</td>
                
                <td style="padding: 12px; white-space: nowrap;">
                    <span style="background: ${corAcao}20; color: ${corAcao}; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 900; border: 1px solid ${corAcao}50;">${acao}</span>
                </td>
                
                <td style="padding: 12px; color: #F8FAFC; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${log.form.cliente || '-'}">${log.form.cliente || '-'}</td>
                
                <!-- O segredo: word-break quebra hosts gigantes sem destruir a tabela -->
                <td style="padding: 12px; line-height: 1.5; word-break: break-word;">${log.form.host || '-'}</td>
                
                <td style="padding: 12px; text-align: center;">${btnTicket}</td>
            </tr>
            `;
        });
        tbody.innerHTML = html;

    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: #EF4444;">Erro ao conectar com o banco de dados.</td></tr>';
    }
};

window.exportarTracking = function() {
    if (window.dadosTrackingCache.length === 0) {
        if(typeof window.mostrarToast === 'function') window.mostrarToast("⚠️ Faça uma busca primeiro para ter o que exportar.", "warning");
        return;
    }

    let csvContent = "\uFEFF"; 
    csvContent += "Data;Hora;Analista;Ação;Cliente;Host;Serviço;Severidade;Status;ITSSM;Protocolo\n";

    window.dadosTrackingCache.forEach(log => {
        const data = new Date(log.timestamp).toLocaleDateString('pt-BR');
        const hora = log.hora;
        const acao = log.assunto ? log.assunto.split(' | ')[5] || '' : '';
        const servico = log.form.item ? log.form.item.split('\n')[0].substring(0, 50) : '';
        
        let row = [
            data, hora, log.nome, acao, log.form.cliente || '', log.form.host || '',
            servico, log.form.severidade || '', log.form.status || '', 
            log.form.itssm || log.form.protocoloLibbs || '', log.form.protocolo || ''
        ].map(e => `"${String(e).replace(/"/g, '""')}"`).join(";");

        csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Tracking_Operacional_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if(typeof window.mostrarToast === 'function') window.mostrarToast("✅ Relatório Exportado com Sucesso!", "success");
};

// ==========================================
// MÓDULO DE GESTÃO (PILAR 3: BASE DE CONHECIMENTO)
// ==========================================
window.regrasBaseConhecimentoAtivas = [];
window.regrasJaAlertadasNoTurno = new Set(); 

window.limparTextoParaBusca = function(str) {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-_./\\|]/g, " ").replace(/\s+/g, " ").toUpperCase().trim();
};

// --- LOGICA DE IMAGENS MÚLTIPLAS ---
window.imagensBase64Cache = []; // Agora é um Array!

window.converterImagemBase = function(input) {
    const files = input.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = function(e) {
            // 🔥 A MÁGICA: Comprime a imagem antes de virar Base64!
            const img = new Image();
            img.src = e.target.result;
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; // Trava a resolução
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                }

                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Converte para JPEG com 60% de qualidade (Derruba o tamanho de 3MB para ~50KB)
                const base64Reduzida = canvas.toDataURL('image/jpeg', 0.6);
                
                window.imagensBase64Cache.push(base64Reduzida);
                window.renderizarGaleriaBase();
            };
        }
    });
    input.value = ''; 
};

window.renderizarGaleriaBase = function() {
    const container = document.getElementById('base-img-preview-container');
    const galeria = document.getElementById('base-galeria-preview');
    
    if (window.imagensBase64Cache.length > 0) {
        container.style.display = 'flex';
        let html = '';
        window.imagensBase64Cache.forEach((img) => {
            html += `<img src="${img}" style="height: 60px; border-radius: 4px; border: 1px solid #334155; object-fit: cover;">`;
        });
        galeria.innerHTML = html;
    } else {
        container.style.display = 'none';
        galeria.innerHTML = '';
    }
};

window.removerTodasImagensBase = function() {
    window.imagensBase64Cache = [];
    window.renderizarGaleriaBase();
};

// --- LOGICA DE CANCELAR EDIÇÃO ---
window.cancelarEdicaoBase = function() {
    document.getElementById('base-titulo-form').innerHTML = '<span>➕</span> Adicionar Novo Procedimento / Alerta';
    document.getElementById('base-edit-id').value = '';
    document.getElementById('base-cliente').value = '';
    document.getElementById('base-host').value = '';
    document.getElementById('base-servico').value = '';
    document.getElementById('base-mensagem').value = '';
    window.removerTodasImagensBase();
    
    const btnSalvar = document.getElementById('btn-salvar-base');
    btnSalvar.innerText = '💾 SALVAR REGRA NA NUVEM';
    btnSalvar.style.background = '#8B5CF6';
    document.getElementById('btn-cancelar-edit').style.display = 'none';
};

// --- LOGICA DE EDITAR REGRA ---
window.editarRegraBase = function(key) {
    const regra = window.regrasBaseConhecimentoAtivas.find(r => r.key === key);
    if(regra) {
        document.getElementById('base-titulo-form').innerHTML = '<span>✏️</span> Editando Procedimento Existente';
        document.getElementById('base-edit-id').value = regra.key;
        document.getElementById('base-cliente').value = regra.cliente || '';
        document.getElementById('base-host').value = regra.host || '';
        document.getElementById('base-servico').value = regra.servico || '';
        document.getElementById('base-mensagem').value = regra.mensagem || '';
        
        // Carrega o array novo ou converte a imagem antiga (backward compatibility)
        if (regra.imagens) {
            window.imagensBase64Cache = [...regra.imagens];
        } else if (regra.imagem) {
            window.imagensBase64Cache = [regra.imagem]; 
        } else {
            window.imagensBase64Cache = [];
        }
        window.renderizarGaleriaBase();

        const btnSalvar = document.getElementById('btn-salvar-base');
        btnSalvar.innerText = '🔄 ATUALIZAR REGRA';
        btnSalvar.style.background = '#F59E0B'; 
        document.getElementById('btn-cancelar-edit').style.display = 'inline-block';
        
        document.getElementById('aba-gestao-base').scrollIntoView({ behavior: 'smooth' });
    }
};

// --- 1. SALVAR OU ATUALIZAR NA NUVEM (AGORA COM VERSÃO!) ---
window.salvarRegraBase = async function() {
    const editId = document.getElementById('base-edit-id').value;
    const cli = document.getElementById('base-cliente').value.toUpperCase().trim();
    const hst = document.getElementById('base-host').value.toUpperCase().trim();
    const srv = document.getElementById('base-servico').value.toUpperCase().trim();
    const msg = document.getElementById('base-mensagem').value.trim();

    if (!cli && !hst && !srv) return window.mostrarToast("⚠️ Preencha Cliente, Host ou Serviço.", "warning");
    if (!msg) return window.mostrarToast("⚠️ Digite a mensagem de alerta.", "warning");

    const btn = document.getElementById('btn-salvar-base');
    btn.innerText = "⏳ PROCESSANDO...";

    const novaRegra = {
        cliente: cli, host: hst, servico: srv, mensagem: msg,
        imagens: window.imagensBase64Cache,
        data: new Date().toLocaleDateString('pt-BR'),
        autor: (document.getElementById('user-display').innerText || 'Gestão').replace('👤 ', ''),
        versao: Date.now() // 🚀 CARIMBO DE VERSÃO: Muda toda vez que salva!
    };

    try {
        if (editId) {
            await firebase.database().ref('configuracoes/base_conhecimento/' + editId).update(novaRegra);
            if(typeof window.mostrarToast === 'function') window.mostrarToast("✅ Procedimento Atualizado!", "success");
        } else {
            await firebase.database().ref('configuracoes/base_conhecimento').push(novaRegra);
            if(typeof window.mostrarToast === 'function') window.mostrarToast("✅ Novo Procedimento Ativo!", "success");
        }
        window.cancelarEdicaoBase();
    } catch (e) {
        if(typeof window.mostrarToast === 'function') window.mostrarToast("Erro ao comunicar com o banco.", "error");
        btn.innerText = editId ? "🔄 ATUALIZAR REGRA" : "💾 SALVAR REGRA NA NUVEM";
    }
};

// --- 2. APAGAR REGRA ---
window.removerRegraBase = async function(key) {
    if (confirm("Deseja realmente excluir este procedimento?")) {
        await firebase.database().ref('configuracoes/base_conhecimento/' + key).remove();
        if(typeof window.mostrarToast === 'function') window.mostrarToast("🗑️ Regra removida.", "info");
    }
};

// --- 3. MONITOR DA TABELA DA GESTÃO ---
window.renderizarTabelaGestaoBase = function() {
    const lista = document.getElementById('lista-regras-base');
    const inputBusca = document.getElementById('busca-gestao-base');
    const termoBusca = window.limparTextoParaBusca(inputBusca ? inputBusca.value : '');
    
    if (window.regrasBaseConhecimentoAtivas.length === 0) {
        if(lista) lista.innerHTML = '<div style="text-align: center; color: #64748B; padding: 20px; font-size: 12px;">Nenhuma regra cadastrada.</div>';
        return;
    }

    let html = '';
    window.regrasBaseConhecimentoAtivas.forEach(d => {
        const searchStr = window.limparTextoParaBusca(`${d.cliente} ${d.host} ${d.servico} ${d.mensagem}`);
        if (termoBusca && !searchStr.includes(termoBusca)) return;

        let tags = '';
        if (d.cliente) tags += `<span style="background: #0284C7; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">🏢 Cliente: ${d.cliente}</span> `;
        if (d.host) tags += `<span style="background: #10B981; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">🖥️ Host: ${d.host}</span> `;
        if (d.servico) tags += `<span style="background: #8B5CF6; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">⚙️ Serviço: ${d.servico}</span> `;
        
        let arrayImgs = d.imagens ? d.imagens : (d.imagem ? [d.imagem] : []);
        if (arrayImgs.length > 0) {
            tags += `<span style="background: #4C1D95; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">📸 ${arrayImgs.length} Imagem(ns)</span>`;
        }

        const tituloSanfona = tags ? tags : `<span style="color: #94A3B8; font-size: 12px; font-weight: bold;">📝 Diretriz Geral (Sem alvo específico)</span>`;

        let imgHtml = '';
        if (arrayImgs.length > 0) {
            imgHtml = `
            <details style="margin-top: 15px; border-top: 1px dashed #334155; padding-top: 10px;">
                <summary style="color: #38BDF8; font-size: 11px; font-weight: bold; cursor: pointer; outline: none; list-style: none; display: inline-flex; align-items: center; background: #0F172A; padding: 6px 12px; border-radius: 4px; border: 1px solid #0284C7;">
                    📸 Mostrar ${arrayImgs.length} Imagem(ns) Anexada(s)
                </summary>
                <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px;">`;
            
            arrayImgs.forEach(img => {
                imgHtml += `<img src="${img}" onclick="ampliarImagem(this.src)" title="Clique para Ampliar" style="height: 80px; width: 120px; object-fit: cover; border-radius: 6px; border: 1px solid #334155; box-shadow: 0 4px 10px rgba(0,0,0,0.2); cursor: zoom-in; transition: 0.2s;" onmouseover="this.style.borderColor='#38BDF8'; this.style.transform='scale(1.05)'" onmouseout="this.style.borderColor='#334155'; this.style.transform='scale(1)'">`;
            });
            imgHtml += `</div></details>`;
        }

        // 🔥 A MÁGICA DE CORREÇÃO: Foram removidos o 'overflow: hidden' e 'transition' que bugavam os navegadores.
        html += `
        <details style="background: #1E293B; border: 1px solid #334155; border-radius: 8px; border-left: 4px solid #FCD34D; margin-bottom: 8px; position: relative;">
            
            <!-- CABEÇALHO VISÍVEL (A GAVETA) -->
            <summary style="background: #0F172A; padding: 15px 20px; cursor: pointer; outline: none; display: flex; justify-content: space-between; align-items: center; user-select: none; list-style: none;">
                <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <span style="color: #FCD34D; font-size: 10px; margin-right: 5px; font-weight: 900;">▼ VER / EDITAR</span>
                    ${tituloSanfona}
                </div>
                <span style="color: #64748B; font-size: 10px; white-space: nowrap;">${d.data || ''}</span>
            </summary>
            
            <!-- CONTEÚDO OCULTO (TEXTO, IMAGENS E BOTÕES DE AÇÃO) -->
            <div style="padding: 20px; border-top: 1px solid #334155;">
                <div style="color: #F8FAFC; font-size: 14px; line-height: 1.6; word-break: break-word;">${formatarTextoRico(d.mensagem)}</div>
                ${imgHtml}
                
                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; border-top: 1px solid #334155; padding-top: 15px;">
                    <div style="color: #64748B; font-size: 10px;">👤 Cadastrado por: ${d.autor}</div>
                    
                    <div style="display: flex; gap: 10px;">
                        <button onclick="editarRegraBase('${d.key}')" style="background: #334155; border: 1px solid #475569; color: #F8FAFC; border-radius: 6px; padding: 8px 15px; cursor: pointer; font-size: 11px; font-weight: bold; transition: 0.2s;" onmouseover="this.style.background='#475569'" onmouseout="this.style.background='#334155'">
                            ✏️ EDITAR REGRA
                        </button>
                        <button onclick="removerRegraBase('${d.key}')" style="background: transparent; border: 1px solid #EF4444; color: #EF4444; border-radius: 6px; padding: 8px 15px; cursor: pointer; font-size: 11px; transition: 0.2s;" onmouseover="this.style.background='#EF4444'; this.style.color='white'" onmouseout="this.style.background='transparent'; this.style.color='#EF4444'">
                            ✖ EXCLUIR
                        </button>
                    </div>
                </div>
            </div>
            
        </details>`;
    });
    if(lista) lista.innerHTML = html || '<div style="text-align: center; color: #FCA5A5; padding: 20px; font-size: 12px;">Nenhuma regra encontrada.</div>';
};

firebase.database().ref('configuracoes/base_conhecimento').on('value', snapshot => {
    window.regrasBaseConhecimentoAtivas = [];
    if (snapshot.exists()) {
        snapshot.forEach(child => {
            window.regrasBaseConhecimentoAtivas.push({ key: child.key, ...child.val() });
        });
    }
    window.renderizarTabelaGestaoBase();
});

// --- LÓGICA DE SILENCIAR A REGRA ---
window.silenciarRegra = function(key, versao) {
    let silenciadas = JSON.parse(localStorage.getItem('noc_regras_silenciadas') || '{}');
    silenciadas[key] = versao; // Salva que ESTA versão foi silenciada
    localStorage.setItem('noc_regras_silenciadas', JSON.stringify(silenciadas));
    
    document.getElementById('modal-alerta-procedimento').style.display = 'none';
    if(typeof window.mostrarToast === 'function') window.mostrarToast("🔕 Você silenciou este alerta. Mas se a Gestão atualizar, avisaremos novamente!", "info");
};

// ==========================================
// 4. O GATILHO NA TELA DO ANALISTA
// ==========================================
window.verificarCruzamentoDeRegras = function() {
    if (window.regrasBaseConhecimentoAtivas.length === 0) return;

    const elCliente = document.getElementById('cliente');
    const elHost = document.getElementById('host');
    const elServico = document.getElementById('item');

    const cliDigitado = window.limparTextoParaBusca(elCliente ? elCliente.value : '');
    const hostDigitado = window.limparTextoParaBusca(elHost ? elHost.value : '');
    const srvDigitado = window.limparTextoParaBusca(elServico ? elServico.value : '');

    // 🚀 A MÁGICA DO RESET: Se o analista limpou a tela inteira, resetamos o bloqueio temporário!
    if (cliDigitado === '' && hostDigitado === '' && srvDigitado === '') {
        window.regrasJaAlertadasNoTurno.clear();
        return;
    }

    window.regrasBaseConhecimentoAtivas.forEach(regra => {
        const rCli = window.limparTextoParaBusca(regra.cliente);
        const rHost = window.limparTextoParaBusca(regra.host);
        const rSrv = window.limparTextoParaBusca(regra.servico);

        const matchCliente = rCli === '' || cliDigitado.includes(rCli);
        const matchHost = rHost === '' || hostDigitado.includes(rHost);
        const matchServico = rSrv === '' || srvDigitado.includes(rSrv);

        if (matchCliente && matchHost && matchServico) {
            const chavaTemporaria = `${regra.key}-${cliDigitado}-${hostDigitado}-${srvDigitado}`;
            const versaoAtual = regra.versao || 'v1';

            // Verifica se o analista mandou calar a boca PERMANENTEMENTE para esta versão
            let silenciadas = JSON.parse(localStorage.getItem('noc_regras_silenciadas') || '{}');
            if (silenciadas[regra.key] === versaoAtual) return; // Aborta o pop-up silenciosamente

            // Se chegou aqui, joga na tela!
            if (!window.regrasJaAlertadasNoTurno.has(chavaTemporaria)) {
                
                if (typeof window.tocarSomNOC === 'function') window.tocarSomNOC('alerta');
                
                let tagsHTML = '';
                if (regra.cliente) tagsHTML += `<span style="background: #0284C7; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">🏢 Cliente: ${regra.cliente}</span>`;
                if (regra.host) tagsHTML += `<span style="background: #10B981; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">🖥️ Host: ${regra.host}</span>`;
                if (regra.servico) tagsHTML += `<span style="background: #8B5CF6; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">⚙️ Serviço: ${regra.servico}</span>`;
                document.getElementById('proc-tags-alvo').innerHTML = tagsHTML;

                document.getElementById('proc-texto-mensagem').innerHTML = formatarTextoRico(regra.mensagem);
                
                // Conecta a Key e a Versão no botão de silenciar
                const btnSilenciar = document.getElementById('btn-silenciar-regra');
                if (btnSilenciar) {
                    btnSilenciar.setAttribute('onclick', `window.silenciarRegra('${regra.key}', '${versaoAtual}')`);
                }
                
                const imgContainer = document.getElementById('proc-imagens-container');
                let arrayImgs = regra.imagens ? regra.imagens : (regra.imagem ? [regra.imagem] : []);

                if (arrayImgs.length > 0) {
                    let imgsHTML = `
                    <details style="width: 100%; margin-top: 5px;">
                        <summary style="color: #FCD34D; font-size: 11px; font-weight: bold; cursor: pointer; outline: none; list-style: none; display: inline-flex; align-items: center; background: #1E293B; padding: 8px 15px; border-radius: 6px; border: 1px solid #B45309; transition: 0.2s;">
                            ▶ CLIQUE PARA VER ${arrayImgs.length} IMAGEM(NS) ANEXADA(S)
                        </summary>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; justify-content: center;">`;
                    
                    arrayImgs.forEach(img => {
                        imgsHTML += `<img src="${img}" onclick="ampliarImagem(this.src)" title="Clique para Ampliar" style="height: 120px; width: 180px; object-fit: cover; border-radius: 6px; border: 1px solid #334155; box-shadow: 0 4px 10px rgba(0,0,0,0.3); cursor: zoom-in; transition: 0.2s;" onmouseover="this.style.borderColor='#FCD34D'; this.style.transform='scale(1.05)'" onmouseout="this.style.borderColor='#334155'; this.style.transform='scale(1)'">`;
                    });
                    
                    imgsHTML += `</div></details>`;
                    imgContainer.innerHTML = imgsHTML;
                    imgContainer.style.display = 'flex';
                } else {
                    imgContainer.innerHTML = '';
                    imgContainer.style.display = 'none';
                }

                document.getElementById('proc-autor-data').innerText = `👤 Cadastrado por: ${regra.autor || 'Gestão'} em ${regra.data || '-'}`;
                document.getElementById('modal-alerta-procedimento').style.display = 'flex';

                window.regrasJaAlertadasNoTurno.add(chavaTemporaria); // Bloqueia temporariamente
            }
        }
    });
};

if (typeof window.update === 'function') {
    const funcaoUpdateOriginal = window.update;
    window.update = function() {
        funcaoUpdateOriginal(); 
        clearTimeout(window.timerEspiaoBase);
        window.timerEspiaoBase = setTimeout(window.verificarCruzamentoDeRegras, 300);
    };
}

// ==========================================
// 5. MODAL DE PROCEDIMENTOS (VISÃO DO ANALISTA)
// ==========================================
window.abrirBaseAnalista = function() {
    document.getElementById('modal-base-analista').style.display = 'flex';
    document.getElementById('busca-base-analista').value = ''; 
    window.renderizarBaseAnalista();
};

window.fecharBaseAnalista = function() {
    document.getElementById('modal-base-analista').style.display = 'none';
};

window.renderizarBaseAnalista = function() {
    const lista = document.getElementById('lista-base-analista');
    const inputBusca = document.getElementById('busca-base-analista');
    const termoBusca = window.limparTextoParaBusca(inputBusca ? inputBusca.value : '');

    if (window.regrasBaseConhecimentoAtivas.length === 0) {
        if(lista) lista.innerHTML = '<div style="text-align: center; color: #64748B; padding: 30px;">Nenhum procedimento cadastrado pela Gestão no momento.</div>';
        return;
    }

    let html = '';
    window.regrasBaseConhecimentoAtivas.forEach(regra => {
        const searchStr = window.limparTextoParaBusca(`${regra.cliente} ${regra.host} ${regra.servico} ${regra.mensagem}`);
        if (termoBusca && !searchStr.includes(termoBusca)) return;

        // 1. Constrói as Etiquetas (Badges)
        let tags = '';
        if (regra.cliente) tags += `<span style="background: #0284C7; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">🏢 Cliente: ${regra.cliente}</span> `;
        if (regra.host) tags += `<span style="background: #10B981; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">🖥️ Host: ${regra.host}</span> `;
        if (regra.servico) tags += `<span style="background: #8B5CF6; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">⚙️ Serviço: ${regra.servico}</span> `;
        
        // Se a regra não tiver cliente/host/serviço, damos um título genérico
        const tituloSanfona = tags ? tags : `<span style="color: #94A3B8; font-size: 12px; font-weight: bold;">📝 Diretriz Geral (Sem alvo específico)</span>`;

        // 2. Constrói a Galeria de Imagens (Se houver)
        let arrayImgs = regra.imagens ? regra.imagens : (regra.imagem ? [regra.imagem] : []);
        let imgHtml = '';
        if (arrayImgs.length > 0) {
            imgHtml = `
            <details style="margin-top: 15px; border-top: 1px dashed #334155; padding-top: 10px;">
                <summary style="color: #38BDF8; font-size: 11px; font-weight: bold; cursor: pointer; outline: none; list-style: none; display: inline-flex; align-items: center; background: #0F172A; padding: 6px 12px; border-radius: 4px; border: 1px solid #0284C7;">
                    📸 Mostrar ${arrayImgs.length} Imagem(ns) Anexada(s)
                </summary>
                <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px;">`;
            
            arrayImgs.forEach(img => {
                imgHtml += `<img src="${img}" onclick="ampliarImagem(this.src)" title="Clique para Ampliar" style="height: 80px; width: 120px; object-fit: cover; border-radius: 6px; border: 1px solid #334155; box-shadow: 0 4px 10px rgba(0,0,0,0.2); cursor: zoom-in; transition: 0.2s;" onmouseover="this.style.borderColor='#38BDF8'; this.style.transform='scale(1.05)'" onmouseout="this.style.borderColor='#334155'; this.style.transform='scale(1)'">`;
            });
            imgHtml += `</div></details>`;
        }

        // 3. A MÁGICA: Empacota tudo no Efeito Sanfona (details > summary)
        html += `
        <details style="background: #1E293B; border: 1px solid #334155; border-radius: 8px; border-left: 4px solid #FCD34D; overflow: hidden; margin-bottom: 8px; transition: all 0.3s ease;">
            
            <!-- CABEÇALHO VISÍVEL (A GAVETA) -->
            <summary style="background: #0F172A; padding: 15px 20px; cursor: pointer; outline: none; display: flex; justify-content: space-between; align-items: center; user-select: none; list-style: none;">
                <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <span style="color: #FCD34D; font-size: 10px; margin-right: 5px; font-weight: 900;">▼ LER REGRA</span>
                    ${tituloSanfona}
                </div>
                <span style="color: #64748B; font-size: 10px; white-space: nowrap;">${regra.data || ''}</span>
            </summary>
            
            <!-- CONTEÚDO OCULTO (O TEXTO QUE CAI) -->
            <div style="padding: 20px; border-top: 1px solid #334155;">
                <div style="color: #F8FAFC; font-size: 14px; line-height: 1.6; word-break: break-word;">${formatarTextoRico(regra.mensagem)}</div>
                ${imgHtml}
                <div style="color: #64748B; font-size: 10px; margin-top: 15px; text-align: right;">👤 Cadastrado por: ${regra.autor}</div>
            </div>
            
        </details>`;
    });

    if(lista) lista.innerHTML = html || '<div style="text-align: center; color: #FCA5A5; padding: 30px;">Nenhum procedimento encontrado com estes termos de busca.</div>';
};

// ==========================================
// 6. A LENTE DE AUMENTO (FULLSCREEN LIGHTBOX)
// ==========================================
window.ampliarImagem = function(src) {
    document.getElementById('lightbox-img').src = src;
    document.getElementById('modal-lightbox').style.display = 'flex';
};

window.fecharLightbox = function() {
    document.getElementById('modal-lightbox').style.display = 'none';
    document.getElementById('lightbox-img').src = '';
};

// ==========================================
// MOTOR DE DESFAZER / REFAZER (UNDO/REDO)
// ==========================================
window.desfazerTexto = function(elemento) {
    let textarea = typeof elemento === 'string' ? document.getElementById(elemento) : elemento.closest('div[class^="linha-"]')?.querySelector('textarea');
    if (textarea) {
        textarea.focus();
        document.execCommand('undo');
    }
};

window.refazerTexto = function(elemento) {
    let textarea = typeof elemento === 'string' ? document.getElementById(elemento) : elemento.closest('div[class^="linha-"]')?.querySelector('textarea');
    if (textarea) {
        textarea.focus();
        document.execCommand('redo');
    }
};

// ==========================================
// MOTOR DEFINITIVO DO TEMA VISUAL (ESCURO / CLARO / PRO)
// ==========================================

window.temasDisponiveis = ['tema-escuro', 'tema-claro', 'tema-pro'];

// 1. A Função que faz a troca oficial
if (!window.temaInterceptado) {
    window.cycleTheme = function() {
        let temaAtual = localStorage.getItem('noc_theme') || 'tema-escuro';
        let proximoIndex = (window.temasDisponiveis.indexOf(temaAtual) + 1) % window.temasDisponiveis.length;
        let novoTema = window.temasDisponiveis[proximoIndex];

        document.body.classList.remove('tema-escuro', 'tema-claro', 'tema-pro', 'light-theme', 'light-mode');
        document.body.classList.add(novoTema);
        localStorage.setItem('noc_theme', novoTema);

        window.atualizarTextoBotaoTema();
    };
    window.temaInterceptado = true;
}

// 2. A inteligência do botão
window.atualizarTextoBotaoTema = function() {
    const textoBtn = document.getElementById('texto-btn-tema');
    if (!textoBtn) return;
    const temaAtual = localStorage.getItem('noc_theme') || 'tema-escuro';
    
    if (temaAtual === 'tema-claro') {
        textoBtn.innerHTML = '<span class="icon">☀️</span> Tema Visual: <strong style="color: #F59E0B;">Claro</strong>';
    } else if (temaAtual === 'tema-pro') {
        textoBtn.innerHTML = '<span class="icon">🚀</span> Tema Visual: <strong style="color: #10B981;">PRO</strong>';
    } else {
        textoBtn.innerHTML = '<span class="icon">🌙</span> Tema Visual: <strong style="color: #38BDF8;">Escuro</strong>';
    }
};

// 3. Ao carregar: Aplica CSS Mágico "Eye Care Light Mode"
document.addEventListener('DOMContentLoaded', () => {
    
    if (!document.getElementById('css-tema-claro-v17')) {
        // Limpeza implacável das versões anteriores
        ['', '-v2', '-v3', '-v4', '-v5', '-v6', '-v7', '-v8', '-v9', '-v10', '-v11', '-v12', '-v13', '-v14', '-v15', '-v16'].forEach(v => {
            let old = document.getElementById('css-tema-claro' + v);
            if (old) old.remove();
        });

        const style = document.createElement('style');
        style.id = 'css-tema-claro-v17';
        style.innerHTML = `
            /* FUNDO PRINCIPAL - BRANCO QUENTE/AMARELADO (Eye Care) */
            body.tema-claro { background-color: #FDFBF7 !important; color: #1E293B !important; }

            /* LATERAL DIREITA (FUNDO PRETO DO INFORME) */
            body.tema-claro .preview-side { background-color: #FDFBF7 !important; border-left: 1px solid #E2E8F0 !important; }
            body.tema-claro .dev-signature { color: #94A3B8 !important; }

            /* PAINEIS E MODAIS BASE */
            body.tema-claro .form-side, body.tema-claro .history-side, body.tema-claro .modal-content, 
            body.tema-claro .config-sidebar, body.tema-claro .config-content, body.tema-claro #conteudo-gestao { 
                background-color: #FFFFFF !important; border-color: #E2E8F0 !important; box-shadow: 0 10px 30px rgba(0,0,0,0.06) !important; 
            }

            /* BURACO NEGRO DO HISTÓRICO */
            body.tema-claro .my-card [style*="color: #E2E8F0"], body.tema-claro .my-card [style*="color: rgb(226, 232, 240)"],
            body.tema-claro .my-card [style*="color: #CBD5E1"], body.tema-claro .my-card [style*="color: rgb(203, 213, 225)"],
            body.tema-claro .my-card [style*="color: #F8FAFC"], body.tema-claro .my-card [style*="color: rgb(248, 250, 252)"],
            body.tema-claro .my-card [style*="color: white"], body.tema-claro .my-card [style*="color: #FFFFFF"],
            body.tema-claro .my-card [style*="color: rgb(255, 255, 255)"],
            body.tema-claro .my-card [style*="color: #94A3B8"], body.tema-claro .my-card [style*="color: rgb(148, 163, 184)"],
            body.tema-claro .my-card [style*="color: #64748B"], body.tema-claro .my-card [style*="color: rgb(100, 116, 139)"] { 
                color: #0F172A !important; font-weight: 800 !important; 
            }

            body.tema-claro .tabs-container { background-color: #F1F5F9 !important; border: 1px solid #CBD5E1 !important; border-radius: 8px !important; padding: 4px !important; display: flex !important; gap: 4px !important; }
            body.tema-claro .tab-btn { background-color: transparent !important; color: #64748B !important; border: none !important; font-weight: 700 !important; border-radius: 6px !important; flex: 1 !important; box-shadow: none !important; }
            body.tema-claro .tab-btn:hover { background-color: #E2E8F0 !important; }
            body.tema-claro .tab-btn.active { background-color: #FFFFFF !important; color: #DC2626 !important; box-shadow: 0 2px 4px rgba(0,0,0,0.05) !important; font-weight: 900 !important; }

            /* ---------------------------------------------------- */
            /* 💥 V17: ABAS ANTI-PULO (GEOMETRIA TRAVADA) 💥 */
            /* ---------------------------------------------------- */
            body.tema-claro .section-tabs { 
                border-bottom: 1px solid #0284C7 !important; 
                gap: 4px !important; 
            }
            body.tema-claro .section-tab-btn { 
                background-color: transparent !important; 
                color: #64748B !important; 
                
                /* TRAVA DE GEOMETRIA: As bordas existem, mas são invisíveis! */
                border-top: 3px solid transparent !important; 
                border-left: 1px solid transparent !important; 
                border-right: 1px solid transparent !important; 
                border-bottom: 1px solid #0284C7 !important; 
                
                border-radius: 8px 8px 0 0 !important; 
                font-weight: 800 !important; /* TRAVA DE FONTE: Fica sempre "gorda", evitando que o texto expanda */
                margin-bottom: -1px !important; 
                transition: all 0.2s ease !important; 
            }
            body.tema-claro .section-tab-btn:hover { 
                background-color: #E2E8F0 !important; 
                color: #334155 !important; 
            }
            body.tema-claro .section-tab-btn span { color: inherit !important; } 
            
            body.tema-claro .section-tab-btn.active { 
                background-color: #F1F5F9 !important; 
                color: #0284C7 !important; 
                
                /* As bordas ganham cor, mas o tamanho total de pixels é EXATAMENTE o mesmo! */
                border-top: 3px solid #0284C7 !important; 
                border-left: 1px solid #CBD5E1 !important; 
                border-right: 1px solid #CBD5E1 !important; 
                border-bottom: 1px solid #F1F5F9 !important; /* Borracha da linha base */
                
                font-weight: 800 !important; /* Mesma fonte, sem pulo! */
            }

            /* CAMPOS DE TEXTO E FORMULÁRIO GERAL */
            body.tema-claro .form-section { background-color: #F1F5F9 !important; padding: 20px !important; border: 1px solid #CBD5E1 !important; border-top: none !important; border-radius: 0 0 8px 8px !important; }
            body.tema-claro .input-group { background-color: #FFFFFF !important; border: 1px solid #E2E8F0 !important; border-radius: 8px !important; padding: 15px !important; box-shadow: 0 4px 10px rgba(0,0,0,0.02) !important; }
            body.tema-claro .input-group label { color: #334155 !important; font-weight: 800 !important; margin-bottom: 8px !important; display: block; }
            
            body.tema-claro input:not([type="checkbox"]):not([type="file"]), body.tema-claro textarea, body.tema-claro select { 
                background-color: #F1F5F9 !important; color: #0F172A !important; border: 1px solid transparent !important; border-radius: 6px !important; box-shadow: inset 0 1px 3px rgba(0,0,0,0.05) !important; transition: all 0.2s ease !important;
            }
            body.tema-claro input::placeholder, body.tema-claro textarea::placeholder { color: #94A3B8 !important; }
            body.tema-claro input:focus, body.tema-claro textarea:focus, body.tema-claro select:focus { background-color: #FFFFFF !important; border: 1px solid #0284C7 !important; box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15) !important; }

            /* ---------------------------------------------------- */
            /* 💥 V17: EXTRATOR MÁGICO IMUNE AO JS (NEUTRO) 💥 */
            /* ---------------------------------------------------- */
            body.tema-claro #magic-extractor-container { 
                background-color: #FFFFFF !important; 
                /* Força TODAS as bordas a ficarem cinzas, impedindo o Javascript de pintá-las de azul/vermelho */
                border: 1px solid #CBD5E1 !important; 
                border-left: 1px solid #CBD5E1 !important; 
                border-right: 1px solid #CBD5E1 !important;
                border-top: 1px solid #CBD5E1 !important;
                border-bottom: 1px solid #CBD5E1 !important;
                box-shadow: 0 4px 12px rgba(0,0,0,0.04) !important; 
            }
            body.tema-claro .extractor-bar #magic-paste-area { background-color: #F8FAFC !important; border: 1px solid transparent !important; box-shadow: inset 0 1px 2px rgba(0,0,0,0.03) !important; transition: all 0.2s ease !important;}
            body.tema-claro .extractor-bar #magic-paste-area:focus { background-color: #FFFFFF !important; border: 1px solid #0284C7 !important; }
            body.tema-claro .quick-claim-title { color: #334155 !important; }
            body.tema-claro .quick-claim-bar button { background-color: #F59E0B !important; color: #FFFFFF !important; border: none !important; font-weight: bold; }
            body.tema-claro .extractor-bar button[onclick*="value="] { background-color: #F1F5F9 !important; color: #475569 !important; border: 1px solid #CBD5E1 !important; }
            body.tema-claro .btn-processar { background-color: #DC2626 !important; color: #FFFFFF !important; border: none !important; }

            /* BOTÕES DE MODOS (LINK=VERMELHO | INFRA=AZUL) */
            body.tema-claro .form-mode-tabs { border-color: #CBD5E1 !important; }
            body.tema-claro .mode-btn { background-color: #F8FAFC !important; color: #475569 !important; border: 1px solid #E2E8F0 !important; font-weight: bold; transition: all 0.2s ease !important; }
            body.tema-claro .mode-btn:hover { background-color: #E2E8F0 !important; }
            body.tema-claro #btn-modo-link.active { background-color: #DC2626 !important; color: #FFFFFF !important; border-color: #DC2626 !important; box-shadow: 0 4px 10px rgba(220, 38, 38, 0.3) !important; }
            body.tema-claro #btn-modo-infra.active { background-color: #0284C7 !important; color: #FFFFFF !important; border-color: #0284C7 !important; box-shadow: 0 4px 10px rgba(2, 132, 199, 0.3) !important; }

            body.tema-claro .btn-action { color: #0284C7 !important; font-weight: 800 !important; transition: all 0.2s ease !important; }
            body.tema-claro .btn-action:hover { color: #0369A1 !important; }

            body.tema-claro .action-footer-sleek { background-color: #FFFFFF !important; border: 1px solid #CBD5E1 !important; border-radius: 8px !important; padding: 15px !important; box-shadow: 0 4px 10px rgba(0,0,0,0.03) !important; }
            body.tema-claro .action-footer-sleek > button:first-child { background-color: #FEF2F2 !important; color: #DC2626 !important; border: 1px solid #FCA5A5 !important; transition: all 0.2s ease !important; }
            body.tema-claro .action-footer-sleek > button:first-child:hover { background-color: #FEE2E2 !important; }
            body.tema-claro .btn-footer-dark { background-color: #F8FAFC !important; border: 1px solid #CBD5E1 !important; border-radius: 6px !important; transition: all 0.2s ease !important; }
            body.tema-claro .btn-footer-dark:hover { background-color: #E2E8F0 !important; border-color: #94A3B8 !important; }
            body.tema-claro .btn-footer-dark span { color: #64748B !important; font-weight: 700 !important; } 
            body.tema-claro .btn-footer-dark span:last-child { color: #0F172A !important; font-weight: 900 !important; } 

            body.tema-claro #app-gestao { background-color: #F4F5F0 !important; }
            body.tema-claro #conteudo-gestao, body.tema-claro #gestao-content-area { background-color: #FDFBF7 !important; border-color: #E2E8F0 !important; }

            body.tema-claro .btn-pull { background-color: #F1F5F9 !important; color: #0284C7 !important; border: 1px solid #CBD5E1 !important; font-weight: bold !important; }
            body.tema-claro .btn-pull:hover { background-color: #E2E8F0 !important; }
            body.tema-claro .btn-close-modal { color: #64748B !important; text-shadow: none !important; opacity: 1 !important; }
            body.tema-claro .btn-close-modal:hover { color: #EF4444 !important; }

            body.tema-claro label, body.tema-claro h3, body.tema-claro h4 { color: #334155 !important; }
            body.tema-claro .chip { background-color: #F8FAFC !important; color: #475569 !important; border-color: #CBD5E1 !important; transition: all 0.2s ease !important;}
            body.tema-claro .chip.active { background-color: #E2E8F0 !important; color: #0F172A !important; font-weight: bold; border-color: #94A3B8 !important; }

            body.tema-claro .my-card, body.tema-claro .log-item, body.tema-claro .item-notificacao, body.tema-claro .card-auditoria,
            body.tema-claro .linha-pendencia, body.tema-claro .linha-parada, body.tema-claro .linha-aviso-cliente { 
                background-color: #FFFFFF !important; 
                border-top-color: #E2E8F0 !important; border-right-color: #E2E8F0 !important; border-bottom-color: #E2E8F0 !important;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05) !important; color: #1E293B !important; 
            }
            body.tema-claro .my-card-client, body.tema-claro .log-subject { color: #0F172A !important; font-weight: 900; }
            body.tema-claro .sanfona-header { color: #1E293B !important; }

            body.tema-claro .item-notificacao strong, body.tema-claro .card-auditoria strong, body.tema-claro .my-card-time strong,
            body.tema-claro .log-time span[style*="color:#38bdf8"], body.tema-claro .log-time span[style*="color: #38bdf8"], body.tema-claro .log-time span[style*="color: rgb(56, 189, 248)"] {
                color: #0284C7 !important; font-weight: 900 !important;
            }

            /* ESMAGAR INJEÇÕES JS GERAIS */
            body.tema-claro div[style*="background: #1E293B"], body.tema-claro div[style*="background:#1E293B"], body.tema-claro div[style*="background-color: #1E293B"],
            body.tema-claro div[style*="background: #0F172A"], body.tema-claro div[style*="background:#0F172A"], body.tema-claro div[style*="background-color: #0F172A"],
            body.tema-claro details[style*="background: #1E293B"], body.tema-claro summary[style*="background: #0F172A"],
            body.tema-claro span[style*="background: #1E293B"], body.tema-claro span[style*="background:#1E293B"], body.tema-claro span[style*="background-color: #1E293B"] {
                background-color: #F8FAFC !important; border-color: #CBD5E1 !important;
            }
            
            body.tema-claro *:not(button):not(.my-card-badge):not(.badge-aberto):not(.badge-follow):not(.badge-ok)[style*="color: #F8FAFC"],
            body.tema-claro *:not(button):not(.my-card-badge)[style*="color: white"], body.tema-claro *:not(button):not(.my-card-badge)[style*="color: #FFFFFF"],
            body.tema-claro *:not(button):not(.my-card-badge)[style*="color: #E0E7FF"], body.tema-claro *:not(button)[style*="color: #CBD5E1"] {
                color: #1E293B !important;
            }
            body.tema-claro *:not(button)[style*="color: #94A3B8"] { color: #475569 !important; }

            /* CORREÇÕES CIRÚRGICAS (Modais e Cores) */
            body.tema-claro #header-modal-aceite { background-color: #F8FAFC !important; border-bottom-color: #E2E8F0 !important; }
            body.tema-claro #header-modal-aceite[style*="#0284C7"], body.tema-claro #header-modal-aceite[style*="rgb(2, 132, 199)"] { background-color: #F0F9FF !important; border-bottom-color: #38BDF8 !important; }
            body.tema-claro #header-modal-aceite[style*="#0284C7"] h2, body.tema-claro #header-modal-aceite[style*="rgb(2, 132, 199)"] h2 { color: #0284C7 !important; }
            body.tema-claro #header-modal-aceite[style*="#0284C7"] p, body.tema-claro #header-modal-aceite[style*="rgb(2, 132, 199)"] p { color: #0C4A6E !important; }

            body.tema-claro #header-modal-aceite[style*="#EF4444"], body.tema-claro #header-modal-aceite[style*="rgb(239, 68, 68)"] { background-color: #FEF2F2 !important; border-bottom-color: #FCA5A5 !important; }
            body.tema-claro #header-modal-aceite[style*="#EF4444"] h2, body.tema-claro #header-modal-aceite[style*="rgb(239, 68, 68)"] h2 { color: #DC2626 !important; }
            body.tema-claro #header-modal-aceite[style*="#EF4444"] p, body.tema-claro #header-modal-aceite[style*="rgb(239, 68, 68)"] p { color: #7F1D1D !important; }

            body.tema-claro div[style*="border-left: 3px solid #38BDF8"], body.tema-claro div[style*="border-left: 3px solid rgb(56, 189, 248)"] { background-color: #F0F9FF !important; color: #1E293B !important; border-color: #BAE6FD !important; }
            body.tema-claro div[style*="border-left: 3px solid #38BDF8"] strong, body.tema-claro div[style*="border-left: 3px solid rgb(56, 189, 248)"] strong { color: #0284C7 !important; }

            body.tema-claro div[style*="background: #0C4A6E"], body.tema-claro div[style*="background: rgb(12, 74, 110)"] { background-color: #0C4A6E !important; color: #FFFFFF !important; }
            body.tema-claro div[style*="background: #064E3B"], body.tema-claro div[style*="background: rgb(6, 78, 59)"] { background-color: #064E3B !important; color: #FFFFFF !important; }
            body.tema-claro div[style*="background: #4C1D95"], body.tema-claro div[style*="background: rgb(76, 29, 149)"] { background-color: #4C1D95 !important; color: #FFFFFF !important; }
            body.tema-claro div[style*="grid-template-columns: 1fr 1fr 1fr"] { background-color: #FFFFFF !important; border-color: #CBD5E1 !important; }
            body.tema-claro div[style*="grid-template-columns: 1fr 1fr 1fr"] > div { border-color: #CBD5E1 !important; color: #334155 !important; font-weight: 500 !important; }

            body.tema-claro div[style*="border-left: 3px solid #F59E0B"], body.tema-claro div[style*="border-left: 3px solid rgb(245, 158, 11)"] { background-color: #FFFFFF !important; color: #1E293B !important; border: 1px solid #E2E8F0 !important; border-left: 3px solid #F59E0B !important; }
            body.tema-claro div[style*="border-left: 3px solid #EF4444"], body.tema-claro div[style*="border-left: 3px solid rgb(239, 68, 68)"] { background-color: #FFFFFF !important; color: #1E293B !important; border: 1px solid #E2E8F0 !important; border-left: 3px solid #EF4444 !important; }
            body.tema-claro div[style*="border-left: 3px solid #FCA5A5"], body.tema-claro div[style*="border-left: 3px solid rgb(252, 165, 165)"] { background-color: #FFFFFF !important; color: #1E293B !important; border: 1px solid #E2E8F0 !important; border-left: 3px solid #FCA5A5 !important; }
            body.tema-claro div[style*="color: #FCD34D"], body.tema-claro div[style*="color: rgb(252, 211, 77)"] { color: #92400E !important; background-color: #FFFBEB !important; border-color: #FDE68A !important; }
            
            body.tema-claro details, body.tema-claro .linha-parada, body.tema-claro .linha-aviso-cliente, body.tema-claro .linha-pendencia { background-color: #FFFFFF !important; border-color: #CBD5E1 !important; }
            body.tema-claro summary { background-color: #F4F5F0 !important; color: #1E293B !important; }
            body.tema-claro table thead, body.tema-claro table thead th { background-color: #F4F5F0 !important; color: #334155 !important; border-color: #CBD5E1 !important; }
            body.tema-claro table tr { border-bottom-color: #E2E8F0 !important; }
            body.tema-claro table tr:hover { background-color: #FDFBF7 !important; }
            body.tema-claro .kpi-box, body.tema-claro .chart-box { background-color: #FFFFFF !important; border-color: #E2E8F0 !important; box-shadow: 0 2px 8px rgba(0,0,0,0.04) !important; }
            body.tema-claro .dashboard-select { background-color: #FFFFFF !important; color: #1E293B !important; border-color: #CBD5E1 !important; }
            body.tema-claro .box-cirurgica { border-color: #CBD5E1 !important; }
            body.tema-claro .btn-gestao-menu { color: #475569 !important; }
            body.tema-claro .btn-gestao-menu.active { color: #1E293B !important; background-color: #E2E8F0 !important; }
            body.tema-claro #modal-auditoria-historica > div > div:first-child { background-color: #F0F9FF !important; border-bottom-color: #7DD3FC !important; }
            body.tema-claro #modal-auditoria-historica h2 { color: #0284C7 !important; }
            body.tema-claro #modal-auditoria-historica p { color: #0C4A6E !important; }
            body.tema-claro .user-dropdown { background-color: #FFFFFF !important; border-color: #CBD5E1 !important; box-shadow: 0 10px 25px rgba(0,0,0,0.1) !important; }
            body.tema-claro .user-dropdown .dropdown-item { color: #1E293B !important; }
            body.tema-claro .user-dropdown .dropdown-item:hover { background-color: #F1F5F9 !important; }

            /* Textos das Instruções do Modal de Passagem */
            body.tema-claro #modal-passagem p[style*="color"] { color: #64748B !important; font-weight: 600 !important; }
            body.tema-claro #scroll-passagem > div { background-color: #F8FAFC !important; border-color: #CBD5E1 !important; box-shadow: 0 4px 6px rgba(0,0,0,0.02) !important; }
            body.tema-claro #scroll-passagem > div[style*="border: 1px solid #047857"] { border-color: #10B981 !important; background-color: #F0FDF4 !important; }
            body.tema-claro #scroll-passagem input:not([type="checkbox"]), body.tema-claro #scroll-passagem textarea, body.tema-claro #scroll-passagem select { background-color: #FFFFFF !important; border: 1px solid transparent !important; box-shadow: inset 0 1px 3px rgba(0,0,0,0.05) !important; color: #0F172A !important; transition: all 0.2s ease !important; }
            body.tema-claro #scroll-passagem input:focus, body.tema-claro #scroll-passagem textarea:focus, body.tema-claro #scroll-passagem select:focus { border: 1px solid #0284C7 !important; }
            body.tema-claro #scroll-passagem button[onclick^="adicionar"], body.tema-claro #scroll-passagem button[onclick^="renderizar"] { background-color: #E2E8F0 !important; color: #334155 !important; border: 1px dashed #94A3B8 !important; transition: all 0.2s ease !important; }
            body.tema-claro #scroll-passagem button[onclick^="adicionar"]:hover, body.tema-claro #scroll-passagem button[onclick^="renderizar"]:hover { background-color: #CBD5E1 !important; }
        `;
        document.head.appendChild(style);
    }

    let temaSalvo = localStorage.getItem('noc_theme') || 'tema-escuro';
    document.body.classList.remove('tema-escuro', 'tema-claro', 'tema-pro', 'light-theme', 'light-mode');
    document.body.classList.add(temaSalvo);
    setTimeout(window.atualizarTextoBotaoTema, 200);
});
