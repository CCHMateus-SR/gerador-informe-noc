// ==========================================
// MÓDULO DE MONITORAMENTO E SLA
// ==========================================
import { currentUser } from './auth.js';
import { startTabBlink, stopTabBlink, tocarSom, mostrarToast } from './ui.js';
import { chamadosDoTurno } from './dispatch.js'; // Puxa os chamados do motor principal

let chamadosAlertadosSLA = new Set(); 
let chamadosSilenciadosSLA = new Set();
let filaDeAlertas = [];
let modalAberto = false;

export function carregarEstadoSLA() {
    try {
        const salvo = localStorage.getItem('noc_sla_state');
        if (salvo) {
            const estado = JSON.parse(salvo);
            if (estado.data === new Date().toDateString()) {
                chamadosAlertadosSLA = new Set(estado.alertados || []);
                chamadosSilenciadosSLA = new Set(estado.silenciados || []);
            } else {
                localStorage.removeItem('noc_sla_state');
            }
        }
    } catch(e) { console.error("Erro ao carregar estado do SLA.", e); }
}

function salvarEstadoSLA() {
    const estadoSLA = {
        alertados: Array.from(chamadosAlertadosSLA),
        silenciados: Array.from(chamadosSilenciadosSLA),
        data: new Date().toDateString()
    };
    localStorage.setItem('noc_sla_state', JSON.stringify(estadoSLA));
}

export function iniciarMonitoramentoSLA() {
    setInterval(() => {
        if (!currentUser || chamadosDoTurno.length === 0) return;
        const agora = Date.now();
        let estadoRecente = {};
        
        chamadosDoTurno.forEach(log => {
            if (log.nome === currentUser.nome && log.form) {
                let chave = `${log.form.cliente}-${log.form.host}`;
                if (!estadoRecente[chave] || log.timestamp > estadoRecente[chave].timestamp) {
                    estadoRecente[chave] = log;
                }
            }
        });

        for (let chave in estadoRecente) {
            if (chamadosSilenciadosSLA.has(chave)) continue;
            let log = estadoRecente[chave];
            if (log.form.modo === 'infra') continue; 
            
            let acao = log.assunto.split(' | ')[5] || '';
            if (acao.includes('ABERTURA') || acao.includes('FOLLOW UP')) {
                let diffMinutos = (agora - log.timestamp) / (1000 * 60);
                let cicloAtual = Math.floor(diffMinutos / 30); 
                
                if (cicloAtual >= 1) {
                    let alertaId = `${chave}-ciclo-${cicloAtual}`;
                    if (!chamadosAlertadosSLA.has(alertaId)) {
                        dispararModalSLA(log, diffMinutos, chave);
                        chamadosAlertadosSLA.add(alertaId);
                        salvarEstadoSLA(); 
                    }
                }
            }
        }
    }, 60000);
}

function dispararModalSLA(log, minutos, chave) {
    let tempoFormatado = `${Math.floor(minutos)} min`;
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
            <button onclick="fecharAlertaBloqueante()" style="flex: 1; padding: 14px; background: var(--its-red); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 800; font-size: 14px; text-transform: uppercase; transition: 0.2s;">CIENTE 👍</button>
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

window.fecharAlertaBloqueante = function() { filaDeAlertas.shift(); exibirProximoAlerta(); }
window.silenciarSLA = function(chave) { chamadosSilenciadosSLA.add(chave); salvarEstadoSLA(); fecharAlertaBloqueante(); mostrarToast("🔕 Alertas silenciados.", "info"); }