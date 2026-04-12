// ==========================================
// MÓDULO DE AUTENTICAÇÃO (LOGIN/LOGOUT)
// ==========================================

export let currentUser = null;

// Função para verificar se já existe alguém logado quando a página abre
export function inicializarAuth() {
    try {
        const salvo = localStorage.getItem('noc_user_info');
        if (salvo && salvo !== "undefined" && salvo !== "null") {
            currentUser = JSON.parse(salvo);
            document.getElementById('user-display').innerHTML = `👤 ${currentUser.nome} (${currentUser.turno})`;
            document.getElementById('modal-login').style.display = 'none';
            document.getElementById('history-container').style.display = 'block';
            console.log("Usuário logado recuperado:", currentUser.nome);
        } else {
            document.getElementById('modal-login').style.display = 'flex';
        }
    } catch (e) {
        localStorage.removeItem('noc_user_info');
        document.getElementById('modal-login').style.display = 'flex';
    }
}

// Penduramos no 'window' para o HTML conseguir achar o onclick="salvarLogin()"
window.salvarLogin = function() {
    const nomeEl = document.getElementById('login-nome');
    const nome = nomeEl.value;
    const turno = document.getElementById('login-turno').value;
    
    if(!nome || nome === "") { 
        alert("Por favor, selecione seu nome na lista oficial!");
        return; 
    }
    
    currentUser = { nome, turno };
    try { localStorage.setItem('noc_user_info', JSON.stringify(currentUser)); } catch(e){}
    
    document.getElementById('modal-login').style.display = 'none';
    document.getElementById('user-display').innerHTML = `👤 ${currentUser.nome} (${currentUser.turno})`;
    document.getElementById('history-container').style.display = 'block';
    
    // Recarregamos a página rapidamente para forçar os outros módulos a iniciarem com o usuário logado
    window.location.reload();
}

// Penduramos no 'window' para o onclick="fazerLogout()"
window.fazerLogout = function() {
    if(confirm("Deseja sair do seu usuário atual?")) {
        try { localStorage.removeItem('noc_user_info'); } catch(e){}
        currentUser = null;
        window.location.reload(); // Recarrega a página para limpar a tela e voltar pro login
    }
}
