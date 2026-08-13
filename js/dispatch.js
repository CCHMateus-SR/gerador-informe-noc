// ==========================================
// MÓDULO DE DESPACHO E MOTOR PRINCIPAL (100% COMPLETO)
// ==========================================
import { db } from './firebase-config.js';
import { currentUser } from './auth.js';
import { mostrarToast } from './ui.js';
import { mostrarAlertaBloqueante } from './sla.js';

export let chamadosDoTurno = []; 
let ultimosLogsFirebase = [];
let visaoHistorico = 'meus';
let filtroAtivo = ''; 
let modoAtual = 'link'; 
let ultimaAssinaturaGerada = '';
let timestampCarregamento = Date.now();

let memoriaNOC = { link: {}, infra: {} };
let sugestoesVisiveis = true; 

// Variáveis de Backup (Desfazer)
let backupFormulario = null;
let backupEstadoAba = null;

window.toggleSugestoes = function() {
    sugestoesVisiveis = !sugestoesVisiveis;
    window.update(); 
}

function atualizarMemoria() {
    memoriaNOC = { link: {}, infra: {} };
    chamadosDoTurno.forEach(log => {
        if (!log.form) return;
        const modo = log.form.modo || 'link';
        const c = (log.form.cliente || '').toUpperCase().trim();
        const h = (log.form.host || '').toUpperCase().trim();
        const i = (log.form.item || '').trim();

        if (!c || !h) return;

        if (!memoriaNOC[modo][c]) memoriaNOC[modo][c] = {};
        if (!memoriaNOC[modo][c][h]) memoriaNOC[modo][c][h] = new Set();
        if (i) memoriaNOC[modo][c][h].add(i);
    });
}

function renderSugestoes(campoId, valores) {
    let containerId = 'sugestoes-' + campoId;
    let container = document.getElementById(containerId);
    
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.style.marginTop = '6px';
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.gap = '6px';
        container.style.alignItems = 'center'; 
        
        let input = document.getElementById(campoId);
        if(input) input.parentNode.insertBefore(container, input.nextSibling);
    }
    
    if (!valores || valores.length === 0) {
        container.innerHTML = '';
        return;
    }

    let textoBotao = sugestoesVisiveis ? 'Ocultar' : 'Mostrar';
    let corBotao = sugestoesVisiveis ? '#94A3B8' : '#3B82F6'; 

    let html = `
        <span style="font-size: 10px; color: #64748B; margin-right: 4px; display: flex; align-items: center; gap: 6px;">
            🧠 Sugestões
            <button onclick="toggleSugestoes()" style="background: transparent; border: 1px solid ${corBotao}; color: ${corBotao}; font-size: 9px; cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: 0.2s;">${textoBotao}</button>
        </span>
    `;
    
    if (sugestoesVisiveis) {
        valores.slice(0, 5).forEach(val => {
            let label = val.split('\n')[0].substring(0, 30); 
            if (val.length > 30) label += '...';
            
            let safeVal = val.replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, "\\n");
            
            html += `<span onclick="document.getElementById('${campoId}').value = '${safeVal}'; window.update();" style="background: #E2E8F0; color: #0F172A; font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 4px; cursor: pointer; border: 1px solid #CBD5E1; transition: 0.2s;" onmouseover="this.style.background='#CBD5E1'" onmouseout="this.style.background='#E2E8F0'">${label}</span>`;
        });
    }
    container.innerHTML = html;
}

const itsLogoUrl = "Logos/logo-its.png";

export function iniciarBancoDeDados() {
    // 🔥 A TRAVA: Baixa APENAS os últimos 300 chamados para a memória, em vez do banco todo!
    db.ref('historico_noc').orderByChild('timestamp').limitToLast(300).on('value', (snapshot) => {
        chamadosDoTurno = [];
        if(snapshot.exists()) { snapshot.forEach(child => { chamadosDoTurno.push(child.val()); }); }
        renderizarListaLateral();
        atualizarDashboard();
        atualizarMemoria(); 
        if(document.getElementById('cliente').value !== '') window.update(); 
    });

    db.ref('historico_noc').orderByChild('timestamp').startAt(timestampCarregamento).on('child_added', (snapshot) => {
        const data = snapshot.val();
        if (data.timestamp <= timestampCarregamento) return; 
        if (currentUser && data.nome !== currentUser.nome) { mostrarAlertaBloqueante(data); }
    });

    db.ref('historico_noc').orderByChild('timestamp').limitToLast(150).on('value', (snapshot) => {
        ultimosLogsFirebase = [];
        snapshot.forEach(child => { ultimosLogsFirebase.push(child.val()); });
    });
}

function atualizarDashboard() {
    let estadoRecente = {};
    chamadosDoTurno.forEach(log => {
        if (log.form) {
            let chave = `${log.form.cliente}-${log.form.host}`;
            if (!estadoRecente[chave] || log.timestamp > estadoRecente[chave].timestamp) { estadoRecente[chave] = log; }
        }
    });
    let qtdAbertos = 0, qtdFollow = 0, qtdOk = 0;
    for (let chave in estadoRecente) {
        const acao = estadoRecente[chave].assunto.split(' | ')[5] || '';
        if (acao.includes('ABERTURA')) qtdAbertos++;
        else if (acao.includes('FOLLOW')) qtdFollow++;
        else if (acao.includes('ENCERRAMENTO')) qtdOk++;
    }
    const dAb = document.getElementById('dash-abertos'); if(dAb) dAb.innerText = `🔴 ${qtdAbertos}`;
    const dFo = document.getElementById('dash-follow'); if(dFo) dFo.innerText = `🟡 ${qtdFollow}`;
    const dOk = document.getElementById('dash-ok'); if(dOk) dOk.innerText = `🟢 ${qtdOk}`;
}

function preverModoPeloServico(servicoBuscado) {
    if (!servicoBuscado) return null;
    const servicoLower = servicoBuscado.toLowerCase().trim();
    let contagemLink = 0; let contagemInfra = 0;
    if (memoriaNOC.link) { Object.values(memoriaNOC.link).forEach(hosts => Object.values(hosts).forEach(itensSet => { itensSet.forEach(item => { if (item.toLowerCase().includes(servicoLower)) contagemLink++; }); })); }
    if (memoriaNOC.infra) { Object.values(memoriaNOC.infra).forEach(hosts => Object.values(hosts).forEach(itensSet => { itensSet.forEach(item => { if (item.toLowerCase().includes(servicoLower)) contagemInfra++; }); })); }
    if (contagemLink > contagemInfra) return 'link';
    if (contagemInfra > contagemLink) return 'infra';
    if (servicoLower.match(/(ping|bgp|link |operadora|fibra|mpls|ipsec|vpn)/)) return 'link';
    if (servicoLower.match(/(cpu|memory|disk|memória|disco|services-auto|ram|swap|banco de dados|sql|vmware)/)) return 'infra';
    return null; 
}

function formatarServicoInteligente(textoBruto) {
    if (!textoBruto) return 'SERVIÇO';
    let linhas = textoBruto.toUpperCase().split('\n').map(l => l.trim()).filter(l => l !== '');
    if (linhas.length === 0) return 'SERVIÇO';
    if (linhas.length === 1) return linhas[0]; 
    let matchUnidade = linhas[0].match(/^UN(\d+)/);
    if (matchUnidade) {
        let numeroUnidade = matchUnidade[1];
        let isTodasAPMesmaUnidade = linhas.every(l => l.startsWith(`UN${numeroUnidade}`) && l.includes('AP'));
        if (isTodasAPMesmaUnidade) { return `AP'S UNIDADE ${numeroUnidade}`; }
    }
    if (linhas.length >= 3) { return 'DIVERSOS'; }
    return linhas.join(' + ');
}

window.enviarAvisoRapido = function() {
    if (!currentUser) return;
    const servico = document.getElementById('quick-item').value.trim();
    const host = document.getElementById('quick-host').value.trim();
    
    if (!servico) { alert("Preencha o Serviço!"); return; }

    const modoInteligente = preverModoPeloServico(servico);
    if (modoInteligente && modoAtual !== modoInteligente) { window.trocarModo(modoInteligente); }
    if (document.getElementById('item').value === '') { document.getElementById('item').value = servico; }
    if (host && document.getElementById('host').value === '') { document.getElementById('host').value = host; }
    window.update(); 

    const agora = new Date();
    db.ref('historico_noc').push({
        tipo: 'aviso_rapido', nome: currentUser.nome, turno: currentUser.turno,
        servico: servico, host: host || 'Não informado',
        hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    document.getElementById('quick-item').value = ''; document.getElementById('quick-host').value = '';
    mostrarToast("✅ Equipe notificada e formulário preparado com sucesso!", "success");
}

function renderizarListaLateral() {
    const lista = document.getElementById('meus-chamados-lista');
    const searchEl = document.getElementById('search-history');
    const termoBusca = searchEl ? searchEl.value.toLowerCase().trim() : '';
    let chamadosExibidos = chamadosDoTurno.filter(c => c.tipo === 'aviso_rapido' || (c.form && (c.form.modo || 'link') === modoAtual));
    
    if (visaoHistorico === 'meus' && currentUser) { chamadosExibidos = chamadosExibidos.filter(c => c.nome === currentUser.nome); }
    
    if (termoBusca !== '') {
        chamadosExibidos = chamadosExibidos.filter(c => {
            const nomeAnalista = String(c.nome || '').toLowerCase();
            let dataFormatada = '';
            if (c.timestamp) {
                const d = new Date(c.timestamp);
                dataFormatada = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            }

            if (c.tipo === 'aviso_rapido') {
                return (c.servico && String(c.servico).toLowerCase().includes(termoBusca)) || 
                       (c.host && String(c.host).toLowerCase().includes(termoBusca)) ||
                       nomeAnalista.includes(termoBusca) || dataFormatada.includes(termoBusca);
            }
            
            return (c.form && c.form.cliente && String(c.form.cliente).toLowerCase().includes(termoBusca)) || 
                   (c.form && c.form.host && String(c.form.host).toLowerCase().includes(termoBusca)) || 
                   (c.form && c.form.item && String(c.form.item).toLowerCase().includes(termoBusca)) ||
                   (c.form && c.form.itssm && String(c.form.itssm).toLowerCase().includes(termoBusca)) ||
                   (c.form && c.form.protocoloLibbs && String(c.form.protocoloLibbs).toLowerCase().includes(termoBusca)) ||
                   nomeAnalista.includes(termoBusca) || dataFormatada.includes(termoBusca);
        });
    }
    if (filtroAtivo !== '') {
        chamadosExibidos = chamadosExibidos.filter(c => {
            if (c.tipo === 'aviso_rapido') return false; 
            const acao = c.assunto ? c.assunto.split(' | ')[5] || '' : '';
            if (filtroAtivo === 'aberto') return acao.includes('ABERTURA');
            if (filtroAtivo === 'follow') return acao.includes('FOLLOW');
            if (filtroAtivo === 'critical') return c.form && c.form.severidade === 'CRITICAL';
            return true;
        });
    }

    chamadosExibidos.reverse();
    if(chamadosExibidos.length === 0) { lista.innerHTML = `<div style="text-align:center; padding: 20px; color: #94A3B8; font-size: 12px;">Nenhum chamado gerado.</div>`; return; }

    let html = '';
    let dataAtualAgrupamento = ""; 

    chamadosExibidos.forEach((log) => {
        if (log.timestamp) {
            const dataLog = new Date(log.timestamp);
            const hoje = new Date();
            const ontem = new Date();
            ontem.setDate(hoje.getDate() - 1);

            const isHoje = dataLog.getDate() === hoje.getDate() && dataLog.getMonth() === hoje.getMonth() && dataLog.getFullYear() === hoje.getFullYear();
            const isOntem = dataLog.getDate() === ontem.getDate() && dataLog.getMonth() === ontem.getMonth() && dataLog.getFullYear() === ontem.getFullYear();

            const dataFormatada = dataLog.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            
            let textoGrupo = dataFormatada; 
            if (isHoje) textoGrupo = "HOJE / ATUAL";
            else if (isOntem) textoGrupo = `Ontem / ${dataFormatada}`;

            // --- CORREÇÃO: DIV DA DATA LIVRE DE FLEXBOX PARA O STICKY FUNCIONAR ---
            if (textoGrupo !== dataAtualAgrupamento) {
                html += `<div class="history-date-label" style="border-left: 4px solid var(--modo-cor-principal); font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">📅 ${textoGrupo}</div>`;
                dataAtualAgrupamento = textoGrupo;
            }
        }

        if (log.tipo === 'aviso_rapido') {
            const srvAviso = log.servico ? log.servico.replace(/'/g, "\\'") : '';
            const hstAviso = log.host ? log.host.replace(/'/g, "\\'") : 'Não informado';
            
            html += `
            <div class="my-card" style="border-left: 4px solid #000000; padding: 10px 14px; margin-bottom: 12px; border-radius: 8px; display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 10px; font-weight: 900; color: inherit; text-transform: uppercase; letter-spacing: 0.5px;">👀 EM ANÁLISE</span>
                    <span style="font-size: 9px; font-weight: 800; opacity: 0.5;">🕒 ${log.hora}</span>
                </div>
                <div style="font-size: 12px; line-height: 1.5; padding-top: 2px;">
                    <span style="font-weight: 800; color: #0EA5E9;">👤 ${log.nome}</span> 
                    <span style="font-weight: 600; font-size: 11px; opacity: 0.5;">pegou:</span> 
                    <strong style="cursor: pointer; margin-left: 2px; font-size: 13px;" onclick="copiarTextoInline(event, '${hstAviso}')" title="Copiar Host">${log.host}</strong> 
                    <span style="opacity: 0.2; margin: 0 4px;">|</span> 
                    <span style="font-weight: 600; cursor: pointer; font-size: 11px; opacity: 0.7;" onclick="copiarTextoInline(event, '${srvAviso}')" title="Copiar Serviço">${log.servico}</span>
                </div>
            </div>`;
            return;
        }
        
        const acao = (log.assunto || '').split(' | ')[5] || 'CHAMADO';
        let classeBadge = acao.includes('FOLLOW') ? 'badge-follow' : (acao.includes('ENCERRAMENTO') ? 'badge-ok' : 'badge-aberto');
        
        const hostLimpo = log.form.host || 'Host Não Informado';
        const servicoResumido = log.form.item ? log.form.item.split('\n')[0] : 'Serviço Não Informado';
        
        const hstSafe = hostLimpo.replace(/'/g, "\\'");
        const srvSafe = servicoResumido.replace(/'/g, "\\'");

        let badgeItssmHTML = '';
        if (log.form && log.form.itssm) {
            const itssmSafe = log.form.itssm.replace(/'/g, "\\'");
            badgeItssmHTML = `<span onclick="event.stopPropagation(); copiarTextoInline(event, '${itssmSafe}')" title="Copiar Nº ITSSM" style="font-size: 9px; background: #E2E8F0; color: #0F172A; padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: bold; cursor: pointer; border: 1px solid #CBD5E1; transition: 0.2s;" onmouseover="this.style.background='#CBD5E1'" onmouseout="this.style.background='#E2E8F0'">📋 ${log.form.itssm}</span>`;
        }

        html += `
        <div class="my-card card-${log.form.modo || 'link'}">
            <div class="my-card-header"><span class="my-card-client">${log.form.cliente || 'CLIENTE'}</span><span class="my-card-badge ${classeBadge}">${acao}</span></div>
            
            <div class="my-card-host" style="cursor: pointer; display: flex; align-items: center; flex-wrap: wrap;" title="Clique para copiar o Host" onclick="copiarTextoInline(event, '${hstSafe}')">
                <span>🖥️ ${hostLimpo}</span> ${badgeItssmHTML}
            </div>
            <div class="my-card-service" style="font-size: 11px; margin-top: 4px; color: #475569; cursor: pointer;" title="Clique para copiar o Serviço" onclick="copiarTextoInline(event, '${srvSafe}')">🔖 ${servicoResumido}</div>
            
            <div class="my-card-bottom">
                <span class="my-card-time">🕒 ${log.hora} &nbsp;|&nbsp; <span style="color: #0284C7; font-weight: 700;">👤 ${log.nome}</span></span>
                <button class="btn-pull" onclick="carregarChamadoParaFormulario('${log.timestamp}')">🔄 Puxar Dados</button>
            </div>
        </div>`;
    });
    lista.innerHTML = html;
}

window.renderizarListaLateral = renderizarListaLateral;

window.setVisaoHistorico = function(visao) {
    visaoHistorico = visao;
    document.getElementById('tab-meus').classList.toggle('active', visao === 'meus');
    document.getElementById('tab-equipe').classList.toggle('active', visao === 'equipe');
    renderizarListaLateral();
}
window.aplicarFiltroRapido = function(tipo, btnEl) {
    if (filtroAtivo === tipo) { filtroAtivo = ''; document.querySelectorAll('.chip').forEach(b => b.classList.remove('active')); } 
    else { filtroAtivo = tipo; document.querySelectorAll('.chip').forEach(b => b.classList.remove('active')); btnEl.classList.add('active'); }
    renderizarListaLateral();
}

window.carregarChamadoParaFormulario = function(timestampStr) {
    const log = chamadosDoTurno.find(c => String(c.timestamp) === timestampStr);
    if(!log || !log.form) return;
    if(!confirm("Deseja substituir os dados atuais do formulário por este chamado histórico?")) return;
    const dados = log.form;

    window.trocarModo(dados.modo || 'link');
    document.getElementById('cliente').value = dados.cliente || ''; 
    document.getElementById('host').value = dados.host || '';
    document.getElementById('item').value = dados.item || ''; 
    document.getElementById('severidade').value = dados.severidade || 'WARNING';
    document.getElementById('statusinfo').value = dados.statusinfo || ''; 
    document.getElementById('pressplay').value = dados.pressplay || ''; 
    document.getElementById('status').value = dados.status || 'EM ABERTO'; 
    document.getElementById('protocolo').value = dados.protocolo || '';
    
    const agora = new Date();
    const horaAtualFormatada = `${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    
    // GUARDA NO BOLSO: Salva o horário antigo na memória do campo antes de atualizar
    const fgridEl = document.getElementById('f-grid');
    fgridEl.dataset.historico = dados.fgrid || '-';
    fgridEl.value = horaAtualFormatada;

    let itssmHerdado = dados.itssm || '';
    let libbsHerdado = dados.protocoloLibbs || '';
    if (!itssmHerdado || !libbsHerdado) {
        const hostAlvo = (dados.host || '').toUpperCase().trim();
        const itemAlvo = (dados.item || '').toUpperCase().trim();
        for (let i = chamadosDoTurno.length - 1; i >= 0; i--) {
            const c = chamadosDoTurno[i];
            if (c.form) {
                const logHost = (c.form.host || '').toUpperCase().trim();
                const logItem = (c.form.item || '').toUpperCase().trim();
                if (logHost === hostAlvo && logItem === itemAlvo) {
                    if (!itssmHerdado && c.form.itssm) itssmHerdado = c.form.itssm;
                    if (!libbsHerdado && c.form.protocoloLibbs) libbsHerdado = c.form.protocoloLibbs;
                    if (itssmHerdado && libbsHerdado) break;
                    if (c.form.status === 'RESOLVIDO') break;
                }
            }
        }
    }
    document.getElementById('itssm').value = itssmHerdado;
    if (document.getElementById('protocolo-libbs')) document.getElementById('protocolo-libbs').value = libbsHerdado;

    document.getElementById('inicio').value = dados.inicio || ''; 
    document.getElementById('termino').value = dados.termino || ''; 
    document.getElementById('desc').value = dados.desc || '';
    document.getElementById('solucionador').value = dados.solucionador || ''; 
    document.getElementById('obs').value = dados.obs || '';
    document.getElementById('evidencias').checked = dados.evidencias || false; 
    
    ultimaAssinaturaGerada = ''; 
    window.update();
    mostrarToast("✅ Dados carregados e horário de Follow-Up atualizado!");
    window.ajustarTodasTextareas();
}

function formatarColchetes(texto) { return texto.replace(/\[.*?\]/g, '<span style="color: #DC2626; font-weight: bold;">$&</span>'); }

window.update = function() {
    const severidade = document.getElementById('severidade').value;
    const status = document.getElementById('status').value;
    const vCliente = document.getElementById('cliente').value.toUpperCase().trim();
    const vHost = document.getElementById('host').value.toUpperCase().trim();
    const vItem = document.getElementById('item').value.trim() || '---';
    
    const itemLower = vItem.toLowerCase();
    let avisoCrossTab = '';
    
    if (modoAtual === 'link') {
        if (itemLower.match(/(cpu|memory|disk|memória|disco|services-auto|ram|swap|banco de dados|sql|vmware)/)) {
            avisoCrossTab = '⚠️ Atenção: Este serviço parece ser de Infraestrutura. Você está na aba Link/Ping!';
        }
    } else if (modoAtual === 'infra') {
        if (itemLower.match(/(ping|bgp|link |operadora|fibra|mpls|ipsec|vpn)/)) {
            avisoCrossTab = '⚠️ Atenção: Este serviço parece ser de Conectividade. Você está na aba Infra/Aplicações!';
        }
    }
    
    let divAviso = document.getElementById('aviso-crosstab');
    if (!divAviso) {
        divAviso = document.createElement('div'); divAviso.id = 'aviso-crosstab';
        divAviso.style.cssText = 'color: #DC2626; font-size: 11px; font-weight: bold; margin-top: 4px; display: none; background: #FEE2E2; padding: 4px 8px; border-radius: 4px; border-left: 3px solid #DC2626;';
        const itemInput = document.getElementById('item');
        if (itemInput && itemInput.parentNode) { itemInput.parentNode.insertBefore(divAviso, itemInput.nextSibling); }
    }
    
    if (avisoCrossTab && vItem !== '') { divAviso.innerText = avisoCrossTab; divAviso.style.display = 'block'; } 
    else { if (divAviso) divAviso.style.display = 'none'; }
    
    const grupoLibbs = document.getElementById('grupo-protocolo-libbs');
    if (grupoLibbs) {
        if (vCliente === 'LIBBS' && vHost !== 'LIBBS-DIGIBEE') {
            grupoLibbs.style.display = 'flex'; 
        } else {
            grupoLibbs.style.display = 'none';
        }
    }

    const vInicio = document.getElementById('inicio').value || '---'; 
    const vProtocolo = document.getElementById('protocolo').value || '---'; 
    const vFgrid = document.getElementById('f-grid').value || '-';
    const vTermino = document.getElementById('termino').value || '-'; 
    const vSolucionador = document.getElementById('solucionador').value || '---'; 
    const vStatusInfo = document.getElementById('statusinfo').value.trim();
    const vPressplay = document.getElementById('pressplay').value.trim();
    const vDesc = document.getElementById('desc').value.trim(); 
    const vObs = document.getElementById('obs').value.trim();
    const temEvidencias = document.getElementById('evidencias').checked;

    if (vProtocolo !== '') document.getElementById('protocolo').classList.remove('erro-validacao');
    
    const hostLimpo = document.getElementById('host').value.toUpperCase().trim();
    const itemLimpo = document.getElementById('item').value.trim();

    let hostsSugeridos = [];
    if (vCliente && memoriaNOC[modoAtual] && memoriaNOC[modoAtual][vCliente]) { hostsSugeridos = Object.keys(memoriaNOC[modoAtual][vCliente]); }
    renderSugestoes('host', hostsSugeridos.filter(h => h !== hostLimpo));

    let itensSugeridos = [];
    if (vCliente && hostLimpo && memoriaNOC[modoAtual] && memoriaNOC[modoAtual][vCliente] && memoriaNOC[modoAtual][vCliente][hostLimpo]) { itensSugeridos = Array.from(memoriaNOC[modoAtual][vCliente][hostLimpo]); }
    renderSugestoes('item', itensSugeridos.filter(i => i !== itemLimpo));
    
    let corSeveridade = '#64748B'; let sevTextHeader = '⚪ UNKNOWN';
    if(severidade === 'CRITICAL') { corSeveridade = '#DC2626'; sevTextHeader = '🚨 CRITICAL'; }
    if(severidade === 'WARNING') { corSeveridade = '#D97706'; sevTextHeader = '🟡 WARNING'; }
    if(severidade === 'INTERMITENTE') { corSeveridade = '#EA580C'; sevTextHeader = '⚠️ INTERMITENTE'; }
    if(severidade === 'OK') { corSeveridade = '#166534'; sevTextHeader = '✅ NORMALIZADO'; }
    let displaySeveridade = severidade === 'OK' ? 'OK (NORMALIZADO)' : severidade;

    const headerSevBadge = document.getElementById('header-sev-badge');
    if (headerSevBadge) { headerSevBadge.style.backgroundColor = corSeveridade; headerSevBadge.innerHTML = sevTextHeader; }
    
    let labelTerminoForm = ''; let tituloTerminoBox = ''; let tituloDescBox = 'DETALHAMENTO';
    const headerBg = document.getElementById('v-header-bg'); const topBorder = document.getElementById('render-header-cell');

    let headerBgColor = '#002D5B';
    if (status === 'EM ABERTO') headerBgColor = '#B91C1C'; 
    if (status === 'RESOLVIDO') headerBgColor = '#166534';
    
    if (modoAtual === 'infra') {
        labelTerminoForm = 'Término da Ocorrência'; tituloTerminoBox = 'TÉRMINO DA OCORRÊNCIA'; tituloDescBox = 'LOGS DO SISTEMA / EVIDÊNCIAS';
        document.getElementById('label-desc').innerHTML = "Logs / Evidências Adicionais"; 
        headerBg.setAttribute('bgcolor', headerBgColor); topBorder.style.borderTop = '8px solid #0284C7'; 
    } else {
        document.getElementById('label-desc').innerText = "Ações / Diagnóstico";
        if (status === 'RESOLVIDO') { labelTerminoForm = 'Fim da Ocorrência'; tituloTerminoBox = 'FIM DA OCORRÊNCIA'; } 
        else { labelTerminoForm = 'Previsão de Normalização (SLA)'; tituloTerminoBox = 'PREVISÃO DE NORMALIZAÇÃO (SLA)'; }
        headerBg.setAttribute('bgcolor', headerBgColor); topBorder.style.borderTop = '8px solid #DC2626';
    }
    
    document.getElementById('label-termino').innerText = labelTerminoForm; document.getElementById('v-titulo-termino').innerText = tituloTerminoBox; document.getElementById('v-titulo-desc').innerText = tituloDescBox;

    let prefixoTitulo = modoAtual === 'infra' ? '🖥️ INFORME DE INFRAESTRUTURA' : '🌐 INFORME GESTÃO OPERACIONAL';
    let bgColor, textColor, badgeTexto, tituloTexto;
    if (status === 'RESOLVIDO') { bgColor = '#DCFCE7'; textColor = '#166534'; badgeTexto = 'RESOLVIDO'; tituloTexto = `${prefixoTitulo} | Encerramento de Incidente`; } 
    else if (status === 'EM ABERTO') { bgColor = '#FEE2E2'; textColor = '#991B1B'; badgeTexto = 'EM ABERTO'; tituloTexto = `${prefixoTitulo} | Acompanhamento de Incidente`; } 
    else { bgColor = '#FEF3C7'; textColor = '#92400E'; badgeTexto = 'FOLLOW-UP'; tituloTexto = `${prefixoTitulo} | Follow-up de Incidente`; }

    const headerCell = document.getElementById('render-header-cell');
    
    let logoSrc = (window.bancoDeLogos && window.bancoDeLogos[vCliente]) ? window.bancoDeLogos[vCliente] : null;

    if (logoSrc) { 
        headerCell.innerHTML = `
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="table-layout: fixed; min-height: 90px;">
            <tr>
                <td width="50%" align="center" valign="middle">
                    <img src="Logos/logo-its.png" alt="ITS" style="max-height: 60px; max-width: 180px; width: auto; height: auto; display: inline-block; object-fit: contain;">
                </td>
                <td width="50%" align="center" valign="middle">
                    <img src="${logoSrc}" alt="Logo Cliente" style="max-height: 60px; max-width: 180px; width: auto; height: auto; display: inline-block; object-fit: contain;">
                </td>
            </tr>
        </table>`;
    } else { 
        headerCell.innerHTML = `<img src="Logos/logo-its.png" alt="ITS" style="max-height: 70px; max-width: 250px; width: auto; height: auto; display: block; margin: 0 auto; object-fit: contain;">`;
    }

    document.getElementById('v-titulo').innerText = tituloTexto; 
    
    // AQUI OCORRE A QUEBRA DE LINHAS NO INFORME E O FIM DO ESMAGAMENTO!
    document.getElementById('v-item').innerHTML = vItem.replace(/\n/g, '<br>');
    document.getElementById('v-host').innerHTML = vHost.replace(/\n/g, '<br>') || '---'; 
    
    document.getElementById('v-inicio').innerText = vInicio;
    document.getElementById('v-f-grid').innerHTML = formatarColchetes(vFgrid); 
    document.getElementById('v-termino').innerHTML = formatarColchetes(vTermino);

    const tabelaTerminoPreview = document.getElementById('v-titulo-termino').closest('table');
    if (status === 'EM ABERTO' && vTermino === '-') {
        tabelaTerminoPreview.style.display = 'none';
    } else {
        tabelaTerminoPreview.style.display = 'table';
    }

    const dynamicGrid = document.getElementById('v-dynamic-grid');
    const badgeHTML = `<table cellpadding="0" cellspacing="0" border="0" bgcolor="${bgColor}" style="border-radius: 6px;"><tr><td style="padding: 4px 12px; font-size: 11px; font-weight: 800; color: ${textColor}; font-family: 'Segoe UI', Arial, sans-serif;">${badgeTexto}</td></tr></table>`;
    let badgeSeveridadeHTML = `<table cellpadding="0" cellspacing="0" border="0" bgcolor="${corSeveridade}" style="border-radius: 6px;"><tr><td style="padding: 4px 12px; font-size: 11px; font-weight: 800; color: #FFFFFF; font-family: 'Segoe UI', Arial, sans-serif;">${displaySeveridade}</td></tr></table>`;
    
    if (modoAtual === 'link') {
        if (status === 'RESOLVIDO') {
            dynamicGrid.innerHTML = `
                <tr>
                    <td width="46%" bgcolor="#F1F5F9" class="box-cirurgica" style="padding: 18px; border-radius: 8px; border-bottom: 3px solid #cbd5e1;">
                        <button class="btn-micro-copy" data-html2canvas-ignore="true" onclick="copiarCirurgico('${vProtocolo}', this)">📋</button>
                        <div style="font-size: 9px; color: #64748B; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">Protocolo</div>
                        <div style="font-size: 15px; color: #0F172A; font-weight: 800;">${vProtocolo}</div>
                    </td>
                    <td width="8%"></td>
                    <td width="46%" bgcolor="#F1F5F9" style="padding: 18px; border-radius: 8px; border-bottom: 3px solid #cbd5e1;">
                        <div style="font-size: 9px; color: #64748B; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">Severidade</div>
                        ${badgeSeveridadeHTML}
                    </td>
                </tr>
                <tr height="15"><td></td></tr>
                <tr>
                    <td width="46%" bgcolor="#F1F5F9" class="box-cirurgica" style="padding: 18px; border-radius: 8px; border-bottom: 3px solid #cbd5e1;">
                        <button class="btn-micro-copy" data-html2canvas-ignore="true" onclick="copiarCirurgico('${vSolucionador}', this)">📋</button>
                        <div style="font-size: 9px; color: #64748B; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">Solucionador</div>
                        <div style="font-size: 14px; color: #0F172A; font-weight: 800;">${vSolucionador}</div>
                    </td>
                    <td width="8%"></td>
                    <td width="46%"></td> </tr>`;
        } else {
            dynamicGrid.innerHTML = `
                <tr>
                    <td width="46%" bgcolor="#F1F5F9" class="box-cirurgica" style="padding: 18px; border-radius: 8px; border-bottom: 3px solid #cbd5e1;">
                        <button class="btn-micro-copy" data-html2canvas-ignore="true" onclick="copiarCirurgico('${vProtocolo}', this)">📋</button>
                        <div style="font-size: 9px; color: #64748B; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">Protocolo</div>
                        <div style="font-size: 15px; color: #0F172A; font-weight: 800;">${vProtocolo}</div>
                    </td>
                    <td width="8%"></td>
                    <td width="46%" bgcolor="#F1F5F9" style="padding: 18px; border-radius: 8px; border-bottom: 3px solid #cbd5e1;">
                        <div style="font-size: 9px; color: #64748B; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">Status Atual</div>
                        ${badgeHTML}
                    </td>
                </tr>
                <tr height="15"><td></td></tr>
                <tr>
                    <td width="46%" bgcolor="#F1F5F9" class="box-cirurgica" style="padding: 18px; border-radius: 8px; border-bottom: 3px solid #cbd5e1;">
                        <button class="btn-micro-copy" data-html2canvas-ignore="true" onclick="copiarCirurgico('${vSolucionador}', this)">📋</button>
                        <div style="font-size: 9px; color: #64748B; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">Solucionador</div>
                        <div style="font-size: 14px; color: #0F172A; font-weight: 800;">${vSolucionador}</div>
                    </td>
                    <td width="8%"></td>
                    <td width="46%" bgcolor="#F1F5F9" style="padding: 18px; border-radius: 8px; border-bottom: 3px solid #cbd5e1;">
                        <div style="font-size: 9px; color: #64748B; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">Severidade</div>
                        ${badgeSeveridadeHTML}
                    </td>
                </tr>`;
        }
    } else {
        if (status === 'RESOLVIDO') {
            dynamicGrid.innerHTML = `
                <tr>
                    <td width="46%" bgcolor="#F1F5F9" style="padding: 18px; border-radius: 8px; border-bottom: 3px solid #cbd5e1;">
                        <div style="font-size: 9px; color: #64748B; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">Severidade</div>
                        ${badgeSeveridadeHTML}
                    </td>
                    <td width="8%"></td>
                    <td width="46%"></td> </tr>`;
        } else {
            dynamicGrid.innerHTML = `
                <tr>
                    <td width="46%" bgcolor="#F1F5F9" style="padding: 18px; border-radius: 8px; border-bottom: 3px solid #cbd5e1;">
                        <div style="font-size: 9px; color: #64748B; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">Status Atual</div>
                        ${badgeHTML}
                    </td>
                    <td width="8%"></td>
                    <td width="46%" bgcolor="#F1F5F9" style="padding: 18px; border-radius: 8px; border-bottom: 3px solid #cbd5e1;">
                        <div style="font-size: 9px; color: #64748B; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">Severidade</div>
                        ${badgeSeveridadeHTML}
                    </td>
                </tr>`;
        }
    }

    if (vStatusInfo) { document.getElementById('statusinfo-container').style.display = 'block'; document.getElementById('v-statusinfo').innerHTML = formatarColchetes(vStatusInfo.replace(/\n/g, '<br>')); } else { document.getElementById('statusinfo-container').style.display = 'none'; }
    if (vPressplay && modoAtual === 'infra') { document.getElementById('pressplay-container').style.display = 'block'; document.getElementById('v-pressplay').innerHTML = formatarColchetes(vPressplay.replace(/\n/g, '<br>')); } else { document.getElementById('pressplay-container').style.display = 'none'; }
    if (vDesc) { document.getElementById('detalhamento-container').style.display = 'block'; document.getElementById('v-desc').innerHTML = formatarColchetes(vDesc.replace(/\n/g, '<br>')); } else { document.getElementById('detalhamento-container').style.display = 'none'; }
    document.getElementById('evidencias-container').style.display = temEvidencias ? 'block' : 'none';
    if (vObs) { document.getElementById('obs-container').style.display = 'block'; document.getElementById('v-obs').innerHTML = formatarColchetes(vObs.replace(/\n/g, '<br>')); } else { document.getElementById('obs-container').style.display = 'none'; }
};

function isFormularioSujo() {
    const camposParaChecar = ['cliente', 'host', 'item', 'statusinfo', 'pressplay', 'protocolo', 'itssm', 'protocolo-libbs', 'inicio', 'f-grid', 'termino', 'solucionador', 'obs', 'desc'];
    for (let id of camposParaChecar) {
        const el = document.getElementById(id);
        if (el && el.value.trim() !== '') return true; 
    }
    if (document.getElementById('status').value !== 'EM ABERTO') return true;
    if (document.getElementById('severidade').value !== 'WARNING') return true;
    if (document.getElementById('evidencias').checked) return true;
    return false; 
}

window.trocarModo = function(novoModo) {
    if (modoAtual === novoModo) return; 

    let temDados = isFormularioSujo();

    if (temDados) {
        const confirma = confirm("⚠️ ATENÇÃO!\n\nVocê tem dados preenchidos no formulário.\nSe trocar de aba agora, todas as informações não salvas serão perdidas.\n\nDeseja realmente descartar este rascunho e trocar de aba?");
        if (!confirma) return; 

        const elProtLibbs = document.getElementById('protocolo-libbs');
        backupEstadoAba = {
            cliente: document.getElementById('cliente').value,
            host: document.getElementById('host').value,
            item: document.getElementById('item').value,
            severidade: document.getElementById('severidade').value,
            statusinfo: document.getElementById('statusinfo').value,
            pressplay: document.getElementById('pressplay').value,
            status: document.getElementById('status').value,
            protocolo: document.getElementById('protocolo').value,
            itssm: document.getElementById('itssm').value,
            protocoloLibbs: elProtLibbs ? elProtLibbs.value : '',
            inicio: document.getElementById('inicio').value,
            fgrid: document.getElementById('f-grid').value,
            termino: document.getElementById('termino').value,
            solucionador: document.getElementById('solucionador').value,
            obs: document.getElementById('obs').value,
            desc: document.getElementById('desc').value,
            evidencias: document.getElementById('evidencias').checked,
            modoAnterior: modoAtual
        };
    }

    const camposParaLimpar = ['cliente', 'host', 'item', 'statusinfo', 'pressplay', 'protocolo', 'itssm', 'protocolo-libbs', 'inicio', 'f-grid', 'termino', 'solucionador', 'obs', 'desc'];
    camposParaLimpar.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    
    document.getElementById('status').value = 'EM ABERTO'; 
    document.getElementById('severidade').value = 'WARNING'; 
    document.getElementById('evidencias').checked = false;
    document.getElementById('protocolo').classList.remove('shake-error');
    delete document.getElementById('f-grid').dataset.historico;
    ultimaAssinaturaGerada = '';

    modoAtual = novoModo;
    if (modoAtual === 'infra') {
        document.body.classList.add('tema-infra');
    } else {
        document.body.classList.remove('tema-infra');
    }

    document.getElementById('btn-modo-link').classList.toggle('active', modoAtual === 'link');
    document.getElementById('btn-modo-infra').classList.toggle('active', modoAtual === 'infra');
    
    document.getElementById('titulo-form').innerText = modoAtual === 'link' ? "Gestão de Link / Ping" : "Infraestrutura / Aplicações";
    document.getElementById('label-secao-1').innerHTML = modoAtual === 'link' ? "📍 1. Identificação do Alarme" : "📍 1. Identificação do Incidente";
    document.getElementById('label-host').innerText = modoAtual === 'link' ? "Host / Circuito" : "Host / Servidor";
    document.getElementById('v-label-host').innerText = modoAtual === 'link' ? "Host" : "Host / Servidor";
    
    const placeholderHost = modoAtual === 'link' ? "Ex: MATRIZ-FW-01, RTR-FILIAL-02..." : "Ex: SRV-APP-01, DB-PROD-01...";
    const placeholderItem = modoAtual === 'link' ? "Ex: PING, BGP, LINK APEX 50MB, VPN..." : "Ex: CPU, Memory, Disk, Services-Auto, SQL...";
    
    document.getElementById('host').placeholder = placeholderHost;
    document.getElementById('item').placeholder = placeholderItem;
    
    document.getElementById('grupo-protocolo').style.display = modoAtual === 'link' ? 'flex' : 'none';
    document.getElementById('grupo-pressplay').style.display = modoAtual === 'link' ? 'none' : 'flex'; 
    document.getElementById('grupo-solucionador').style.display = modoAtual === 'link' ? 'flex' : 'none'; 
    document.getElementById('macro-template').style.display = modoAtual === 'link' ? 'inline-block' : 'none';
    
    renderizarListaLateral(); 
    window.update();

    // ... (código de trocar labels, placeholders e display dos grupos) ...
    
    document.getElementById('grupo-protocolo').style.display = modoAtual === 'link' ? 'flex' : 'none';
    document.getElementById('grupo-pressplay').style.display = modoAtual === 'link' ? 'none' : 'flex'; 
    document.getElementById('grupo-solucionador').style.display = modoAtual === 'link' ? 'flex' : 'none'; 
    document.getElementById('macro-template').style.display = modoAtual === 'link' ? 'inline-block' : 'none';
    
    renderizarListaLateral(); 
    window.update();

    // --- MÁGICA: REABRIR AS SANFONAS AO TROCAR DE ABA ---
    if(window.resetarSanfona) window.resetarSanfona();

    // Mostra o Toast com botão de Desfazer se havia dados
    if (temDados) {
        const toastResgateAba = `<div style="display: flex; align-items: center; justify-content: space-between; gap: 15px; width: 100%;"><span>🔄 Aba trocada. Rascunho salvo.</span><button onclick="recuperarDadosAba()" style="background: rgba(255,255,255,0.2); border: 1px solid white; color: white; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px; transition: 0.2s;">↩️ DESFAZER</button></div>`;
        mostrarToast(toastResgateAba, "warning", 10000);
    }
}

window.recuperarDadosAba = function() {
    if (!backupEstadoAba) return;

    modoAtual = backupEstadoAba.modoAnterior;
    document.getElementById('btn-modo-link').classList.toggle('active', modoAtual === 'link');
    document.getElementById('btn-modo-infra').classList.toggle('active', modoAtual === 'infra');

    document.getElementById('titulo-form').innerText = modoAtual === 'link' ? "Gestão de Link / Ping" : "Infraestrutura / Aplicações";
    document.getElementById('label-secao-1').innerHTML = modoAtual === 'link' ? "📍 1. Identificação do Alarme" : "📍 1. Identificação do Incidente";
    document.getElementById('label-host').innerText = modoAtual === 'link' ? "Host / Circuito" : "Host / Servidor";
    document.getElementById('v-label-host').innerText = modoAtual === 'link' ? "Host" : "Host / Servidor";

    const placeholderHost = modoAtual === 'link' ? "Ex: MATRIZ-FW-01, RTR-FILIAL-02..." : "Ex: SRV-APP-01, DB-PROD-01...";
    const placeholderItem = modoAtual === 'link' ? "Ex: PING, BGP, LINK APEX 50MB, VPN..." : "Ex: CPU, Memory, Disk, Services-Auto, SQL...";

    document.getElementById('host').placeholder = placeholderHost;
    document.getElementById('item').placeholder = placeholderItem;

    document.getElementById('grupo-protocolo').style.display = modoAtual === 'link' ? 'flex' : 'none';
    document.getElementById('grupo-pressplay').style.display = modoAtual === 'link' ? 'none' : 'flex';
    document.getElementById('grupo-solucionador').style.display = modoAtual === 'link' ? 'flex' : 'none';
    document.getElementById('macro-template').style.display = modoAtual === 'link' ? 'inline-block' : 'none';

    document.getElementById('cliente').value = backupEstadoAba.cliente;
    document.getElementById('host').value = backupEstadoAba.host;
    document.getElementById('item').value = backupEstadoAba.item;
    document.getElementById('severidade').value = backupEstadoAba.severidade;
    document.getElementById('statusinfo').value = backupEstadoAba.statusinfo;
    document.getElementById('pressplay').value = backupEstadoAba.pressplay;
    document.getElementById('status').value = backupEstadoAba.status;
    document.getElementById('protocolo').value = backupEstadoAba.protocolo;
    document.getElementById('itssm').value = backupEstadoAba.itssm;
    if (document.getElementById('protocolo-libbs')) document.getElementById('protocolo-libbs').value = backupEstadoAba.protocoloLibbs;
    document.getElementById('inicio').value = backupEstadoAba.inicio;
    document.getElementById('f-grid').value = backupEstadoAba.fgrid;
    document.getElementById('termino').value = backupEstadoAba.termino;
    document.getElementById('solucionador').value = backupEstadoAba.solucionador;
    document.getElementById('obs').value = backupEstadoAba.obs;
    document.getElementById('desc').value = backupEstadoAba.desc;
    document.getElementById('evidencias').checked = backupEstadoAba.evidencias;

    backupEstadoAba = null; 
    renderizarListaLateral();
    window.update();
    mostrarToast("✨ Aba e dados restaurados com sucesso!", "success");
};

window.mudarStatus = function() { 
    const status = document.getElementById('status').value; 
    const d = new Date(); 
    const pt = `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    const fgridEl = document.getElementById('f-grid');
    
    if (status === 'RESOLVIDO') { 
        document.getElementById('severidade').value = 'OK'; 
        
        // RESTAURAÇÃO MÁGICA: Se puxou do histórico, devolve a hora original do Follow-up!
        if (fgridEl.dataset.historico) {
            fgridEl.value = fgridEl.dataset.historico;
            delete fgridEl.dataset.historico; // Esvazia o bolso
        }
        
        // Limpa o campo de Ações/Diagnóstico
        const descEl = document.getElementById('desc');
        if (descEl.value.trim() !== '') {
            descEl.value = '';
        }

        mostrarToast("⚠️ <strong>ATENÇÃO AO ENCERRAMENTO!</strong><br>Preencha o horário exato da normalização e não esqueça de atualizar os logs do Centreon.", "warning", 8000);
    } 
    else if (status === 'FOLLOW-UP') { 
        fgridEl.value = pt; 
        delete fgridEl.dataset.historico; // Se vai dar novo follow-up real, limpa a memória antiga
    }
    else {
        delete fgridEl.dataset.historico; // Se voltou pra Em Aberto, limpa também
    }
    
    window.update();
}

window.inserirMacro = function(valor) {
    if(!valor) return;
    const desc = document.getElementById('desc'); const statusAtual = document.getElementById('status').value; const severidadeAtual = document.getElementById('severidade').value;
    let texto = "";
    switch(valor) {
        case 'padrao':
            if (statusAtual === 'EM ABERTO') { texto = "Ações Iniciais: Identificamos a indisponibilidade de comunicação com o host acima e imediatamente acionamos a operadora responsável para análise técnica.\n\nNo momento, aguardamos o diagnóstico inicial e a previsão de normalização (SLA). Enviaremos atualizações assim que houver novidades."; } 
            else if (statusAtual === 'FOLLOW-UP') { texto = "Atualização de Status: Em novo contato com a operadora, fomos informados de que [descrever a atualização, ex: há uma falha massiva na região / o técnico está em deslocamento para o local].\n\nA previsão de normalização informada pela operadora é para as [HH: MM]. Continuamos monitorando o circuito de perto e cobraremos agilidade na tratativa."; } 
            else if (statusAtual === 'RESOLVIDO') { texto = "Resolução e Diagnóstico: Informamos que o serviço de comunicação foi restabelecido e encontra-se estável.\n\nSegundo o parecer técnico da operadora, a falha foi ocasionada por [causa raiz, ex: rompimento de fibra óptica na região / travamento do equipamento, sendo necessário reset físico].\n\nO incidente está encerrado. Permanecemos à disposição em caso de novas intermitências."; }
            if (severidadeAtual === 'INTERMITENTE') { texto = texto.replace("indisponibilidade de comunicação", "instabilidade e perda de pacotes na comunicação").replace("foi restabelecido", "foi estabilizado"); }
            break;
        case 'fibra': texto = "Identificamos indícios de rompimento de fibra ótica na região. A equipe técnica de campo da operadora já foi acionada e encontra-se em deslocamento para realizar o mapeamento e reparo físico no trecho afetado."; break;
        case 'eletrica': texto = "Identificamos que o equipamento encontra-se indisponível devido a uma provável falha massiva no fornecimento de energia elétrica na região (incidente com a concessionária local). Aguardamos o restabelecimento da energia comercial para normalização do serviço."; break;
        case 'pos_reparo': texto = "Informamos que o serviço de comunicação foi restabelecido. Contudo, o NOC manterá o circuito em acompanhamento de estabilidade e verificação de métricas antes do encerramento definitivo do incidente."; break;
        case 'n2': texto = "O incidente foi escalonado para a equipe de Engenharia (N2) da operadora, que está realizando análises aprofundadas no backbone e em rotas alternativas para identificar a causa raiz da instabilidade."; break;
        case 'validacao': texto = "A operadora informa que os testes apontam normalidade no circuito. Solicitamos, por gentileza, que a equipe local valide a disponibilidade dos serviços e acesso às aplicações internas para seguirmos com o encerramento."; break;
    }
    if (desc.value.trim() !== "") {
        if(confirm("Substituir o texto atual pela nova macro? (OK = Substituir, Cancelar = Adicionar ao final)")) { desc.value = texto; } else { desc.value = desc.value + "\n\n" + texto; }
    } else { desc.value = texto; }
    window.update();
}

window.limparLogs = function(id) {
    let el = document.getElementById(id); let val = el.value;
    if(val.trim() === "") return;
    val = val.replace(/^\s*[\r\n]/gm, '').replace(/\s+$/gm, '').trim();
    el.value = val; window.update(); 
    mostrarToast("🪄 Texto formatado e organizado com sucesso!", "info", 2000); 
}

window.abrirDatalist = function(element) { if (element.value === '') { try { element.showPicker(); } catch(e) {} return; } const valorSalvo = element.value; element.value = ''; try { element.showPicker(); } catch(e) {} element.addEventListener('focusout', function handler() { if (element.value === '') { element.value = valorSalvo; window.update(); } element.removeEventListener('focusout', handler); }, { once: true }); }
window.abrirPicker = function(id) { try { document.getElementById(id).showPicker(); } catch (e) { alert("Use o preenchimento manual."); } }

window.inserirDataPicker = function(idTexto, valor) { 
    if (!valor) return; const d = valor.split('T'); const pt = `${d[0].split('-').reverse().join('/')} às ${d[1]}`; 
    document.getElementById(idTexto).value = pt; window.update(); 
}

window.preencherAgoraText = function(idTexto) { 
    const d = new Date(); const pt = `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`; 
    document.getElementById(idTexto).value = pt; window.update(); 
}

function validarCamposObrigatorios(exigeProtocolo = false) {
    let valido = true; const campos = ['cliente', 'host', 'item'];
    campos.forEach(id => { const el = document.getElementById(id); if (!el.value.trim()) { el.classList.add('shake-error'); setTimeout(() => el.classList.remove('shake-error'), 500); valido = false; } });
    if (exigeProtocolo) {
        const status = document.getElementById('status').value; const protocolo = document.getElementById('protocolo');
        if (modoAtual === 'link' && (status === 'FOLLOW-UP' || status === 'RESOLVIDO') && protocolo.value.trim() === '') {
            protocolo.classList.add('shake-error'); setTimeout(() => protocolo.classList.remove('shake-error'), 500);
            mostrarToast("⚠️ Protocolo da operadora é obrigatório para este status.", "warning"); return false;
        }
    }
    if (!valido) { mostrarToast("⚠️ Preencha os campos obrigatórios destacados em vermelho.", "warning"); }
    return valido;
}

function obterAssuntoGerado() {
    let cliente = document.getElementById('cliente').value.toUpperCase() || 'CLIENTE';
    const host = document.getElementById('host').value.toUpperCase() || 'HOST';
    
    let primeiraParte = "";
    if (cliente === 'LIBBS' && host === 'LIBBS-DIGIBEE') { 
        primeiraParte = `[DIGIBEE] | ${host}`; 
    } else {
        if (cliente === 'CSD (GRUPO AMIGÃO)') { 
            cliente = 'GRUPO AMIGÃO'; 
        } else if (cliente === 'AGROSTAHL (STAHL)') { 
            cliente = 'STAHL'; 
        } else if (cliente === 'TECNOGERA (TNG)') {
            cliente = 'TECNOGERA';
        }
        primeiraParte = `${cliente} | ${host}`;
    }

    const itemRaw = document.getElementById('item').value.trim(); 
    const item = formatarServicoInteligente(itemRaw);
    
    let severidade = document.getElementById('severidade').value; 
    if (severidade === 'OK') { severidade = 'NORMALIZADO'; }

    const statusSelect = document.getElementById('status').value;
    let acao = statusSelect === 'EM ABERTO' ? 'ABERTURA' : (statusSelect === 'FOLLOW-UP' ? 'FOLLOW-UP' : 'ENCERRAMENTO');
    
    let campoDataHoraAlvo = '';
    if (statusSelect === 'EM ABERTO') { campoDataHoraAlvo = document.getElementById('inicio').value.trim(); } 
    else if (statusSelect === 'FOLLOW-UP') { campoDataHoraAlvo = document.getElementById('f-grid').value.trim(); } 
    else if (statusSelect === 'RESOLVIDO') { campoDataHoraAlvo = document.getElementById('termino').value.trim(); }
    
    let timestampAssunto = "";
    if (campoDataHoraAlvo) {
        let match = campoDataHoraAlvo.match(/(\d{2}\/\d{2}\/\d{4}).*?(\d{2}:\d{2})/);
        if (match) { timestampAssunto = `${match[1]} - ${match[2]}`; } else { timestampAssunto = campoDataHoraAlvo.substring(0, 20); }
    } else {
        const agora = new Date(); const dataFormatada = agora.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric'}); const horaFormatada = agora.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
        timestampAssunto = `${dataFormatada} - ${horaFormatada}`;
    }

    return `${primeiraParte} | ${item} | ${severidade} | ${timestampAssunto} | ${acao}`;
}

function registrarHistoricoNuvem(assunto) {
    if(!currentUser) return;
    
    const elProtLibbs = document.getElementById('protocolo-libbs');
    const valorProtLibbs = elProtLibbs ? elProtLibbs.value : '';

    const formData = {
        modo: modoAtual, cliente: document.getElementById('cliente').value, host: document.getElementById('host').value, item: document.getElementById('item').value, severidade: document.getElementById('severidade').value,
        statusinfo: document.getElementById('statusinfo').value, pressplay: document.getElementById('pressplay').value, status: document.getElementById('status').value, 
        protocolo: document.getElementById('protocolo').value, itssm: document.getElementById('itssm').value, 
        protocoloLibbs: valorProtLibbs, 
        inicio: document.getElementById('inicio').value, fgrid: document.getElementById('f-grid').value, termino: document.getElementById('termino').value, desc: document.getElementById('desc').value, 
        solucionador: document.getElementById('solucionador').value, obs: document.getElementById('obs').value, evidencias: document.getElementById('evidencias').checked 
    };
    db.ref('historico_noc').push({
        tipo: 'relatorio', nome: currentUser.nome, turno: currentUser.turno, assunto: assunto,
        hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: firebase.database.ServerValue.TIMESTAMP, form: formData 
    });
}

window.vincularRegistroITSSM = function() {
    const itssm = document.getElementById('itssm').value.trim();
    const elProtLibbs = document.getElementById('protocolo-libbs');
    const libbs = elProtLibbs ? elProtLibbs.value.trim() : '';

    if (!itssm && !libbs) { mostrarToast("⚠️ Digite o número do ITSSM ou Protocolo Libbs primeiro!", "warning"); return; }
    
    const hostAtual = document.getElementById('host').value.toUpperCase().trim();
    const itemAtual = document.getElementById('item').value.toUpperCase().trim();
    
    if (!hostAtual || !itemAtual) { mostrarToast("⚠️ Preencha o Host e o Serviço para vincular.", "warning"); return; }
    
    db.ref('historico_noc').once('value', snapshot => {
        if (snapshot.exists()) {
            let updates = {};
            let encontrou = false;
            let logsArr = [];
            
            snapshot.forEach(child => {
                logsArr.push({ key: child.key, data: child.val() });
            });
            
            logsArr.sort((a, b) => b.data.timestamp - a.data.timestamp);
            
            for (let i = 0; i < logsArr.length; i++) {
                const log = logsArr[i];
                const data = log.data;
                
                if (data.tipo === 'relatorio' && data.form) {
                    const logHost = (data.form.host || '').toUpperCase().trim();
                    const logItem = (data.form.item || '').toUpperCase().trim();
                    
                    if (logHost === hostAtual && logItem === itemAtual) {
                        if (itssm) updates[`${log.key}/form/itssm`] = itssm;
                        if (libbs) updates[`${log.key}/form/protocoloLibbs`] = libbs;
                        encontrou = true;
                        if (data.form.status === 'RESOLVIDO') { break; }
                    }
                }
            }
            
            if (encontrou) {
                db.ref('historico_noc').update(updates).then(() => {
                    mostrarToast("🔗 Registros vinculados ao ciclo atual deste chamado!", "success");
                });
            } else {
                mostrarToast("⚠️ Gere o chamado (IMAGEM ou TEXTO) antes de tentar vincular.", "warning");
            }
        }
    });
}

function verificarDuplicidade() {
    let cliente = document.getElementById('cliente').value.toUpperCase().trim();
    if (cliente === 'CSD (GRUPO AMIGÃO)') cliente = 'GRUPO AMIGÃO';
    if (cliente === 'AGROSTAHL (STAHL)') cliente = 'STAHL'; 
    if (cliente === 'TECNOGERA (TNG)') cliente = 'TECNOGERA';
    
    const host = document.getElementById('host').value.toUpperCase().trim(); 
    const itemRaw = document.getElementById('item').value.trim(); 
    const item = formatarServicoInteligente(itemRaw);
    const statusSelect = document.getElementById('status').value;
    
    if (!cliente || !host) return true;

    let acao = statusSelect === 'EM ABERTO' ? 'ABERTURA' : (statusSelect === 'FOLLOW-UP' ? 'FOLLOW-UP' : 'ENCERRAMENTO');
    const buscaStr = `${cliente} | ${host} | ${item}`; 
    
    const AGORA_MS = Date.now();
    const TRINTA_MINUTOS_MS = 30 * 60 * 1000;

    for(let i = ultimosLogsFirebase.length - 1; i >= 0; i--) {
        let log = ultimosLogsFirebase[i];
        if (log.tipo === 'aviso_rapido') continue; 
        
        if(log.assunto && log.assunto.includes(buscaStr) && log.assunto.includes(acao)) {
            const tempoPassado = AGORA_MS - log.timestamp;
            if (tempoPassado < TRINTA_MINUTOS_MS) {
                if(currentUser && log.nome !== currentUser.nome) { 
                    return confirm(`⚠️ COLISÃO RECENTE!\n\nO analista ${log.nome} enviou um(a) ${acao} idêntico há apenas ${Math.round(tempoPassado/60000)} minutos.\n\nDeseja realmente gerar outro agora?`); 
                }
            } else {
                continue; 
            }
        }
    }
    return true;
}

// --- LIMPEZA DO "A GERAR..." REALIZADA AQUI ---
window.copyAsImage = function() {
    if (!validarCamposObrigatorios(true)) return;
    const fgrid = document.getElementById('f-grid').value.trim();
    const assinaturaAtual = `${modoAtual}|${document.getElementById('cliente').value.toUpperCase().trim()}|${document.getElementById('host').value.toUpperCase().trim()}|${document.getElementById('status').value}|${fgrid}`;
    
    if (assinaturaAtual !== ultimaAssinaturaGerada) { 
        if (!verificarDuplicidade()) return; 
        registrarHistoricoNuvem(obterAssuntoGerado()); 
        ultimaAssinaturaGerada = assinaturaAtual; 
    }

    const node = document.getElementById('render'); 
    const clone = node.cloneNode(true); 
    clone.style.position = 'absolute'; 
    clone.style.top = '-9999px'; 
    clone.style.left = '-9999px'; 
    clone.style.width = '650px'; 
    clone.style.height = 'auto'; 
    document.body.appendChild(clone);
    
    html2canvas(clone, { scale: 1.2, useCORS: true, backgroundColor: '#ffffff' }).then(canvas => {
        document.body.removeChild(clone);
        canvas.toBlob(blob => { 
            try { 
                const item = new ClipboardItem({ "image/png": blob }); 
                navigator.clipboard.write([item]).then(() => { 
                    mostrarToast("📸 IMAGEM HD COPIADA E GUARDADA NO HISTÓRICO!", "success"); 
                }); 
            } catch (err) { 
                alert("A cópia de imagem não é suportada no seu navegador atual."); 
            } 
        });
    }).catch(err => { 
        document.body.removeChild(clone); 
        alert("Erro ao gerar a imagem."); 
    });
}

window.copyITSSM = function() {
    if (!validarCamposObrigatorios()) return;
    
    const fgrid = document.getElementById('f-grid').value.trim();
    const assinaturaAtual = `${modoAtual}|${document.getElementById('cliente').value.toUpperCase().trim()}|${document.getElementById('host').value.toUpperCase().trim()}|${document.getElementById('status').value}|${fgrid}`;
    
    if (assinaturaAtual !== ultimaAssinaturaGerada) { 
        if (!verificarDuplicidade()) return; 
        registrarHistoricoNuvem(obterAssuntoGerado()); 
        ultimaAssinaturaGerada = assinaturaAtual; 
    }
    
    const vCliente = document.getElementById('cliente').value.toUpperCase().trim() || '---'; 
    const vHost = document.getElementById('host').value.toUpperCase().trim() || '---'; 
    const vItem = document.getElementById('item').value.trim() || '---'; 
    const vItssm = document.getElementById('itssm').value.trim(); 
    const vProtocolo = document.getElementById('protocolo').value.trim(); 
    
    const elProtLibbs = document.getElementById('protocolo-libbs');
    const vProtLibbs = elProtLibbs ? elProtLibbs.value.trim() : '';

    const vInicio = document.getElementById('inicio').value || '---'; 
    const vFgrid = document.getElementById('f-grid').value || '-'; 
    const vTermino = document.getElementById('termino').value || '-'; 
    const vStatusInfo = document.getElementById('statusinfo').value.trim();
    
    let textoITSSM = `Cliente: ${vCliente}\nHost: ${vHost}\nItem Monitorado (Serviço): ${vItem}\n`;
    
    if (vItssm) { textoITSSM += `Nº Registro ITSSM: ${vItssm}\n`; }
    if (vProtocolo) { textoITSSM += `Protocolo Operadora: ${vProtocolo}\n`; }
    
    textoITSSM += `Início da ocorrência: ${vInicio}\nFollow-up da ocorrência: ${vFgrid}\nTérmino da ocorrência: ${vTermino}\n`;
    
    if (vStatusInfo) { textoITSSM += `\nDados Técnicos (Status Information do Centreon):\n${vStatusInfo}\n`; }
    
    const vPressplay = document.getElementById('pressplay').value.trim();
    if (modoAtual === 'infra' && vPressplay) { textoITSSM += `\nRetorno / Logs do PressPlay:\n${vPressplay}\n`; }
    
    const vSolucionador = document.getElementById('solucionador').value.trim();
    if (vSolucionador) { 
        const labelSoluc = modoAtual === 'infra' ? 'Solucionador (Equipe / TI Local)' : 'Solucionador (Operadora / Analista)'; 
        textoITSSM += `\n${labelSoluc}: ${vSolucionador}\n`; 
    }
    
    const vDesc = document.getElementById('desc').value.trim();
    if (vDesc) { 
        const labelDesc = modoAtual === 'infra' ? 'Logs / Evidências Adicionais' : 'Ações / Diagnóstico'; 
        textoITSSM += `\n${labelDesc}:\n${vDesc}\n`; 
    }
    
    const vObs = document.getElementById('obs').value.trim(); 
    if (vObs) { textoITSSM += `\nObservação:\n${vObs}\n`; }

    if (vCliente === 'LIBBS' && vHost !== 'LIBBS-DIGIBEE') {
        textoITSSM += `\nProtocolo Libbs (E-mail): ${vProtLibbs}\n`;
    }

    try { 
        const tempTextarea = document.createElement("textarea"); 
        tempTextarea.value = textoITSSM; 
        document.body.appendChild(tempTextarea); 
        tempTextarea.select(); 
        document.execCommand("copy"); 
        document.body.removeChild(tempTextarea); 
        mostrarToast("📝 TEXTO ITSSM COPIADO COM SUCESSO!", "info"); 
    } catch(e) {}
}

window.copiarAssuntoAcao = function() {
    if (!validarCamposObrigatorios()) return;
    const assunto = obterAssuntoGerado();
    
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(assunto).then(() => { mostrarToast("✉️ ASSUNTO COPIADO COM SUCESSO!", "info"); }).catch(err => { console.error("Erro na API Clipboard: ", err); });
    } else {
        try { const tempInput = document.createElement("input"); tempInput.value = assunto; document.body.appendChild(tempInput); tempInput.select(); document.execCommand("copy"); document.body.removeChild(tempInput); mostrarToast("✉️ ASSUNTO COPIADO COM SUCESSO!", "info"); } catch(e) {}
    }
}

window.copiarAssuntoITSSM = function() {
    if (!validarCamposObrigatorios()) return;
    const host = document.getElementById('host').value.toUpperCase().trim() || 'HOST';
    const itemRaw = document.getElementById('item').value.trim(); const servico = formatarServicoInteligente(itemRaw);
    const assuntoITSSM = `${host} - ${servico}`; 
    
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(assuntoITSSM).then(() => { mostrarToast("✉️ ASSUNTO ITSSM COPIADO COM SUCESSO!", "info"); }).catch(err => { console.error("Erro na API Clipboard: ", err); });
    } else {
        try { const tempInput = document.createElement("input"); tempInput.value = assuntoITSSM; document.body.appendChild(tempInput); tempInput.select(); document.execCommand("copy"); document.body.removeChild(tempInput); mostrarToast("✉️ ASSUNTO ITSSM COPIADO COM SUCESSO!", "info"); } catch(e) {}
    }
}

window.limparFormulario = function() {
    if(confirm("Deseja limpar todos os campos?")) {
        const elProtLibbs = document.getElementById('protocolo-libbs');
        
        backupFormulario = {
            cliente: document.getElementById('cliente').value, host: document.getElementById('host').value, item: document.getElementById('item').value, severidade: document.getElementById('severidade').value,
            statusinfo: document.getElementById('statusinfo').value, pressplay: document.getElementById('pressplay').value, status: document.getElementById('status').value,
            protocolo: document.getElementById('protocolo').value, itssm: document.getElementById('itssm').value, 
            protocoloLibbs: elProtLibbs ? elProtLibbs.value : '', 
            inicio: document.getElementById('inicio').value, fgrid: document.getElementById('f-grid').value, termino: document.getElementById('termino').value,
            solucionador: document.getElementById('solucionador').value, obs: document.getElementById('obs').value, desc: document.getElementById('desc').value, evidencias: document.getElementById('evidencias').checked
        };
        
        document.querySelectorAll('input[type="text"], textarea').forEach(campo => campo.value = '');
        document.getElementById('status').value = 'EM ABERTO'; 
        document.getElementById('severidade').value = 'WARNING'; 
        document.getElementById('evidencias').checked = false; 
        document.getElementById('protocolo').classList.remove('shake-error');
        delete document.getElementById('f-grid').dataset.historico;
        ultimaAssinaturaGerada = ''; 
        window.update();
        
        // --- MÁGICA: REABRIR AS SANFONAS AQUI ---
        if(window.resetarSanfona) window.resetarSanfona();
        
        const toastResgate = `<div style="display: flex; align-items: center; justify-content: space-between; gap: 15px; width: 100%;"><span>🧹 Formulário limpo.</span><button onclick="desfazerLimpeza()" style="background: rgba(255,255,255,0.2); border: 1px solid white; color: white; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px; transition: 0.2s;">↩️ DESFAZER</button></div>`;
        mostrarToast(toastResgate, "info", 10000); 
    }
}

window.desfazerLimpeza = function() {
    if (!backupFormulario) return;
    document.getElementById('cliente').value = backupFormulario.cliente; document.getElementById('host').value = backupFormulario.host; document.getElementById('item').value = backupFormulario.item; document.getElementById('severidade').value = backupFormulario.severidade;
    document.getElementById('statusinfo').value = backupFormulario.statusinfo; document.getElementById('pressplay').value = backupFormulario.pressplay; document.getElementById('status').value = backupFormulario.status;
    document.getElementById('protocolo').value = backupFormulario.protocolo; document.getElementById('itssm').value = backupFormulario.itssm; document.getElementById('inicio').value = backupFormulario.inicio;
    
    if (document.getElementById('protocolo-libbs')) document.getElementById('protocolo-libbs').value = backupFormulario.protocoloLibbs || '';
    
    document.getElementById('f-grid').value = backupFormulario.fgrid; document.getElementById('termino').value = backupFormulario.termino; document.getElementById('solucionador').value = backupFormulario.solucionador;
    document.getElementById('obs').value = backupFormulario.obs; document.getElementById('desc').value = backupFormulario.desc; document.getElementById('evidencias').checked = backupFormulario.evidencias;
    backupFormulario = null; window.update(); mostrarToast("✅ Informações restauradas com sucesso!", "success");
}

// ==========================================
// MOTOR DE ANALYTICS E EXPORTAÇÃO INTELIGENTE
// ==========================================
let chamadosFiltradosRadar = [];

window.filtrarRadar = function() {
    const dataInicio = document.getElementById('filtro-data-inicio').value;
    const dataFim = document.getElementById('filtro-data-fim').value;
    const pSeveridade = document.getElementById('filtro-severidade').value;
    
    // Captura em formato de Lista (Array) quem está marcado
    const chkClientes = Array.from(document.querySelectorAll('.chk-cliente:checked')).map(el => el.value);
    const chkAnalistas = Array.from(document.querySelectorAll('.chk-analista:checked')).map(el => el.value);
    
    // Verifica quantos existem no total para saber se o usuário marcou "Todos"
    const totalClientes = document.querySelectorAll('.chk-cliente').length;
    const totalAnalistas = document.querySelectorAll('.chk-analista').length;

    chamadosFiltradosRadar = chamadosDoTurno.slice(-200); 

    if (dataInicio && dataFim) {
        const start = new Date(dataInicio + "T00:00:00").getTime();
        const end = new Date(dataFim + "T23:59:59").getTime();
        chamadosFiltradosRadar = chamadosDoTurno.filter(log => log.timestamp >= start && log.timestamp <= end);
    }

    // Filtra Clientes (Se tiver alguém desmarcado)
    if (chkClientes.length > 0 && chkClientes.length < totalClientes) {
        chamadosFiltradosRadar = chamadosFiltradosRadar.filter(log => log.form && chkClientes.includes(log.form.cliente));
    }

    // Filtra Analistas (Se tiver alguém desmarcado)
    if (chkAnalistas.length > 0 && chkAnalistas.length < totalAnalistas) {
        chamadosFiltradosRadar = chamadosFiltradosRadar.filter(log => chkAnalistas.includes(log.nome));
    }

    // Filtro de Severidade (Mantido igual)
    if (pSeveridade) {
        chamadosFiltradosRadar = chamadosFiltradosRadar.filter(log => log.form && log.form.severidade === pSeveridade);
    }

    renderizarListaRadar(chamadosFiltradosRadar);
    renderizarDashboardGraficos(chamadosFiltradosRadar);
    
    // Oculta os menus ao aplicar
    document.querySelectorAll('.menu-filtro-opcoes').forEach(m => m.classList.remove('mostrar-menu'));
    mostrarToast(`🔍 ${chamadosFiltradosRadar.length} registros analisados.`, 'info');
};

function renderizarListaRadar(logs) {
    const listaHtml = document.getElementById('lista-historico'); 
    listaHtml.innerHTML = '';
    
    if(logs.length === 0) { 
        listaHtml.innerHTML = '<div style="text-align:center; padding: 20px; color: #94A3B8;">Nenhum evento no período selecionado.</div>'; 
        return; 
    }
    
    let html = ''; 
    let qtdAbertos = 0, qtdFollow = 0, qtdOk = 0;
    
    // Renderiza a lista de trás pra frente (mais novos primeiro)
    [...logs].reverse().forEach(item => {
        // Lógica dos contadores baseada na última ação do assunto
        const acao = item.assunto ? item.assunto.split(' | ')[5] || '' : '';
        if (acao.includes('ABERTURA')) qtdAbertos++;
        else if (acao.includes('FOLLOW')) qtdFollow++;
        else if (acao.includes('ENCERRAMENTO')) qtdOk++;

        if (item.tipo === 'aviso_rapido') {
            html += `<div class="log-item" style="border-left-color: #3B82F6; background: #1E293B;"><div class="log-time"><span style="color: #94A3B8;">🕒 ${item.hora} 👀 EM ANÁLISE</span><span style="color:#38bdf8;">👤 ${item.nome}</span></div><span class="log-subject" style="color: #F8FAFC;">Serviço: ${item.servico} | Host: ${item.host}</span></div>`;
        } else {
            const corBorda = (item.form && item.form.modo === 'infra') ? '#0284C7' : 'var(--its-red)'; 
            html += `<div class="log-item" style="border-left-color: ${corBorda}; background: #1E293B;"><div class="log-time"><span style="color: #94A3B8;">🕒 ${item.hora}</span><span style="color:#38bdf8;">👤 ${item.nome}</span></div><span class="log-subject" style="color: #F8FAFC;">${item.assunto}</span></div>`;
        }
    });
    
    listaHtml.innerHTML = html;
    
    // Atualiza os KPIs
    document.getElementById('dash-abertos').innerText = `🔴 ${qtdAbertos}`;
    document.getElementById('dash-follow').innerText = `🟡 ${qtdFollow}`;
    document.getElementById('dash-ok').innerText = `🟢 ${qtdOk}`;
}

// O Novo Exportar Robusto
window.gerarRelatorioInteligente = function() {
    let baseDeDados = chamadosFiltradosRadar.length > 0 ? chamadosFiltradosRadar : chamadosDoTurno;
    
    if (baseDeDados.length === 0) { 
        mostrarToast("Não há dados para exportar.", "warning"); 
        return; 
    }
    
    // O segredo do Excel ler acentos perfeitos: \uFEFF
    let csvContent = "\uFEFF"; 
    
    // Cabeçalho Robusto
    csvContent += "Data/Hora;Analista;Modulo;Ação;Status Atual (Pendência?);Cliente;Host;Serviço;Severidade;Protocolo;ITSSM;SLA Previsto;Observação\n";
    
    baseDeDados.forEach(log => {
        if (log.tipo === 'aviso_rapido' || !log.form) return; 
        
        const dataFormatada = new Date(log.timestamp).toLocaleDateString('pt-BR') + ' ' + log.hora;
        const partesAssunto = log.assunto ? log.assunto.split(' | ') : []; 
        const acao = partesAssunto[5] ? partesAssunto[5].trim() : ''; 
        const servicoLimpo = log.form.item ? log.form.item.split('\n')[0] : ''; 
        
        // Identifica se é uma pendência ativa baseada no último status reportado
        const statusAtual = log.form.status || '-';
        const flagPendencia = (statusAtual !== 'RESOLVIDO') ? `[PENDENTE] ${statusAtual}` : statusAtual;

        // Limpa as quebras de linha para não bugar as linhas do Excel
        const obsLimpa = (log.form.obs || '').replace(/(\r\n|\n|\r)/gm, " ");

        // Usamos ponto e vírgula (;) porque o Excel no Brasil reconhece isso como separador de colunas padrão!
        let row = [
            dataFormatada, log.nome, log.form.modo === 'infra' ? 'Infra' : 'Link', 
            acao, flagPendencia, log.form.cliente || '-', log.form.host || '-', 
            servicoLimpo, log.form.severidade || '-', log.form.protocolo || '-', 
            log.form.itssm || '-', log.form.termino || '-', obsLimpa
        ].map(e => `"${String(e).replace(/"/g, '""')}"`).join(";"); 
        
        csvContent += row + "\n";
    });
    
    // Processo de Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Relatorio_ITS_Analytics_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    mostrarToast("📊 Relatório Inteligente Exportado com Sucesso!", "success");
}

window.gerarPassagemPlantao = function() {
    if (chamadosDoTurno.length === 0) { mostrarToast("Não há chamados neste plantão.", "warning"); return; }
    let estadoRecente = {};
    chamadosDoTurno.forEach(log => { if (log.form) { let chave = `${log.form.cliente}-${log.form.host}`; if (!estadoRecente[chave] || log.timestamp > estadoRecente[chave].timestamp) { estadoRecente[chave] = log; } } });
    let links = []; let infra = [];
    for (let chave in estadoRecente) {
        let log = estadoRecente[chave]; let status = log.form.status; if (status === 'RESOLVIDO') continue; 
        let modo = log.form.modo || 'link'; let cliente = log.form.cliente || 'N/A'; let host = log.form.host || 'N/A'; let item = log.form.item ? log.form.item.split('\n')[0] : 'N/A'; let previsao = log.form.termino || 'Sem previsão (Verificar)'; 
        let prot = log.form.protocolo ? ` | Prot: ${log.form.protocolo}` : ''; 
        let itssmTxt = log.form.itssm ? ` | ITSSM: ${log.form.itssm}` : '';
        let libbsTxt = log.form.protocoloLibbs ? ` | Prot Libbs: ${log.form.protocoloLibbs}` : '';
        
        let linha = `- [${status}] ${cliente} | Host: ${host} | Serviço: ${item}${prot}${itssmTxt}${libbsTxt} (SLA: ${previsao})`;
        if (modo === 'link') links.push(linha); else infra.push(linha);
    }
    if (links.length === 0 && infra.length === 0) { mostrarToast("🎉 Nenhuma pendência em aberto para passagem de plantão!", "success"); return; }
    let textoFinal = "🚨 RESUMO DO PLANTÃO - PENDÊNCIAS 🚨\n";
    if (links.length > 0) textoFinal += "\n🌐 GESTÃO DE LINK / PING:\n" + links.join("\n") + "\n";
    if (infra.length > 0) textoFinal += "\n🖥️ INFRA / APLICAÇÕES:\n" + infra.join("\n") + "\n";
    navigator.clipboard.writeText(textoFinal).then(() => { mostrarToast("📋 Resumo copiado para a área de transferência!", "success", 4000); });
}

window.limparHistoricoPlantao = function() {
    const confirmacao = prompt("⚠️ ATENÇÃO DE SEGURANÇA ⚠️\n\nIsso irá apagar PERMANENTEMENTE todos os chamados atuais do radar...\n\nDigite: CONFIRMAR");
    if (confirmacao !== "CONFIRMAR") { if (confirmacao !== null) alert("Operação cancelada."); return; }
    db.ref('historico_noc').once('value', (snapshot) => {
        if (snapshot.exists()) {
            let updates = {}; snapshot.forEach(child => { updates[child.key] = null; });
            db.ref('historico_noc').update(updates).then(() => { mostrarToast("🗑️ Radar zerado.", "warning", 5000); localStorage.removeItem('noc_sla_state'); window.fecharHistorico(); }).catch((error) => { alert("Erro ao limpar histórico: " + error); });
        } else { mostrarToast("O histórico já está vazio.", "info"); }
    });
}

window.abrirHistorico = function() {
    document.getElementById('modal-historico').style.display = 'flex';
    
    const inputInicio = document.getElementById('filtro-data-inicio');
    const inputFim = document.getElementById('filtro-data-fim');
    if(inputInicio) inputInicio.value = '';
    if(inputFim) inputFim.value = '';
    
    const clientes = new Set();
    const analistas = new Set();
    chamadosDoTurno.forEach(log => {
        if (log.nome) analistas.add(log.nome);
        if (log.form && log.form.cliente && log.form.cliente !== '-') clientes.add(log.form.cliente);
    });

    // 🪄 Cria a lista de Checkboxes de Clientes
    const menuCliente = document.getElementById('menu-cliente');
    menuCliente.innerHTML = `<label class="ms-item ms-item-todos"><input type="checkbox" id="chk-todos-cliente" checked onchange="toggleTodosFiltro('cliente', this)"> (Selecionar Todos)</label>`;
    Array.from(clientes).sort().forEach(c => {
        menuCliente.innerHTML += `<label class="ms-item"><input type="checkbox" class="chk-cliente" value="${c}" checked onchange="verificarFiltroUnico('cliente')"> ${c}</label>`;
    });

    // 🪄 Cria a lista de Checkboxes de Analistas
    const menuAnalista = document.getElementById('menu-analista');
    menuAnalista.innerHTML = `<label class="ms-item ms-item-todos"><input type="checkbox" id="chk-todos-analista" checked onchange="toggleTodosFiltro('analista', this)"> (Selecionar Todos)</label>`;
    Array.from(analistas).sort().forEach(a => {
        menuAnalista.innerHTML += `<label class="ms-item"><input type="checkbox" class="chk-analista" value="${a}" checked onchange="verificarFiltroUnico('analista')"> ${a}</label>`;
    });
    
    // Reseta os nomes dos botões
    document.getElementById('btn-filtro-cliente').innerHTML = '🏢 Clientes (Todos) <span>▼</span>';
    document.getElementById('btn-filtro-analista').innerHTML = '👤 Analistas (Todos) <span>▼</span>';

    if (typeof window.filtrarRadar === 'function') { window.filtrarRadar(); }
}

window.detectarOperadoraOuGeral = function(texto) {
    if (!texto) return "";
    let srvUpper = texto.toUpperCase();
    
    const operadorasConhecidas = [
        "American Tower", "Ligga Telecom", "Noroeste Net", "Mega Telecom", "VSX Networks",
        "JacomeliNET", "ProntoFibra", "AmericaNet", "HostFiber", "Mundivox", "Ultracom",
        "Apex Net", "UP Telecom", "Embratel", "MAXCOMM", "Ascenty", "Texnet", "Alcans",
        "Claro", "GIGA+", "Algar", "Vero", "Vivo", "Net"
    ];

    let encontradas = [];
    for (let op of operadorasConhecidas) {
        if (srvUpper.includes(op.toUpperCase())) {
            if (op === "Net" && !srvUpper.includes("_NET_") && !srvUpper.includes("-NET-") && !srvUpper.endsWith("_NET") && !srvUpper.includes(" APEX NET ")) {
                continue;
            }
            if (!encontradas.includes(op)) encontradas.push(op);
        }
    }

    if (encontradas.length > 1) return "GERAL";

    let linhas = srvUpper.split('\n').map(l => l.trim());
    let temPingPrincipal = linhas.includes("PING") || linhas.includes("PING_PRINCIPAL");
    if (temPingPrincipal && encontradas.length > 0) return "GERAL";

    if (srvUpper.includes("UPTIME") || srvUpper.includes("HARDWARE") || srvUpper.includes("MEMORY") || srvUpper.includes("CPU") || srvUpper.includes("TRAFFIC-GLOBAL")) {
        return "GERAL";
    }

    if (encontradas.length === 1) return encontradas[0];

    return "";
};

window.autoPreencherOperadora = function() {
    let texto = document.getElementById('item').value;
    let resultado = detectarOperadoraOuGeral(texto);
    if (resultado) {
        document.getElementById('solucionador').value = resultado;
    }
};

window.processarExtratorMagico = function() {
    const raw = document.getElementById('magic-paste-area').value;
    if (!raw.trim()) {
        mostrarToast("⚠️ Cole os dados do Centreon primeiro!", "warning");
        return; 
    }

    const elProtLibbs = document.getElementById('protocolo-libbs');
    backupFormulario = {
        cliente: document.getElementById('cliente').value, host: document.getElementById('host').value, item: document.getElementById('item').value, severidade: document.getElementById('severidade').value,
        statusinfo: document.getElementById('statusinfo').value, pressplay: document.getElementById('pressplay').value, status: document.getElementById('status').value,
        protocolo: document.getElementById('protocolo').value, itssm: document.getElementById('itssm').value, 
        protocoloLibbs: elProtLibbs ? elProtLibbs.value : '', 
        inicio: document.getElementById('inicio').value, fgrid: document.getElementById('f-grid').value, termino: document.getElementById('termino').value,
        solucionador: document.getElementById('solucionador').value, obs: document.getElementById('obs').value, desc: document.getElementById('desc').value, evidencias: document.getElementById('evidencias').checked
    };
    
    const camposParaLimpar = ['cliente', 'host', 'item', 'statusinfo', 'pressplay', 'protocolo', 'itssm', 'inicio', 'f-grid', 'termino', 'solucionador', 'obs', 'desc'];
    camposParaLimpar.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    if (elProtLibbs) elProtLibbs.value = '';
    document.getElementById('status').value = 'EM ABERTO'; 
    document.getElementById('severidade').value = 'WARNING'; 
    document.getElementById('evidencias').checked = false;

    let linhas = raw.split('\n').filter(l => l.trim() !== '');
    if (linhas.length === 0) return;

    let servicos = [];
    let rawStatusInfos = []; 
    let hostsDetectados = []; 

    let prioridadeSeveridade = { "CRITICAL": 4, "WARNING": 3, "UNKNOWN": 2, "OK": 1 };
    let piorSeveridadeNum = 0;
    let severidadeFinal = "";
    let menorDuracaoMs = Infinity;

    function parseDurationToMs(durStr) {
        let totalMs = 0;
        let regex = /(\d+)([wdhms])/g;
        let match;
        while ((match = regex.exec(durStr)) !== null) {
            let val = parseInt(match[1]);
            let unit = match[2];
            if (unit === 'w') totalMs += val * 7 * 24 * 60 * 60 * 1000;
            if (unit === 'd') totalMs += val * 24 * 60 * 60 * 1000;
            if (unit === 'h') totalMs += val * 60 * 60 * 1000;
            if (unit === 'm') totalMs += val * 60 * 1000;
            if (unit === 's') totalMs += val * 1000;
        }
        return totalMs;
    }

    let linhasColunas = linhas.map(l => l.split('\t').map(c => c.trim()).filter(c => c !== ''));

    linhasColunas = linhasColunas.map(cols => {
        return cols.filter(c => {
            let up = c.toUpperCase();
            return !up.includes('HTTP ACTION LINK') && 
                   !up.includes('HTTP://') && 
                   !up.includes('HTTPS://') && 
                   !up.includes('NOTIFICATION IS DISABLED') && 
                   !up.includes('NOTIFICATIONS ARE DISABLED');
        });
    });

    let hostMemoria = ""; 

    const regexStatus = /^(OK|CRITICAL|WARNING|UNKNOWN|UP|DOWN|PENDING|CRÍTICO|CRITICO|AVISO|DESCONHECIDO)$/i;
    const regexStatusLog = /(CRITICAL|WARNING|OK|UNKNOWN|UP|DOWN|CRÍTICO|CRITICO|AVISO|DESCONHECIDO)/i;

    linhasColunas.forEach((cols, i) => {
        if (cols.length === 0) return;

        let servicoStr = "";
        let statusStr = cols[cols.length - 1];
        let hostDestaLinha = hostMemoria;

        if (cols.length >= 2) {
            let offset = 0;
            if (cols[0].toLowerCase() === 'vm' || cols[0].trim().length <= 2) {
                offset = 1;
            }
            
            let item0 = cols[offset];
            let item1 = cols[offset + 1];

            if (item1) {
                const isItem1Status = regexStatus.test(item1.trim());
                if (isItem1Status) {
                    servicoStr = item0; 
                } else {
                    if (item0 && !hostsDetectados.includes(item0)) {
                        hostsDetectados.push(item0); 
                    }
                    hostMemoria = item0;
                    hostDestaLinha = item0;
                    servicoStr = item1;
                }
            } else {
                servicoStr = item0;
            }
        } else if (cols.length === 1) {
            let linhaTexto = cols[0];
            let matchStatusLinha = linhaTexto.match(/(CRITICAL|WARNING|OK|UNKNOWN|UP|DOWN|CRÍTICO|CRITICO|AVISO|DESCONHECIDO)\s*-\s*(.*)/i);
            if (matchStatusLinha) {
                statusStr = matchStatusLinha[0];
                linhaTexto = linhaTexto.replace(matchStatusLinha[0], '').trim();
            }
            servicoStr = linhaTexto.split(/\s+/)[0]; 
        }

        if (servicoStr && !servicos.includes(servicoStr)) { servicos.push(servicoStr); }
        
        if (statusStr) { 
            rawStatusInfos.push({ host: hostDestaLinha, servico: servicoStr, status: statusStr }); 
        }

        let statusEncontradoLinha = "";
        
        for (let c of cols) {
            let cUp = c.trim().toUpperCase();
            if (regexStatus.test(cUp)) {
                statusEncontradoLinha = cUp;
                break;
            }
        }
        
        if (!statusEncontradoLinha) {
            let matchLog = statusStr.match(regexStatusLog);
            if (matchLog) statusEncontradoLinha = matchLog[1].toUpperCase();
        }

        if (statusEncontradoLinha) {
            let statusNorm = statusEncontradoLinha.replace('Í', 'I');
            if (statusNorm === 'CRITICO' || statusNorm === 'DOWN') statusNorm = 'CRITICAL';
            else if (statusNorm === 'AVISO') statusNorm = 'WARNING';
            else if (statusNorm === 'DESCONHECIDO') statusNorm = 'UNKNOWN';
            else if (statusNorm === 'UP') statusNorm = 'OK';

            let peso = prioridadeSeveridade[statusNorm] || 0;
            if (peso > piorSeveridadeNum) {
                piorSeveridadeNum = peso;
                severidadeFinal = statusNorm;
            }
        }

        for (let j = 1; j < cols.length - 1; j++) {
            if (/^(\d+[wdhms]\s*)+$/.test(cols[j].trim())) {
                let duracaoAtual = parseDurationToMs(cols[j].trim());
                if (duracaoAtual < menorDuracaoMs) { menorDuracaoMs = duracaoAtual; }
                break; 
            }
        }
    });

    let clienteDetectado = "";
    if (hostsDetectados.length > 0) {
        // 1. Limpeza de caracteres especiais do Centreon (como a estrela amarela ⭐)
        let hostPrincipal = hostsDetectados[0].toUpperCase().replace(/[⭐★]/g, '').trim();

        // 2. Regra específica para VEEAM
        if (hostPrincipal.startsWith('ITS-BKP-VEEAM') && servicos.length > 0) {
            const primeiroServico = servicos[0].toUpperCase();
            const partes = primeiroServico.split('-');
            if (partes.length > 1) {
                const siglaVeeam = partes[1]; 
                if (siglaVeeam === '838') clienteDetectado = '838 SOLUÇÕES';
                else if (siglaVeeam === 'ALBA') clienteDetectado = 'HOTELARIA ALBA';
                else if (siglaVeeam === 'IGUA') clienteDetectado = 'IGUA HOLDING';
                else if (siglaVeeam === 'MEUCURSO') clienteDetectado = 'MEUCURSO';
                else {
                    const clientesLista = Object.keys(logosClientes || {});
                    let match = clientesLista.find(c => c.startsWith(siglaVeeam));
                    if (match) clienteDetectado = match;
                }
            }
        }

        // 3. REGRAS FIXAS E PREFIXOS (Prioridade Máxima sobre a memória)
        if (!clienteDetectado) {
            if (hostPrincipal.includes('LIBBS')) clienteDetectado = 'LIBBS';
            else if (hostPrincipal.includes('AMIGAO') || hostPrincipal.includes('CSD')) clienteDetectado = 'CSD (GRUPO AMIGÃO)';
            else if (hostPrincipal.includes('AGIS')) clienteDetectado = 'GRUPO AGIS';
            else if (hostPrincipal.includes('STAHL')) clienteDetectado = 'AGROSTAHL (STAHL)';
            else if (hostPrincipal.includes('FURACAO')) clienteDetectado = 'FURACÃO';
            else if (hostPrincipal.startsWith('TPG') || hostPrincipal.startsWith('TP-') || hostPrincipal.startsWith('TP_')) clienteDetectado = 'TERESA PEREZ';
            else if (hostPrincipal.startsWith('ALBA')) clienteDetectado = 'HOTELARIA ALBA';
            else if (hostPrincipal.startsWith('TNG')) clienteDetectado = 'TECNOGERA (TNG)';
            else {
                const prefixo = hostPrincipal.split('-')[0].toUpperCase(); 
                const prefixoUnder = hostPrincipal.split('_')[0].toUpperCase();
                const prefixoReal = prefixo.length < prefixoUnder.length ? prefixo : prefixoUnder;
                const clientesPossiveis = Object.keys(logosClientes || {});
                let match = clientesPossiveis.find(c => c.startsWith(prefixoReal));
                if (match) clienteDetectado = match;
            }
        }

        // 4. MEMÓRIA DO PLANTÃO (Fallback seguro caso o prefixo falhe)
        if (!clienteDetectado) {
            for (let modo in memoriaNOC) {
                for (let cli in memoriaNOC[modo]) {
                    if (memoriaNOC[modo][cli][hostsDetectados[0]]) { clienteDetectado = cli; break; }
                }
                if (clienteDetectado) break;
            }
        }
    }

    if (clienteDetectado) { document.getElementById('cliente').value = clienteDetectado; }
    
    if (hostsDetectados.length > 0) { document.getElementById('host').value = hostsDetectados.join(' / '); }
    
    if (servicos.length > 0) {
        let novoItem = servicos.join('\n');
        document.getElementById('item').value = novoItem;
        if (typeof window.detectarOperadoraOuGeral === 'function') {
            let opDetectada = window.detectarOperadoraOuGeral(novoItem);
            if (opDetectada) document.getElementById('solucionador').value = opDetectada;
        }
    }

    if (rawStatusInfos.length > 0) {
        let textoStatusFormatado = "";
        if (rawStatusInfos.length === 1) {
            textoStatusFormatado = rawStatusInfos[0].status;
        } else {
            textoStatusFormatado = rawStatusInfos.map(info => {
                let rotulo = info.servico || 'Item';
                if (hostsDetectados.length > 1 && info.host) { rotulo = `${info.host} | ${rotulo}`; }
                return `[${rotulo}]\n${info.status}`;
            }).join('\n\n');
        }
        document.getElementById('statusinfo').value = textoStatusFormatado;
    }
    
    if (severidadeFinal) { document.getElementById('severidade').value = severidadeFinal; }

    if (menorDuracaoMs !== Infinity) {
        let dataCalculada = new Date(Date.now() - menorDuracaoMs);
        const pt = `${dataCalculada.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric'})} às ${dataCalculada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        document.getElementById('inicio').value = pt;
    }

    document.getElementById('magic-paste-area').value = '';
    window.update();
    
    const toastMsg = `<div style="display: flex; align-items: center; justify-content: space-between; gap: 15px; width: 100%;"><span>🪄 Dados aplicados! O chamado antigo foi limpo.</span><button onclick="desfazerLimpeza()" style="background: rgba(255,255,255,0.2); border: 1px solid white; color: white; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px; transition: 0.2s;">↩️ DESFAZER</button></div>`;
    mostrarToast(toastMsg, "info", 10000);
    window.ajustarTodasTextareas();
}

// ==========================================
// INTELIGÊNCIA DE AUSÊNCIA (TIMELINE)
// ==========================================
window.filtroTimelineAtivo = 'todos'; // Variável global para controlar o filtro

window.gerarResumoAusencia = function() {
    if (!chamadosDoTurno || chamadosDoTurno.length === 0) {
        if (typeof window.mostrarToast === 'function') window.mostrarToast("Aguarde, ainda sincronizando os dados do radar...", "warning");
        return;
    }

    let estadoRecente = {};
    let abertos = [];
    let followup = [];
    
    // Reseta o filtro sempre que gerar um novo resumo
    window.filtroTimelineAtivo = 'todos'; 

    // 1. Filtra só os chamados de LINK e guarda sempre o ÚLTIMO status conhecido de cada Host
    chamadosDoTurno.forEach(log => {
        if (log.form && (log.form.modo === 'link' || !log.form.modo)) {
            let chave = `${log.form.cliente}-${log.form.host}`;
            if (!estadoRecente[chave] || log.timestamp > estadoRecente[chave].timestamp) {
                estadoRecente[chave] = log;
            }
        }
    });

    // 2. Separa quem está sangrando agora (Ignora os Resolvidos)
    for (let chave in estadoRecente) {
        let log = estadoRecente[chave];
        if (log.form.status === 'EM ABERTO') abertos.push(log);
        else if (log.form.status === 'FOLLOW-UP') followup.push(log);
    }

    // Ordenação: Do mais recente para o mais antigo
    abertos.sort((a, b) => b.timestamp - a.timestamp);
    followup.sort((a, b) => b.timestamp - a.timestamp);

    const listaNotificacoes = document.getElementById('lista-notificacoes');
    if (listaNotificacoes) listaNotificacoes.innerHTML = ''; 

    // 3. Monta o Cabeçalho Turbinado com KPIs (AGORA CLICÁVEIS)
    let htmlResumo = `
    <div style="padding: 15px; background: #0F172A; border-radius: 8px; border: 1px solid #334155; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);">
        <div>
            <strong style="color: #38BDF8; font-size: 14px;">📡 Resumo Operacional (Link/Ping)</strong><br>
            <span style="font-size: 11px; color: #94A3B8;">Panorama de pendências ativas neste exato momento.</span>
        </div>
        <div style="display: flex; gap: 10px;">
            <button id="btn-filtro-abertos" onclick="filtrarTimeline('aberto')" style="cursor: pointer; background: #450a0a; color: #fca5a5; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 900; border: 1px solid #7f1d1d; box-shadow: 0 2px 4px rgba(0,0,0,0.3); transition: 0.2s;">🔴 ${abertos.length} ABERTOS</button>
            <button id="btn-filtro-followup" onclick="filtrarTimeline('followup')" style="cursor: pointer; background: #422006; color: #fcd34d; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 900; border: 1px solid #78350f; box-shadow: 0 2px 4px rgba(0,0,0,0.3); transition: 0.2s;">🟡 ${followup.length} FOLLOW-UP</button>
        </div>
    </div>`;

    if (abertos.length === 0 && followup.length === 0) {
        htmlResumo += `<div class="item-notificacao" style="border-left-color: #10B981; background: #064E3B; margin-top: 10px; padding: 15px;">
            <strong style="color: #34D399; font-size: 14px;">✅ TUDO NORMALIZADO</strong><br>
            <span style="color: #A7F3D0; font-size: 12px;">Nenhum incidente de Link/Ping pendente ou sem solução no radar atual! Bom trabalho.</span>
        </div>`;
    } else {
        const tempoDecorrido = (ts) => {
            const diffMinutos = Math.floor((Date.now() - ts) / 60000);
            
            if (diffMinutos < 60) return `${diffMinutos}m`;

            const meses = Math.floor(diffMinutos / 43200); 
            let resto = diffMinutos % 43200;
            
            const dias = Math.floor(resto / 1440); 
            resto = resto % 1440;
            
            const horas = Math.floor(resto / 60);
            const minutos = resto % 60;

            if (meses > 0) {
                let txtMeses = meses === 1 ? 'mês' : 'meses';
                let txtDias = dias === 1 ? 'dia' : 'dias';
                return `${meses} ${txtMeses} e ${dias} ${txtDias}`;
            } else if (dias > 0) {
                let txtDias = dias === 1 ? 'dia' : 'dias';
                return `${dias} ${txtDias} e ${horas}h`;
            } else {
                return `${horas}h ${minutos}m`;
            }
        };

        const gerarCardInterativo = (log, corFundo, corBorda, corTexto, icone, tipo, classeFiltro) => {
            const hostSafe = (log.form.host || '').replace(/'/g, "\\'");
            const cliSafe = (log.form.cliente || '').replace(/'/g, "\\'");
            const timer = tempoDecorrido(log.timestamp);
            const temSLA = log.form.termino && log.form.termino !== '-';
            const dataFormatada = new Date(log.timestamp).toLocaleDateString('pt-BR');
            
            return `
            <div class="item-notificacao ${classeFiltro}" style="background: #1E293B; border: 1px solid #334155; border-left: 4px solid ${corBorda}; margin-bottom: 12px; padding: 15px; border-radius: 8px; transition: all 0.2s ease; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" onmouseover="this.style.borderColor='${corBorda}'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='#334155'; this.style.transform='none';">
                
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="background: ${corFundo}; color: ${corTexto}; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 900; text-transform: uppercase; border: 1px solid ${corBorda};">${icone} ${tipo}</span>
                        <span style="font-size: 11px; color: #94A3B8; font-weight: bold; background: #0F172A; padding: 3px 8px; border-radius: 4px;">⏳ Há ${timer}</span>
                    </div>
                    
                    <button onclick="fecharTimeline(); carregarChamadoParaFormulario('${log.timestamp}')" style="background: #0284C7; color: white; border: none; padding: 6px 15px; border-radius: 6px; font-size: 10px; font-weight: 900; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3); text-transform: uppercase; letter-spacing: 0.5px;" onmouseover="this.style.background='#0369A1'" onmouseout="this.style.background='#0284C7'">
                        🔄 Puxar para Análise
                    </button>
                </div>
                
                <div style="font-size: 15px; margin-bottom: 12px; display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <strong style="color: #38bdf8; cursor: pointer; border-bottom: 1px dashed #38bdf8; padding-bottom: 2px;" onclick="copiarTextoInline(event, '${cliSafe}')" title="Copiar Cliente">${log.form.cliente}</strong> 
                    <span style="color: #475569;">|</span> 
                    <span style="color: #F8FAFC; cursor: pointer; font-weight: bold;" onclick="copiarTextoInline(event, '${hostSafe}')" title="Copiar Host">🖥️ ${log.form.host}</span>
                </div>
                
                <div style="font-size: 11px; color: #64748B; background: #0F172A; padding: 8px 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #1E293B;">
                    <span>👤 Atualizado por: <strong style="color: #E2E8F0;">${log.nome}</strong> em ${dataFormatada} às ${log.hora}</span>
                    ${temSLA ? `<span style="color: #F59E0B; font-weight: bold; display: flex; align-items: center; gap: 4px;">🎯 Previsão SLA: ${log.form.termino}</span>` : '<span style="color: #64748B; font-style: italic;">Sem previsão (Verificar)</span>'}
                </div>
            </div>`;
        };

        // Injetando as classes 'card-aberto' e 'card-followup'
        abertos.forEach(log => {
            htmlResumo += gerarCardInterativo(log, '#450a0a', '#EF4444', '#fca5a5', '🔴', 'CRÍTICO', 'card-aberto');
        });

        followup.forEach(log => {
            htmlResumo += gerarCardInterativo(log, '#422006', '#F59E0B', '#fcd34d', '🟡', 'FOLLOW-UP', 'card-followup');
        });
    }

    if (listaNotificacoes) listaNotificacoes.innerHTML = htmlResumo;
    window.totalNotificacoesNaoLidas = 0;
    
    const badge = document.getElementById('contador-notificacoes');
    if (badge) badge.classList.add('badge-oculto');

    localStorage.setItem('noc_timeline_html', htmlResumo);
    localStorage.setItem('noc_timeline_count', 0);
};

window.filtrarTimeline = function(tipo) {
    const btnAbertos = document.getElementById('btn-filtro-abertos');
    const btnFollowup = document.getElementById('btn-filtro-followup');
    const cardsAbertos = document.querySelectorAll('.card-aberto');
    const cardsFollowup = document.querySelectorAll('.card-followup');

    // Se clicar no botão que já está ativo, ele desfaz o filtro (mostra todos)
    if (window.filtroTimelineAtivo === tipo) {
        window.filtroTimelineAtivo = 'todos';
    } else {
        window.filtroTimelineAtivo = tipo;
    }

    // Aplica as regras visuais
    if (window.filtroTimelineAtivo === 'todos') {
        cardsAbertos.forEach(c => c.style.display = 'block');
        cardsFollowup.forEach(c => c.style.display = 'block');
        btnAbertos.style.opacity = '1';
        btnFollowup.style.opacity = '1';
    } else if (window.filtroTimelineAtivo === 'aberto') {
        cardsAbertos.forEach(c => c.style.display = 'block');
        cardsFollowup.forEach(c => c.style.display = 'none');
        btnAbertos.style.opacity = '1';
        btnFollowup.style.opacity = '0.3'; // Apaga o botão amarelo
    } else if (window.filtroTimelineAtivo === 'followup') {
        cardsAbertos.forEach(c => c.style.display = 'none');
        cardsFollowup.forEach(c => c.style.display = 'block');
        btnAbertos.style.opacity = '0.3'; // Apaga o botão vermelho
        btnFollowup.style.opacity = '1';
    }
};

// ==========================================
// MOTOR DE RENDERIZAÇÃO DOS GRÁFICOS (CHART.JS)
// ==========================================
let chartsInstancias = {}; // Guarda as instâncias para poder apagar antes de recriar

window.renderizarDashboardGraficos = function(logs) {
    if (logs.length === 0) return;

    // 1. Limpa os gráficos antigos da memória para evitar sobreposição bugada
    Object.keys(chartsInstancias).forEach(key => {
        if (chartsInstancias[key]) chartsInstancias[key].destroy();
    });

    // 2. Função Ninja de Agrupamento e Contagem
    const agrupar = (arr, fn) => arr.reduce((acc, obj) => {
        if (!obj.form) return acc;
        const key = fn(obj);
        if (key && key !== '-') acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    // 3. Monta as fatias da pizza baseadas na base de dados
    const dadosAnalista = agrupar(logs, l => l.nome.split(' ')[0]); // Pega só o primeiro nome
    const dadosCliente = agrupar(logs, l => l.form.cliente);
    const dadosSeveridade = agrupar(logs, l => l.form.severidade);
    const dadosModo = agrupar(logs, l => l.form.modo === 'infra' ? 'Infraestrutura' : 'Link de Dados');
    const dadosHost = agrupar(logs, l => l.form.host);
    const dadosServico = agrupar(logs, l => l.form.item ? l.form.item.split('\n')[0].substring(0, 25) + '...' : 'Indefinido'); // Pega só o começo do nome do serviço para não vazar a tela

    // 4. Configuração de Design Universal Escuro
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Inter', sans-serif";
    const paletaCores = ['#38bdf8', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e', '#84cc16'];

    // 5. Função de criação do gráfico (Barra ou Rosca)
    const criarGrafico = (id, tipo, dados, titulo) => {
        const ctx = document.getElementById(id);
        if (!ctx) return;
        
        // Pega as Chaves (nomes) e Valores (quantidades) ordenados do maior para o menor
        let entradas = Object.entries(dados).sort((a, b) => b[1] - a[1]).slice(0, 10); // Pega só o Top 10 para gráficos de barra
        const labels = entradas.map(e => e[0]);
        const values = entradas.map(e => e[1]);

        chartsInstancias[id] = new Chart(ctx.getContext('2d'), {
            type: tipo,
            data: {
                labels: labels,
                datasets: [{
                    label: 'Registros',
                    data: values,
                    backgroundColor: paletaCores,
                    borderWidth: 0,
                    borderRadius: tipo === 'bar' ? 4 : 0 // Arredonda a pontinha da barra
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: tipo !== 'bar', position: 'right', labels: { boxWidth: 10, font: { size: 10 } } },
                    title: { display: true, text: titulo, color: '#F8FAFC', font: { size: 14, weight: 'bold' } }
                },
                scales: tipo === 'bar' ? { 
                    y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } },
                    x: { ticks: { maxRotation: 45, minRotation: 45, font: {size: 9} } }
                } : {}
            }
        });
    };

    // 6. Desenha os 6 gráficos na tela
    criarGrafico('graficoAnalista', 'bar', dadosAnalista, 'Atendimentos por Analista (Top 10)');
    criarGrafico('graficoModo', 'doughnut', dadosModo, 'Tipo de Incidente (Infra vs Link)');
    criarGrafico('graficoCliente', 'bar', dadosCliente, 'Top 10 Clientes Afetados');
    criarGrafico('graficoSeveridade', 'doughnut', dadosSeveridade, 'Distribuição de Severidade');
    criarGrafico('graficoHost', 'bar', dadosHost, 'Top 10 Hosts/Circuitos com Queda');
    criarGrafico('graficoServico', 'bar', dadosServico, 'Itens Monitorados mais Críticos');
};

// ==========================================
// CONTROLES DOS FILTROS DE MÚLTIPLA SELEÇÃO
// ==========================================
window.toggleMenuFiltro = function(idMenu) {
    document.querySelectorAll('.menu-filtro-opcoes').forEach(m => {
        if(m.id !== idMenu) m.classList.remove('mostrar-menu');
    });
    document.getElementById(idMenu).classList.toggle('mostrar-menu');
};

window.toggleTodosFiltro = function(tipo, obj) {
    const estado = obj.checked;
    document.querySelectorAll(`.chk-${tipo}`).forEach(chk => chk.checked = estado);
    atualizarLabelFiltro(tipo);
};

window.verificarFiltroUnico = function(tipo) {
    const todos = document.querySelectorAll(`.chk-${tipo}`);
    const marcados = document.querySelectorAll(`.chk-${tipo}:checked`);
    document.getElementById(`chk-todos-${tipo}`).checked = (todos.length === marcados.length);
    atualizarLabelFiltro(tipo);
};

window.atualizarLabelFiltro = function(tipo) {
    const todos = document.querySelectorAll(`.chk-${tipo}`);
    const marcados = document.querySelectorAll(`.chk-${tipo}:checked`);
    const btn = document.getElementById(`btn-filtro-${tipo}`);
    const icone = tipo === 'cliente' ? '🏢' : '👤';
    
    if (marcados.length === todos.length || marcados.length === 0) {
        btn.innerHTML = `${icone} ${tipo === 'cliente' ? 'Clientes' : 'Analistas'} (Todos) <span>▼</span>`;
    } else {
        btn.innerHTML = `${icone} <b>${marcados.length} Selecionado(s)</b> <span>▼</span>`;
    }
};

// Fecha os menus se o usuário clicar fora
document.addEventListener('click', (e) => {
    if (!e.target.closest('.multi-select-container')) {
        document.querySelectorAll('.menu-filtro-opcoes').forEach(m => m.classList.remove('mostrar-menu'));
    }
});
