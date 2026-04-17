// ==========================================
// MÓDULO DE MONITORAMENTO E SLA (NUVEM - V2)
// ==========================================
import { db } from './firebase-config.js';
import { currentUser } from './auth.js';
import { startTabBlink, stopTabBlink, tocarSom, mostrarToast } from './ui.js';
import { chamadosDoTurno } from './dispatch.js'; 

let chamadosAlertadosSLA = new Set(); 
let filaDeAlertas = [];
let modalAberto = false;

export function carregarEstadoSLA() {
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
            if (log.form) {
                let chave = `${log.form.cliente}-${log.form.host}`;
                if (!estadoRecente[chave] || log.timestamp > estadoRecente[chave].timestamp) {
                    estadoRecente[chave] = log;
                }
            }
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
            if (log.form.modo === 'infra') continue; 
            
            let acao = log.assunto ? log.assunto.split(' | ')[5] || '' : '';
            let status = log.form.status || '';

            if (status === 'RESOLVIDO' || acao.includes('ENCERRAMENTO')) continue;

            // Se o host foi silenciado após a última atualização, ignoramos
            if (ultimosSilenciamentos[chave] && ultimosSilenciamentos[chave] > log.timestamp) continue; 

            if (acao.includes('ABERTURA') || acao.includes('FOLLOW UP')) {
                let diffMinutos = (agora - log.timestamp) / (1000 * 60);
                
                // --- 1. MOTOR DE 30 EM 30 MINUTOS (ATUALIZAÇÃO) ---
                let ciclo30 = Math.floor(diffMinutos / 30);
                if (ciclo30 >= 1) {
                    let alertaId = `${chave}-ciclo-${ciclo30}`;
                    if (!ciclosCientes.has(alertaId) && !chamadosAlertadosSLA.has(alertaId)) {
                        dispararModalSLA(log, diffMinutos, chave, alertaId);
                        chamadosAlertadosSLA.add(alertaId);
                    }
                }

                // --- 2. NOVO MOTOR DE 4 EM 4 HORAS (SLA OPERADORA) ---
                let ciclo4h = Math.floor(diffMinutos / 1); // Teste de 1 min
                if (ciclo4h >= 1) {
                    let manutId = `${chave}-manutencao-${ciclo4h}`;
                    if (!ciclosCientes.has(manutId) && !chamadosAlertadosSLA.has(manutId)) {
                        dispararModalManutencao(log, diffMinutos, chave, manutId);
                        chamadosAlertadosSLA.add(manutId);
                    }
                }
            }
        }
    }, 60000);
}

// Layout Tradicional (Vermelho - Atualização)
function dispararModalSLA(log, minutos, chave, alertaId) {
    let totalMinutos = Math.floor(minutos);
    let horas = Math.floor(totalMinutos / 60);
    let minRestantes = totalMinutos % 60;
    let tempoFormatado = horas > 0 ? `${horas}h e ${minRestantes}min` : `${totalMinutos} min`;

    let htmlMensagem = `
        <div style="background: #FEF2F2; border-left: 4px solid var(--its-red); padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 16px; margin-bottom: 10px; color: var(--its-red); font-weight: 800;">⏰ ALERTA DE ATUALIZAÇÃO</div>
            <div style="color: #1E293B; font-size: 14px; margin-bottom: 10px;">O Host <strong>${log.form.host}</strong> está sem novo follow-up há <strong>${tempoFormatado}</strong>.</div>
        </div>
    `;
    let botoesHTML = `
        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button onclick="silenciarSLA('${chave}')" style="flex: 1; padding: 14px; background: white; color: var(--its-red); border: 2px solid var(--its-red); border-radius: 8px; cursor: pointer; font-weight: 800; font-size: 12px; text-transform: uppercase;">🔕 SILENCIAR</button>
            <button onclick="cienteSLA('${alertaId}')" style="flex: 1; padding: 14px; background: var(--its-red); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 800; font-size: 14px; text-transform: uppercase;">CIENTE 👍</button>
        </div>
    `;
    filaDeAlertas.push({ html: htmlMensagem, botoes: botoesHTML, tipo: 'sla' });
    startTabBlink('⏰ ATUALIZAR LINK!');
    if (!modalAberto) exibirProximoAlerta();
}

// NOVO Layout de Manutenção (Roxo - Cobrar Operadora)
function dispararModalManutencao(log, minutos, chave, alertaId) {
    let horas = Math.floor(minutos / 60);
    let htmlMensagem = `
        <div style="background: #F5F3FF; border-left: 4px solid #6366F1; padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 16px; margin-bottom: 10px; color: #4F46E5; font-weight: 800;">🛠️ STATUS DE MANUTENÇÃO (SLA)</div>
            <div style="color: #1E293B; font-size: 14px; margin-bottom: 10px;">O chamado do Host <strong>${log.form.host}</strong> completou <strong>${horas} horas</strong>.</div>
            <div style="font-size: 12px; color: #4338CA; font-weight: bold; background: #E0E7FF; padding: 8px; border-radius: 4px;">
                ⚠️ É necessário validar o status atual com a operadora!
            </div>
        </div>
    `;
    let botoesHTML = `
        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button onclick="silenciarSLA('${chave}')" style="flex: 1; padding: 14px; background: white; color: #4F46E5; border: 2px solid #4F46E5; border-radius: 8px; cursor: pointer; font-weight: 800; font-size: 12px; text-transform: uppercase;">🔕 SILENCIAR</button>
            <button onclick="cienteSLA('${alertaId}')" style="flex: 1; padding: 14px; background: #6366F1; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 800; font-size: 14px; text-transform: uppercase;">COBRAR OPERADORA 📞</button>
        </div>
    `;
    filaDeAlertas.push({ html: htmlMensagem, botoes: botoesHTML, tipo: 'default' });
    startTabBlink('🛠️ COBRAR SLA!');
    if (!modalAberto) exibirProximoAlerta();
}

export function mostrarAlertaBloqueante(mensagemObj) {
    let htmlMensagem = '';
    let botoesHTML = `<button style="padding: 14px; background: var(--its-red); color: white; border: none; border-radius: 8px; cursor: pointer; width: 100%; font-weight: 800; font-size: 14px; text-transform: uppercase;" onclick="fecharAlertaBloqueante()">CIENTE 👍</button>`;

    if (mensagemObj.tipo === 'aviso_rapido') {
        const hostText = mensagemObj.host !== 'Não informado' ? ` | Host: <strong>${mensagemObj.host}</strong>` : '';
        htmlMensagem = `
            <div style="background: #EFF6FF; border-left: 4px solid #3B82F6; padding: 15px; border-radius: 8px; text-align: center;">
                <div style="margin-bottom: 10px; color: #1E293B; font-size: 13px;">👤 <strong>${mensagemObj.nome} (${mensagemObj.turno})</strong> assumiu:</div>
                <div style="font-family: Consolas, monospace; font-size: 13px; color: #1D4ED8; font-weight: bold;">👀 ${mensagemObj.servico}${hostText}</div>
            </div>`;
        filaDeAlertas.push({ html: htmlMensagem, botoes: botoesHTML, tipo: 'aviso' });
    } else {
        const isInfra = mensagemObj.form && mensagemObj.form.modo === 'infra';
        const isCritical = mensagemObj.form && mensagemObj.form.severidade === 'CRITICAL';
        htmlMensagem = `
            <div style="background: #E0F2FE; border-left: 4px solid #0EA5E9; padding: 15px; border-radius: 8px;">
                <div style="margin-bottom: 15px; color: #1E293B; font-size: 13px; text-align: center;">👤 <strong>${mensagemObj.nome}</strong> gerou um novo informe:</div>
                <div style="font-family: Consolas, monospace; font-size: 11px; color: #0369A1; text-align: center;">${mensagemObj.assunto}</div>
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

window.cienteSLA = function(alertaId) {
    db.ref('historico_noc').push({
        tipo: 'acao_sla', alertaId: alertaId, nome: currentUser.nome, acao: 'ciente', timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    fecharAlertaBloqueante();
}

window.silenciarSLA = function(chave) { 
    db.ref('historico_noc').push({
        tipo: 'acao_sla', chave: chave, nome: currentUser.nome, acao: 'silenciar_host', timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    fecharAlertaBloqueante(); 
    mostrarToast("🔕 Host silenciado na nuvem.", "info"); 
}
