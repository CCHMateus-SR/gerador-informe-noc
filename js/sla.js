// ==========================================
// MÓDULO DE MONITORAMENTO E SLA (NUVEM)
// ==========================================
import { db } from './firebase-config.js'; // Conectando o SLA ao Firebase
import { currentUser } from './auth.js';
import { startTabBlink, stopTabBlink, tocarSom, mostrarToast } from './ui.js';
import { chamadosDoTurno } from './dispatch.js'; 

let chamadosAlertadosSLA = new Set(); 
let filaDeAlertas = [];
let modalAberto = false;

export function carregarEstadoSLA() {
    // Limpa o lixo antigo da memória local, pois agora somos 100% nuvem!
    try { localStorage.removeItem('noc_sla_state'); } catch(e) {}
}

export function iniciarMonitoramentoSLA() {
    setInterval(() => {
        if (!currentUser || chamadosDoTurno.length === 0) return;
        const agora = Date.now();
        let estadoRecente = {};
        let ciclosCientes = new Set(); 
        let ultimosSilenciamentos = {};

        chamadosDoTurno.forEach(log => {
            // 1. CORREÇÃO DO BUG FANTASMA: Lemos o status de QUALQUER analista da equipe!
            if (log.form) {
                let chave = `${log.form.cliente}-${log.form.host}`;
                if (!estadoRecente[chave] || log.timestamp > estadoRecente[chave].timestamp) {
                    estadoRecente[chave] = log;
                }
            }
            
            // 2. Lemos as ações de SLA direto da Nuvem (Firebase)
            if (log.tipo === 'acao_sla') {
                if (log.acao === 'ciente') ciclosCientes.add(log.alertaId);
                if (log.acao === 'silenciar_host') {
                    if (!ultimosSilenciamentos[log.chave] || log.timestamp > ultimosSilenciamentos[log.chave]) {
                        ultimosSilenciamentos[log.chave] = log.timestamp;
                    }
                }
            }
        });

        for (let chave in estadoRecente) {
            let log = estadoRecente[chave];
            
            // Ignora infraestrutura
            if (log.form.modo === 'infra') continue; 
            
            let acao = log.assunto ? log.assunto.split(' | ')[5] || '' : '';
            let status = log.form.status || '';

            // BARREIRA DO RESOLVIDO GLOBAL: Se o último status for RESOLVIDO, para de alertar!
            if (status === 'RESOLVIDO' || acao.includes('ENCERRAMENTO')) continue;

            // BARREIRA DO SILENCIAR INTELIGENTE: Se foi silenciado APÓS a última atualização, fica quieto.
            // Mas se alguém lançar um Follow-Up novo, o relógio volta a contar!
            if (ultimosSilenciamentos[chave] && ultimosSilenciamentos[chave] > log.timestamp) {
                continue; 
            }

            if (acao.includes('ABERTURA') || acao.includes('FOLLOW UP')) {
                let diffMinutos = (agora - log.timestamp) / (1000 * 60);
                let cicloAtual = Math.floor(diffMinutos / 30); 
                
                if (cicloAtual >= 1) {
                    let alertaId = `${chave}-ciclo-${cicloAtual}`;
                    
                    // Se ninguém deu ciente na NUVEM e não tá na memória local, dispara!
                    if (!ciclosCientes.has(alertaId) && !chamadosAlertadosSLA.has(alertaId)) {
                        dispararModalSLA(log, diffMinutos, chave, alertaId);
                        chamadosAlertadosSLA.add(alertaId); // Marca local pra não repetir o pop-up na mesma hora
                    }
                }
            }
        }
    }, 60000); // Roda a cada 60 segundos
}

function dispararModalSLA(log, minutos, chave, alertaId) {
    // --- LÓGICA DE CONVERSÃO DE TEMPO (HORAS E MINUTOS) ---
    let totalMinutos = Math.floor(minutos);
    let horas = Math.floor(totalMinutos / 60);
    let minRestantes = totalMinutos % 60;
    
    let tempoFormatado = "";
    if (horas > 0) {
        let txtHora = horas === 1 ? "hora" : "horas";
        let txtMin = minRestantes === 1 ? "minuto" : "minutos";
        tempoFormatado = `${horas} ${txtHora} e ${minRestantes} ${txtMin}`;
    } else {
        let txtMin = totalMinutos === 1 ? "minuto" : "minutos";
        tempoFormatado = `${totalMinutos} ${txtMin}`;
    }
    // -------------------------------------------------------

    let htmlMensagem = `
        <div style="background: #FEF2F2; border-left: 4px solid var(--its-red); padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 16px; margin-bottom: 10px; color: var(--its-red); font-weight: 800;">⏰ ALERTA DE SLA DE LINK!</div>
            <div style="color: #1E293B; font-size: 14px; margin-bottom: 10px;">O Host <strong>${log.form.host}</strong> (${log.form.cliente})</div>
            <div style="font-family: Consolas, monospace; font-size: 13px; color: #991B1B; font-weight: bold; background: #FEE2E2; padding: 8px; border-radius: 4px;">
                Está sem atualização há ${tempoFormatado}!
            </div>
        </div>
    `;
    let botoesHTML = `
        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button onclick="silenciarSLA('${chave}')" style="flex: 1; padding: 14px; background: white; color: var(--its-red); border: 2px solid var(--its-red); border-radius: 8px; cursor: pointer; font-weight: 800; font-size: 13px; text-transform: uppercase; transition: 0.2s;">🔕 SILENCIAR HOST</button>
            <button onclick="cienteSLA('${alertaId}')" style="flex: 1; padding: 14px; background: var(--its-red); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 800; font-size: 14px; text-transform: uppercase; transition: 0.2s;">CIENTE 👍</button>
        </div>
    `;
    filaDeAlertas.push({ html: htmlMensagem, botoes: botoesHTML, tipo: 'sla' });
    startTabBlink('⏰ ALERTA SLA!');
    if (!modalAberto) exibirProximoAlerta();
}

export function mostrarAlertaBloqueante(mensagemObj) {
    let htmlMensagem = '';
    let botoesHTML = `<button style="padding: 14px; background: var(--its-red); color: white; border: none; border-radius: 8px; cursor: pointer; width: 100%; font-weight: 800; font-size: 14px; text-transform: uppercase; transition: 0.2s;" onclick="fecharAlertaBloqueante()">CIENTE 👍</button>`;

    if (mensagemObj.tipo === 'aviso_rapido') {
        const hostText = mensagemObj.host !== 'Não informado' ? ` | Host: <strong>${mensagemObj.host}</strong>` : '';
        htmlMensagem = `
            <div style="background: #EFF6FF; border-left: 4px solid #3B82F6; padding: 15px; border-radius: 8px; text-align: center;">
                <div style="margin-bottom: 10px; color: #1E293B; font-size: 13px;">👤 <strong>${mensagemObj.nome} (${mensagemObj.turno})</strong> assumiu uma análise às ${mensagemObj.hora}:</div>
                <div style="font-family: Consolas, monospace; font-size: 13px; color: #1D4ED8; font-weight: bold;">👀 SERVIÇO: ${mensagemObj.servico}${hostText}</div>
            </div>`;
        filaDeAlertas.push({ html: htmlMensagem, botoes: botoesHTML, tipo: 'aviso' });
    } else {
        const isInfra = mensagemObj.form && mensagemObj.form.modo === 'infra';
        const isCritical = mensagemObj.form && mensagemObj.form.severidade === 'CRITICAL';
        const modoLabel = isInfra ? '🖥️ Infra / Aplicações' : '🌐 Gestão de Link/Ping';
        
        htmlMensagem = `
            <div style="background: #E0F2FE; border-left: 4px solid #0EA5E9; padding: 15px; border-radius: 8px;">
                <div style="margin-bottom: 15px; color: #1E293B; font-size: 13px; text-align: center;">👤 <strong>${mensagemObj.nome} (${mensagemObj.turno})</strong> gerou um novo informe de <span style="color: #0284C7; font-weight: bold;">${modoLabel}</span> às ${mensagemObj.hora}:</div>
                <div style="font-family: Consolas, monospace; font-size: 12px; color: #0369A1; text-align: center; font-weight: bold;">${mensagemObj.assunto.replace(/ \| /g, ' | ')}</div>
            </div>`;
        filaDeAlertas.push({ html: htmlMensagem, botoes: botoesHTML, tipo: isCritical ? 'critical' : 'default' });
    }
    
    startTabBlink('🚨 ALERTA NOC!');
    if (!modalAberto) exibirProximoAlerta();
}

function exibirProximoAlerta() {
    if (filaDeAlertas.length === 0) { 
        document.getElementById('modal-alerta').style.display = 'none';
        modalAberto = false; stopTabBlink(); return; 
    }
    modalAberto = true;
    let proximo = filaDeAlertas[0];
    document.getElementById('texto-alerta').innerHTML = proximo.html;
    document.getElementById('botoes-alerta').innerHTML = proximo.botoes;
    tocarSom(proximo.tipo);
    document.getElementById('modal-alerta').style.display = 'flex';
}

window.fecharAlertaBloqueante = function() { 
    filaDeAlertas.shift(); 
    exibirProximoAlerta(); 
}

// ==========================================
// AÇÕES NA NUVEM (Sincroniza toda a equipe)
// ==========================================

window.cienteSLA = function(alertaId) {
    db.ref('historico_noc').push({
        tipo: 'acao_sla',
        alertaId: alertaId,
        nome: currentUser.nome,
        acao: 'ciente',
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    fecharAlertaBloqueante();
}

window.silenciarSLA = function(chave) { 
    db.ref('historico_noc').push({
        tipo: 'acao_sla',
        chave: chave,
        nome: currentUser.nome,
        acao: 'silenciar_host',
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    fecharAlertaBloqueante(); 
    mostrarToast("🔕 Host silenciado na nuvem para toda a equipe.", "info"); 
}
