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
const logosClientes = {
    "838 SOLUÇÕES": "Logos/logo-838-solucoes.png", "AGROSTAHL (STAHL)": "Logos/logo-agrostahl.png", "ATMOSPHERE": "Logos/logo-atmosphere.png",
    "AUTOPASS": "Logos/logo-autopass.png", "B-SIMPLE": "Logos/logo-b-simple.png", "BANCO BS2": "Logos/logo-banco-bs2.png", "BANCO CARREFOUR": "Logos/logo-banco-carrefour.png",
    "BANCO SOFISA": "Logos/logo-banco-sofisa.png", "BANCO TRICURY": "Logos/logo-banco-tricury.png", "BASE TELCO": "Logos/logo-base-telco.png", "BRASILAGRO (AGRO3)": "Logos/logo-brasilagro.png",
    "CARBON": "Logos/logo-carbon.png", "COGNA": "Logos/logo-cogna.png", "CONAB": "Logos/logo-conab.png", "CSD (GRUPO AMIGÃO)": "Logos/logo-csd.png", "EASY-WAY": "Logos/logo-easy-way.png",
    "FIDI": "Logos/logo-fidi.png", "FOCUS TÊXTIL": "Logos/logo-focus-textil.png", "FURACÃO": "Logos/logo-furacao.png", "GALDERMA BRASIL": "Logos/logo-galderma.png", "GRUPO AGIS": "Logos/logo-grupo-agis.png",
    "HOTELARIA ALBA": "Logos/logo-hotelaria-alba.png", "HIDROMARES BY SGS": "Logos/logo-hidromares.png", "HOSPITAL PERSONAL": "Logos/logo-hospital-personal.png", "SAINT MATTHEWS": "Logos/logo-saint-matthews.png",
    "IGUA HOLDING": "Logos/logo-igua-holding.png", "ITS": "Logos/logo-its-cliente.png", "ITS-COMPLIANCE": "Logos/logo-its-compliance.png", "ITSEG": "Logos/logo-itseg.png", "JMC": "Logos/logo-jmc.png",
    "LIBBS": "Logos/logo-libbs.png", "LINHA UNI": "Logos/logo-linha-uni.png", "LUSH": "Logos/logo-lush.png", "MAKRO": "Logos/logo-makro.png", "MAKRO FOOD SERVICE": "Logos/logo-makro-food.png",
    "MASTER": "Logos/logo-master.png", "MB HEALTH": "Logos/logo-mb-health.png", "MEUCURSO": "Logos/logo-meucurso.png", "MINDBE": "Logos/logo-mindbe.png", "NAVA": "Logos/logo-nava.png",
    "NETPARTNERS": "Logos/logo-netpartners.png", "OPT-DRIVEN": "Logos/optdriven.png", "PIZZAMIGOS": "Logos/logo-pizzamigos.png", "PRYOR GLOBAL": "Logos/logo-pryor-global.png", "RNP": "Logos/logo-rnp.png",
    "SAUDESCOLHA BENEFÍCIOS": "Logos/logo-saudescolha.png", "SGS": "Logos/logo-sgs.png", "SHURE": "Logos/logo-shure.png", "SOLUARQ": "Logos/logo-soluarq.png", "SOLVER": "Logos/logo-solver.png",
    "STRATTNER": "Logos/logo-strattner.png", "SUPPER CERTO": "Logos/logo-supper-certo.png", "T4S TECNOLOGIA": "Logos/logo-t4s.png", "TECNOGERA (TNG)": "Logos/logo-tecnogera.png",
    "TERESA PEREZ": "Logos/logo-teresa-perez.png", "VISUS ENGENHARIA": "Logos/logo-visus.png", "VIVEO": "Logos/logo-viveo.png"
};

export function iniciarBancoDeDados() {
    db.ref('historico_noc').orderByChild('timestamp').on('value', (snapshot) => {
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

            if (textoGrupo !== dataAtualAgrupamento) {
                html += `<div style="color: #FFFFFF; font-size: 13px; font-weight: 800; margin: 18px 0 8px 4px; letter-spacing: 0.5px;">${textoGrupo}</div>`;
                dataAtualAgrupamento = textoGrupo;
            }
        }

        if (log.tipo === 'aviso_rapido') {
            const srvAviso = log.servico ? log.servico.replace(/'/g, "\\'") : '';
            const hstAviso = log.host ? log.host.replace(/'/g, "\\'") : 'Não informado';
            
            html += `
            <div class="my-card card-aviso">
                <div class="my-card-header"><span style="font-size: 10px; font-weight: 800; color: #1D4ED8;">👀 EM ANÁLISE</span><span style="font-size: 9px; color: #1D4ED8; font-weight: bold; background: #BFDBFE; padding: 2px 6px; border-radius: 4px;">👤 ${log.nome}</span></div>
                <div class="my-card-host" style="cursor: pointer;" title="Clique para copiar o Serviço" onclick="copiarTextoInline(event, '${srvAviso}')">🔖 ${log.servico}</div>
                <div class="my-card-service" style="font-size: 11px; margin-top: 4px; color: #475569; cursor: pointer;" title="Clique para copiar o Host" onclick="copiarTextoInline(event, '${hstAviso}')">🖥️ ${log.host}</div>
                <div class="my-card-bottom"><span class="my-card-time">🕒 ${log.hora}</span></div>
            </div>`;
            return;
        }
        
        const acao = (log.assunto || '').split(' | ')[5] || 'CHAMADO';
        let classeBadge = acao.includes('FOLLOW') ? 'badge-follow' : (acao.includes('ENCERRAMENTO') ? 'badge-ok' : 'badge-aberto');
        
        const hostLimpo = log.form.host || 'Host Não Informado';
        const servicoResumido = log.form.item ? log.form.item.split('\n')[0] : 'Serviço Não Informado';
        
        const hstSafe = hostLimpo.replace(/'/g, "\\'");
        const srvSafe = servicoResumido.replace(/'/g, "\\'");

        // --- MÁGICA: BADGE DO ITSSM COPIÁVEL E ISOLADO ---
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
    document.getElementById('cliente').value = dados.cliente || ''; document.getElementById('host').value = dados.host || '';
    document.getElementById('item').value = dados.item || ''; document.getElementById('severidade').value = dados.severidade || 'WARNING';
    document.getElementById('statusinfo').value = dados.statusinfo || ''; document.getElementById('pressplay').value = dados.pressplay || ''; 
    document.getElementById('status').value = dados.status || 'EM ABERTO'; 
    document.getElementById('protocolo').value = dados.protocolo || '';
    document.getElementById('itssm').value = dados.itssm || ''; 
    
    // Puxa o Protocolo Libbs, se existir
    const elProtLibbs = document.getElementById('protocolo-libbs');
    if(elProtLibbs) elProtLibbs.value = dados.protocoloLibbs || '';
    
    document.getElementById('inicio').value = dados.inicio || ''; document.getElementById('f-grid').value = dados.fgrid || '';
    document.getElementById('termino').value = dados.termino || ''; document.getElementById('desc').value = dados.desc || '';
    document.getElementById('solucionador').value = dados.solucionador || ''; document.getElementById('obs').value = dados.obs || '';
    document.getElementById('evidencias').checked = dados.evidencias || false; 
    ultimaAssinaturaGerada = ''; 
    window.update();
    mostrarToast("✅ Formulário preenchido com sucesso!");
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
    
    // --- LÓGICA DO CAMPO FANTASMA (PROTOCOLO LIBBS) ---
    const grupoLibbs = document.getElementById('grupo-protocolo-libbs');
    if (grupoLibbs) {
        if (vCliente === 'LIBBS' && vHost !== 'LIBBS-DIGIBEE') {
            grupoLibbs.style.display = 'flex'; 
        } else {
            grupoLibbs.style.display = 'none';
        }
    }
    // --------------------------------------------------

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

    document.getElementById('v-host').innerText = vHost || '---';
    document.getElementById('v-item').innerHTML = vItem.replace(/\n/g, '<br>');
    
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
    if (logosClientes[vCliente]) { 
        headerCell.innerHTML = `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="table-layout: fixed; min-height: 100px;"><tr><td width="50%" align="center" valign="middle"><img src="${itsLogoUrl}" alt="ITS" style="height: 80px; max-width: 260px; width: auto; display: inline-block;"></td><td width="50%" align="center" valign="middle"><img src="${logosClientes[vCliente]}" alt="Logo Cliente" style="height: 80px; max-width: 260px; width: auto; display: inline-block;"></td></tr></table>`;
    } else { 
        headerCell.innerHTML = `<img src="${itsLogoUrl}" alt="ITS" style="height: 90px; max-width: 300px; width: auto; display: block; margin: 0 auto;">`;
    }

    document.getElementById('v-titulo').innerText = tituloTexto; document.getElementById('v-item').innerHTML = vItem.replace(/\n/g, '<br>');
    document.getElementById('v-host').innerText = vHost || '---'; document.getElementById('v-inicio').innerText = vInicio;
    document.getElementById('v-f-grid').innerHTML = formatarColchetes(vFgrid); document.getElementById('v-termino').innerHTML = formatarColchetes(vTermino);

    const dynamicGrid = document.getElementById('v-dynamic-grid');
    const badgeHTML = `<table cellpadding="0" cellspacing="0" border="0" bgcolor="${bgColor}" style="border-radius: 6px;"><tr><td style="padding: 4px 12px; font-size: 11px; font-weight: 800; color: ${textColor}; font-family: 'Segoe UI', Arial, sans-serif;">${badgeTexto}</td></tr></table>`;
    let badgeSeveridadeHTML = `<table cellpadding="0" cellspacing="0" border="0" bgcolor="${corSeveridade}" style="border-radius: 6px;"><tr><td style="padding: 4px 12px; font-size: 11px; font-weight: 800; color: #FFFFFF; font-family: 'Segoe UI', Arial, sans-serif;">${displaySeveridade}</td></tr></table>`;
    
    if (modoAtual === 'link') {
        dynamicGrid.innerHTML = `<tr><td width="46%" bgcolor="#F1F5F9" style="padding: 18px; border-radius: 8px; border-bottom: 3px solid #cbd5e1;"><div style="font-size: 9px; color: #64748B; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">Protocolo</div><div style="font-size: 15px; color: #0F172A; font-weight: 800;">${vProtocolo}</div></td><td width="8%"></td><td width="46%" bgcolor="#F1F5F9" style="padding: 18px; border-radius: 8px; border-bottom: 3px solid #cbd5e1;"><div style="font-size: 9px; color: #64748B; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">Status Atual</div>${badgeHTML}</td></tr><tr height="15"><td></td></tr><tr><td width="46%" bgcolor="#F1F5F9" style="padding: 18px; border-radius: 8px; border-bottom: 3px solid #cbd5e1;"><div style="font-size: 9px; color: #64748B; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">Solucionador</div><div style="font-size: 14px; color: #0F172A; font-weight: 800;">${vSolucionador}</div></td><td></td><td width="46%" bgcolor="#F1F5F9" style="padding: 18px; border-radius: 8px; border-bottom: 3px solid #cbd5e1;"><div style="font-size: 9px; color: #64748B; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">Severidade</div>${badgeSeveridadeHTML}</td></tr>`;
    } else {
        dynamicGrid.innerHTML = `<tr><td width="46%" bgcolor="#F1F5F9" style="padding: 18px; border-radius: 8px; border-bottom: 3px solid #cbd5e1;"><div style="font-size: 9px; color: #64748B; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">Status Atual</div>${badgeHTML}</td><td width="8%"></td><td width="46%" bgcolor="#F1F5F9" style="padding: 18px; border-radius: 8px; border-bottom: 3px solid #cbd5e1;"><div style="font-size: 9px; color: #64748B; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">Severidade</div>${badgeSeveridadeHTML}</td></tr>`;
    }

    if (vStatusInfo) { document.getElementById('statusinfo-container').style.display = 'block'; document.getElementById('v-statusinfo').innerHTML = formatarColchetes(vStatusInfo.replace(/\n/g, '<br>')); } else { document.getElementById('statusinfo-container').style.display = 'none'; }
    if (vPressplay && modoAtual === 'infra') { document.getElementById('pressplay-container').style.display = 'block'; document.getElementById('v-pressplay').innerHTML = formatarColchetes(vPressplay.replace(/\n/g, '<br>')); } else { document.getElementById('pressplay-container').style.display = 'none'; }
    if (vDesc) { document.getElementById('detalhamento-container').style.display = 'block'; document.getElementById('v-desc').innerHTML = formatarColchetes(vDesc.replace(/\n/g, '<br>')); } else { document.getElementById('detalhamento-container').style.display = modoAtual === 'link' ? 'block' : 'none'; document.getElementById('v-desc').innerHTML = 'Aguardando atualização técnica...'; }
    document.getElementById('evidencias-container').style.display = temEvidencias ? 'block' : 'none';
    if (vObs) { document.getElementById('obs-container').style.display = 'block'; document.getElementById('v-obs').innerHTML = formatarColchetes(vObs.replace(/\n/g, '<br>')); } else { document.getElementById('obs-container').style.display = 'none'; }
}

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

        // --- MÁGICA: SALVAR SNAPSHOT ANTES DE LIMPAR ---
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
    ultimaAssinaturaGerada = '';

    modoAtual = novoModo;
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

    // Mostra o Toast com botão de Desfazer se havia dados
    if (temDados) {
        const toastResgateAba = `<div style="display: flex; align-items: center; justify-content: space-between; gap: 15px; width: 100%;"><span>🔄 Aba trocada. Rascunho salvo.</span><button onclick="recuperarDadosAba()" style="background: rgba(255,255,255,0.2); border: 1px solid white; color: white; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px; transition: 0.2s;">↩️ DESFAZER</button></div>`;
        mostrarToast(toastResgateAba, "warning", 10000);
    }
}

// ==========================================
// FUNÇÃO NOVA: RESTAURAR ABA (UNDO)
// ==========================================
window.recuperarDadosAba = function() {
    if (!backupEstadoAba) return;

    // 1. Volta para a aba correta
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

    // 2. Devolve todos os valores
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
    const status = document.getElementById('status').value; const d = new Date(); 
    const pt = `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    if (status === 'RESOLVIDO') { document.getElementById('severidade').value = 'OK'; document.getElementById('termino').value = pt; } 
    else if (status === 'FOLLOW-UP') { document.getElementById('f-grid').value = pt; }
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
    let acao = statusSelect === 'EM ABERTO' ? 'ABERTURA' : (statusSelect === 'FOLLOW-UP' ? 'FOLLOW UP' : 'ENCERRAMENTO');
    
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
    
    // Captura o protocolo Libbs (se existir)
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

// ------------------------------------------
// MÁGICA: VÍNCULO SILENCIOSO DO ITSSM
// ------------------------------------------
window.vincularRegistroITSSM = function() {
    const itssm = document.getElementById('itssm').value.trim();
    if (!itssm) { mostrarToast("⚠️ Digite o número do ITSSM primeiro!", "warning"); return; }
    
    const assunto = obterAssuntoGerado(); 
    
    db.ref('historico_noc').orderByChild('assunto').equalTo(assunto).once('value', snapshot => {
        if (snapshot.exists()) {
            let maiorTimestamp = 0; let chaveAlvo = null;
            
            snapshot.forEach(child => {
                const data = child.val();
                if (data.timestamp > maiorTimestamp) { maiorTimestamp = data.timestamp; chaveAlvo = child.key; }
            });
            
            if (chaveAlvo) {
                let updates = {}; updates[`${chaveAlvo}/form/itssm`] = itssm;
                db.ref('historico_noc').update(updates).then(() => {
                    mostrarToast("🔗 Número ITSSM vinculado ao radar com sucesso!", "success");
                });
            }
        } else {
            mostrarToast("⚠️ Gere o chamado (IMAGEM ou TEXTO) antes de tentar vincular o ITSSM.", "warning");
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

    let acao = statusSelect === 'EM ABERTO' ? 'ABERTURA' : (statusSelect === 'FOLLOW-UP' ? 'FOLLOW UP' : 'ENCERRAMENTO');
    const buscaStr = `${cliente} | ${host} | ${item}`; 
    
    for(let i = ultimosLogsFirebase.length - 1; i >= 0; i--) {
        let log = ultimosLogsFirebase[i];
        if (log.tipo === 'aviso_rapido') continue; 
        
        if(log.assunto && log.assunto.includes(buscaStr) && log.assunto.includes(acao)) {
            if(currentUser && log.nome !== currentUser.nome) { 
                return confirm(`⚠️ COLISÃO DETECTADA!\n\nO analista ${log.nome} (${log.turno}) já enviou um(a) ${acao} para este mesmo Cliente, Host e Serviço às ${log.hora}.\n\nTem certeza que deseja gerar um chamado duplicado?`); 
            }
            return true;
        }
    }
    return true;
}

window.copyAsImage = function() {
    if (!validarCamposObrigatorios(true)) return;
    const fgrid = document.getElementById('f-grid').value.trim();
    const assinaturaAtual = `${modoAtual}|${document.getElementById('cliente').value.toUpperCase().trim()}|${document.getElementById('host').value.toUpperCase().trim()}|${document.getElementById('status').value}|${fgrid}`;
    
    if (assinaturaAtual !== ultimaAssinaturaGerada) { if (!verificarDuplicidade()) return; registrarHistoricoNuvem(obterAssuntoGerado()); ultimaAssinaturaGerada = assinaturaAtual; }

    const btn = document.getElementById('btn-copiar-img'); const originalText = btn.innerHTML; btn.innerHTML = '⏳ A GERAR...';
    const node = document.getElementById('render'); const clone = node.cloneNode(true); clone.style.position = 'absolute'; clone.style.top = '-9999px'; clone.style.left = '-9999px'; clone.style.width = '650px'; clone.style.height = 'auto'; document.body.appendChild(clone);
    html2canvas(clone, { scale: 1.2, useCORS: true, backgroundColor: '#ffffff' }).then(canvas => {
        document.body.removeChild(clone);
        canvas.toBlob(blob => { try { const item = new ClipboardItem({ "image/png": blob }); navigator.clipboard.write([item]).then(() => { btn.innerHTML = originalText; mostrarToast("📸 IMAGEM HD COPIADA E GUARDADA NO HISTÓRICO!", "success"); }); } catch (err) { alert("A cópia de imagem não é suportada."); btn.innerHTML = originalText; } });
    }).catch(err => { document.body.removeChild(clone); alert("Erro ao gerar a imagem."); btn.innerHTML = originalText; });
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
    
    const elProtLibbs = document.getElementById('protocolo-libbs');
    const vProtLibbs = elProtLibbs ? elProtLibbs.value.trim() : '';

    const vInicio = document.getElementById('inicio').value || '---'; 
    const vFgrid = document.getElementById('f-grid').value || '-'; 
    const vTermino = document.getElementById('termino').value || '-'; 
    const vStatusInfo = document.getElementById('statusinfo').value.trim();
    
    let textoITSSM = `Cliente: ${vCliente}\nHost: ${vHost}\nItem Monitorado (Serviço): ${vItem}\n`;
    if (vItssm) { textoITSSM += `Nº Registro ITSSM: ${vItssm}\n`; }
    
    if (vProtLibbs && vCliente === 'LIBBS' && vHost !== 'LIBBS-DIGIBEE') {
        textoITSSM += `Protocolo Libbs (E-mail): ${vProtLibbs}\n`;
    }

    textoITSSM += `Início da ocorrência: ${vInicio}\nFollow-up da ocorrência: ${vFgrid}\nTérmino da ocorrência: ${vTermino}\n`;
    
    if (vStatusInfo) { textoITSSM += `\nDados Técnicos (Status Information do Centreon):\n${vStatusInfo}\n`; }
    const vPressplay = document.getElementById('pressplay').value.trim();
    if (modoAtual === 'infra' && vPressplay) { textoITSSM += `\nRetorno / Logs do PressPlay:\n${vPressplay}\n`; }
    
    const vSolucionador = document.getElementById('solucionador').value.trim();
    if (vSolucionador) { const labelSoluc = modoAtual === 'infra' ? 'Solucionador (Equipe / TI Local)' : 'Solucionador (Operadora / Analista)'; textoITSSM += `\n${labelSoluc}: ${vSolucionador}\n`; }
    
    const vDesc = document.getElementById('desc').value.trim();
    if (vDesc) { const labelDesc = modoAtual === 'infra' ? 'Logs / Evidências Adicionais' : 'Ações / Diagnóstico'; textoITSSM += `\n${labelDesc}:\n${vDesc}\n`; }
    
    const vObs = document.getElementById('obs').value.trim(); 
    if (vObs) { textoITSSM += `\nObservação:\n${vObs}\n`; }

    try { 
        const tempTextarea = document.createElement("textarea"); tempTextarea.value = textoITSSM; document.body.appendChild(tempTextarea); 
        tempTextarea.select(); document.execCommand("copy"); document.body.removeChild(tempTextarea); mostrarToast("📝 TEXTO ITSSM COPIADO COM SUCESSO!", "info"); 
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
        document.getElementById('status').value = 'EM ABERTO'; document.getElementById('severidade').value = 'WARNING'; document.getElementById('evidencias').checked = false; document.getElementById('protocolo').classList.remove('shake-error'); ultimaAssinaturaGerada = ''; window.update();
        
        // Ajustado para 10 segundos!
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

window.exportarParaExcel = function() {
    if (chamadosDoTurno.length === 0) { mostrarToast("Não há dados neste plantão para exportar.", "warning"); return; }
    let csvContent = "data:text/csv;charset=utf-8,Data/Hora,Analista,Turno,Modulo,Acao,Cliente,Host,Servico,Severidade,Status,Protocolo,ITSSM,Protocolo Libbs,SLA Previsto\n";
    chamadosDoTurno.forEach(log => {
        if (log.tipo === 'aviso_rapido' || !log.form) return; 
        const partesAssunto = log.assunto ? log.assunto.split(' | ') : []; const acao = partesAssunto[5] ? partesAssunto[5].trim() : ''; const servicoLimpo = log.form.item ? log.form.item.split('\n')[0] : ''; 
        let row = [ log.hora, log.nome, log.turno, log.form.modo === 'infra' ? 'Infra' : 'Link', acao, log.form.cliente || '-', log.form.host || '-', servicoLimpo, log.form.severidade || '-', log.form.status || '-', log.form.protocolo || '-', log.form.itssm || '-', log.form.protocoloLibbs || '-', log.form.termino || '-' ].map(e => `"${String(e).replace(/"/g, '""')}"`).join(","); 
        csvContent += row + "\n";
    });
    const encodedUri = encodeURI(csvContent); const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", `relatorio_noc_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); mostrarToast("📊 Relatório exportado com sucesso!", "success");
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
    const listaHtml = document.getElementById('lista-historico'); listaHtml.innerHTML = '<div style="text-align:center; padding: 20px; color: #94A3B8;">📡 Buscando radar contínuo...</div>';
    db.ref('historico_noc').orderByChild('timestamp').once('value', (snapshot) => {
        if(!snapshot.exists()) { listaHtml.innerHTML = '<div style="text-align:center; padding: 20px; color: #94A3B8;">Nenhum evento registrado no radar.</div>'; return; }
        let html = ''; const logs = []; snapshot.forEach(child => { logs.push(child.val()); });
        logs.reverse().forEach(item => {
            if (item.tipo === 'aviso_rapido') {
                html += `<div class="log-item" style="border-left-color: #3B82F6; background: #EFF6FF;"><div class="log-time"><span>🕒 ${item.hora} 👀 EM ANÁLISE</span><span style="color:#0EA5E9;">👤 ${item.nome} (${item.turno})</span></div><span class="log-subject" style="color: #1D4ED8;">Serviço: ${item.servico} | Host: ${item.host}</span></div>`;
            } else {
                const corBorda = (item.form && item.form.modo === 'infra') ? '#0284C7' : 'var(--its-red)'; const modoLabel = (item.form && item.form.modo === 'infra') ? '🖥️' : '🌐';
                html += `<div class="log-item" style="border-left-color: ${corBorda};"><div class="log-time"><span>🕒 ${item.hora} ${modoLabel}</span><span style="color:#0EA5E9;">👤 ${item.nome} (${item.turno})</span></div><span class="log-subject">${item.assunto}</span></div>`;
            }
        });
        listaHtml.innerHTML = html;
    });
}

// ==========================================
// 🧠 MOTOR DE CORRELAÇÃO DE EVENTOS (SRE)
// ==========================================
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

// ==========================================
// ✨ EXTRATOR MÁGICO DE TABELAS (CENTREON)
// ==========================================
window.processarExtratorMagico = function() {
    const raw = document.getElementById('magic-paste-area').value;
    if (!raw.trim()) {
        mostrarToast("⚠️ Cole os dados do Centreon primeiro!", "warning");
        return; 
    }

    let linhas = raw.split('\n').filter(l => l.trim() !== '');
    if (linhas.length === 0) return;

    let servicos = [];
    let rawStatusInfos = []; 
    let hostDetectado = "";

    let prioridadeSeveridade = { "CRITICAL": 4, "DOWN": 4, "WARNING": 3, "UNKNOWN": 2, "OK": 1, "UP": 1 };
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

    linhasColunas.forEach((cols, i) => {
        if (cols.length === 0) return;

        let servicoStr = "";
        let statusStr = cols[cols.length - 1];

        if (cols.length >= 2) {
            let offset = 0;
            if (cols[0].toLowerCase() === 'vm' || cols[0].trim().length <= 2) {
                offset = 1;
            }
            
            let item0 = cols[offset];
            let item1 = cols[offset + 1];

            if (item1) {
                const isItem1Status = /^(OK|CRITICAL|WARNING|UNKNOWN|UP|DOWN|PENDING)$/i.test(item1.trim());
                if (isItem1Status) {
                    servicoStr = item0; 
                } else {
                    if (!hostDetectado) hostDetectado = item0; 
                    servicoStr = item1;
                }
            } else {
                servicoStr = item0;
            }
        } else if (cols.length === 1) {
            let linhaTexto = cols[0];
            let matchStatusLinha = linhaTexto.match(/(CRITICAL|WARNING|OK|UNKNOWN|UP|DOWN)\s*-\s*(.*)/i);
            if (matchStatusLinha) {
                statusStr = matchStatusLinha[0];
                linhaTexto = linhaTexto.replace(matchStatusLinha[0], '').trim();
            }
            servicoStr = linhaTexto.split(/\s+/)[0]; 
        }

        if (servicoStr && !servicos.includes(servicoStr)) { servicos.push(servicoStr); }
        if (statusStr) { rawStatusInfos.push({ servico: servicoStr, status: statusStr }); }

        let matchStatusSev = statusStr.match(/(CRITICAL|WARNING|OK|UNKNOWN|UP|DOWN)/i);
        if (matchStatusSev) {
            let statusEncontrado = matchStatusSev[1].toUpperCase();
            let peso = prioridadeSeveridade[statusEncontrado] || 0;
            if (peso > piorSeveridadeNum) {
                piorSeveridadeNum = peso;
                severidadeFinal = (statusEncontrado === 'DOWN') ? 'CRITICAL' : (statusEncontrado === 'UP' ? 'OK' : statusEncontrado);
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
    if (hostDetectado) {
        let hostUpper = hostDetectado.toUpperCase();

        if (hostUpper.startsWith('ITS-BKP-VEEAM') && servicos.length > 0) {
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

        if (!clienteDetectado) {
            for (let modo in memoriaNOC) {
                for (let cli in memoriaNOC[modo]) {
                    if (memoriaNOC[modo][cli][hostDetectado]) { clienteDetectado = cli; break; }
                }
                if (clienteDetectado) break;
            }
        }

        if (!clienteDetectado) {
            if (hostUpper.includes('LIBBS')) clienteDetectado = 'LIBBS';
            else if (hostUpper.includes('AMIGAO') || hostUpper.includes('CSD')) clienteDetectado = 'CSD (GRUPO AMIGÃO)';
            else if (hostUpper.includes('AGIS')) clienteDetectado = 'GRUPO AGIS';
            else if (hostUpper.includes('STAHL')) clienteDetectado = 'AGROSTAHL (STAHL)';
            else if (hostUpper.includes('FURACAO')) clienteDetectado = 'FURACÃO';
            else {
                const prefixo = hostDetectado.split('-')[0].toUpperCase(); 
                const prefixoUnder = hostDetectado.split('_')[0].toUpperCase();
                const prefixoReal = prefixo.length < prefixoUnder.length ? prefixo : prefixoUnder;
                const clientesPossiveis = Object.keys(logosClientes || {});
                let match = clientesPossiveis.find(c => c.startsWith(prefixoReal));
                if (match) clienteDetectado = match;
            }
        }
    }

    if (clienteDetectado && !document.getElementById('cliente').value) {
        document.getElementById('cliente').value = clienteDetectado;
    }
    if (hostDetectado && !document.getElementById('host').value) {
        document.getElementById('host').value = hostDetectado;
    }
    if (servicos.length > 0) {
        let itemAtual = document.getElementById('item').value;
        let novoItem = itemAtual ? itemAtual + '\n' + servicos.join('\n') : servicos.join('\n');
        document.getElementById('item').value = novoItem;
        
        if (typeof window.detectarOperadoraOuGeral === 'function') {
            let opDetectada = window.detectarOperadoraOuGeral(novoItem);
            if (opDetectada && !document.getElementById('solucionador').value) {
                document.getElementById('solucionador').value = opDetectada;
            }
        }
    }

    if (rawStatusInfos.length > 0) {
        let textoStatusFormatado = (rawStatusInfos.length === 1) 
            ? rawStatusInfos[0].status 
            : rawStatusInfos.map(info => `[${info.servico || 'Item'}]\n${info.status}`).join('\n\n');
        let statusAtual = document.getElementById('statusinfo').value;
        document.getElementById('statusinfo').value = statusAtual ? statusAtual + '\n\n' + textoStatusFormatado : textoStatusFormatado;
    }
    if (severidadeFinal) { document.getElementById('severidade').value = severidadeFinal; }

    if (menorDuracaoMs !== Infinity && !document.getElementById('inicio').value) {
        let dataCalculada = new Date(Date.now() - menorDuracaoMs);
        const pt = `${dataCalculada.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric'})} às ${dataCalculada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        document.getElementById('inicio').value = pt;
    }

    document.getElementById('magic-paste-area').value = '';
    window.update();
    mostrarToast("🪄 Inteligência Artificial aplicou os dados com sucesso!", "success");
}

// ==========================================
// FUNÇÕES DE TRANSIÇÃO E RECUPERAÇÃO DE ABA
// ==========================================
window.trocarModo = function(novoModo) {
    if (modoAtual === novoModo) return; 

    let temDados = isFormularioSujo();

    if (temDados) {
        const confirma = confirm("⚠️ ATENÇÃO!\n\nVocê tem dados preenchidos no formulário.\nSe trocar de aba agora, todas as informações não salvas serão perdidas.\n\nDeseja realmente descartar este rascunho e trocar de aba?");
        if (!confirma) return; 

        // --- SALVAR SNAPSHOT ANTES DE LIMPAR ---
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
    ultimaAssinaturaGerada = '';

    modoAtual = novoModo;
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
