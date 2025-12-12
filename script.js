// script.js (módulo)
// Usa Firebase via CDN (módulos)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ====== COLE AQUI SUA firebaseConfig (você já enviou pra mim; está incluída abaixo) ======
   Substitua se quiser outro projeto. */

const firebaseConfig = {
  apiKey: "AIzaSyBgsOEy1BkqfM_6aC3e00ZjA9wLRiIJa3c",
  authDomain: "controle-a4656.firebaseapp.com",
  projectId: "controle-a4656",
  storageBucket: "controle-a4656.firebasestorage.app",
  messagingSenderId: "683648293240",
  appId: "1:683648293240:web:da61af211b6d1cde72508d",
  measurementId: "G-KJYCR3GSBW"
};

/* ====== Inicializa Firebase ====== */
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ====== Estado ====== */
let editIndex = null;
let dados = [];
let codigo = null;
let saveTimeout = null;
const SAVE_DELAY = 700; // debounce

/* ====== Elementos ====== */
const codigoBadge = document.getElementById('codigoBadge');
const codigoInput = document.getElementById('codigoInput');
const loadBtn = document.getElementById('loadBtn');
const newBtn = document.getElementById('newBtn');
const copyCodeBtn = document.getElementById('copyCodeBtn');

/* ====== Eventos UI ====== */
loadBtn.addEventListener('click', () => {
  const c = codigoInput.value.trim();
  if (!c) return alert('Digite um código para carregar.');
  carregarCodigo(c);
});

newBtn.addEventListener('click', () => gerarECriar());
copyCodeBtn.addEventListener('click', () => {
  if (!codigo) return alert('Nenhum código gerado ainda.');
  navigator.clipboard.writeText(codigo).then(() => alert('Código copiado!'));
});

/* ====== Funções Firestore + código ====== */

function gerarCodigo(tamanho = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < tamanho; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

async function gerarECriar() {
  const novo = gerarCodigo(6);
  codigo = novo;
  codigoBadge.textContent = codigo;
  // cria doc se necessário
  const docRef = doc(db, 'listas', codigo);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    await setDoc(docRef, { gastos: [] });
  }
  escutarFirestore();
}

async function carregarCodigo(c) {
  codigo = c;
  codigoBadge.textContent = codigo;
  const docRef = doc(db, 'listas', codigo);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    if (!confirm('Código não encontrado. Deseja criar nova lista com esse código?')) {
      // reset codigo visível
      codigo = null;
      codigoBadge.textContent = '—';
      return;
    }
    await setDoc(docRef, { gastos: [] });
  }
  escutarFirestore();
}

function escutarFirestore() {
  if (!codigo) return;
  const docRef = doc(db, 'listas', codigo);
  // unsub anterior (se houver)
  if (window.__UNSUBSCRIBE__) window.__UNSUBSCRIBE__();
  window.__UNSUBSCRIBE__ = onSnapshot(docRef, (snapshot) => {
    const data = snapshot.data();
    dados = data && data.gastos ? data.gastos : [];
    // garantir número
    dados = dados.map(d => ({ ...d, valor: Number(d.valor || 0) }));
    atualizarTabela();
    atualizarTotais();
    atualizarPreview();
  }, (err) => {
    console.error('snapshot err', err);
  });
}

function salvarNoFirestore() {
  if (!codigo) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      const docRef = doc(db, 'listas', codigo);
      // salva todo o array (opção 1)
      await setDoc(docRef, { gastos: dados });
      // console.log('salvo');
    } catch (err) {
      console.error('Erro ao salvar:', err);
    }
  }, SAVE_DELAY);
}

/* ====== Seu código original (adaptado p/ salvar/ler) ====== */

function adicionar() {
    const registro = {
        data: document.getElementById("data").value,
        descricao: document.getElementById("descricao").value,
        categoria: document.getElementById("categoria").value,
        tipo: document.getElementById("tipo").value,
        valor: Number(document.getElementById("valor").value),
        pagamento: document.getElementById("pagamento").value,
        fixo: document.getElementById("fixo").value,
        obs: document.getElementById("obs").value || ""
    };

    if (!registro.data || !registro.descricao || !registro.valor) {
        alert("Preencha os campos obrigatórios.");
        return;
    }

    // Se ainda não tem código ativo, pergunta ao usuário (opção C: pode gerar ou digitar)
    if (!codigo) {
      const gerar = confirm('Nenhum código ativo. Deseja gerar um código novo agora? (OK = gerar / Cancel = cancelar)');
      if (gerar) {
        // cria e já escuta
        gerarECriar();
        // espere o onSnapshot popular dados antes de prosseguir (mas podemos prosseguir localmente)
      } else {
        return;
      }
    }

    if (editIndex === null) {
        dados.push(registro);
    } else {
        dados[editIndex] = registro;
        editIndex = null;
        document.getElementById("addBtn").textContent = "Adicionar";
    }

    atualizarTabela();
    atualizarTotais();
    atualizarPreview();
    salvarNoFirestore();

    // limpar campos
    document.getElementById('descricao').value = '';
    document.getElementById('valor').value = '';
    document.getElementById('obs').value = '';
}

function atualizarTabela() {
    const tbody = document.querySelector("#tabela tbody");
    tbody.innerHTML = "";

    let dadosOrdenados = [...dados].sort((a, b) => (a.categoria || '').localeCompare(b.categoria || ''));
    let categoriaAtual = null;

    dadosOrdenados.forEach((item) => {

        if (item.categoria !== categoriaAtual) {
            categoriaAtual = item.categoria;

            const catRow = document.createElement("tr");
            catRow.innerHTML = `
                <td colspan="9" class="categoria-header">${categoriaAtual || 'Sem categoria'}</td>
            `;
            tbody.appendChild(catRow);
        }

        const tr = document.createElement("tr");

        // achar índice real no array original (para editar/apagar corretamente)
        const realIndex = dados.findIndex(d => d === item);

        tr.innerHTML = `
            <td>${item.data}</td>
            <td>${item.descricao}</td>
            <td>${item.categoria}</td>
            <td>${item.tipo}</td>
            <td>R$ ${Number(item.valor || 0).toFixed(2)}</td>
            <td>${item.pagamento}</td>
            <td>${item.fixo}</td>
            <td>${item.obs}</td>
            <td>
                <button class="action-btn edit-btn" onclick="editar(${realIndex})">✏️</button>
                <button class="action-btn delete-btn" onclick="apagar(${realIndex})">🗑️</button>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

function atualizarTotais() {
    let entradas = dados.filter(d => d.tipo === "Entrada")
                        .reduce((acc, cur) => acc + Number(cur.valor || 0), 0);

    let saídas = dados.filter(d => d.tipo === "Saída")
                      .reduce((acc, cur) => acc + Number(cur.valor || 0), 0);

    document.getElementById("totalEntradas").innerText = entradas.toFixed(2);
    document.getElementById("totalSaidas").innerText = saídas.toFixed(2);
    document.getElementById("saldo").innerText = (entradas - saídas).toFixed(2);
}

function editar(i) {
    const item = dados[i];

    document.getElementById("data").value = item.data;
    document.getElementById("descricao").value = item.descricao;
    document.getElementById("categoria").value = item.categoria;
    document.getElementById("tipo").value = item.tipo;
    document.getElementById("valor").value = item.valor;
    document.getElementById("pagamento").value = item.pagamento;
    document.getElementById("fixo").value = item.fixo;
    document.getElementById("obs").value = item.obs;

    editIndex = i;
    document.getElementById("addBtn").textContent = "Salvar";
}

function apagar(i) {
    if (confirm("Excluir item?")) {
        dados.splice(i, 1);
        atualizarTabela();
        atualizarTotais();
        atualizarPreview();
        salvarNoFirestore();
    }
}

function exportarXLSX() {
    let dadosOrdenados = [...dados].sort((a, b) => (a.categoria || '').localeCompare(b.categoria || ''));

    let wsData = [];
    let categoriaAtual = null;

    dadosOrdenados.forEach(item => {
        if (item.categoria !== categoriaAtual) {
            categoriaAtual = item.categoria;
            wsData.push([categoriaAtual]);
            wsData.push(["--------------------------------------------"]);
        }

        wsData.push([
            item.data,
            item.descricao,
            item.tipo,
            item.valor,
            item.pagamento,
            item.fixo,
            item.obs
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gastos Domésticos");

    XLSX.writeFile(wb, "gastos_domesticos.xlsx");
}

function atualizarPreview() {
    const div = document.getElementById("preview");

    let dadosOrdenados = [...dados].sort((a, b) => (a.categoria || '').localeCompare(b.categoria || ''));
    let html = "<table><tbody>";

    let categoriaAtual = null;

    dadosOrdenados.forEach(item => {
        if (item.categoria !== categoriaAtual) {
            categoriaAtual = item.categoria;

            html += `
                <tr><td colspan="7" class="categoria-header">${categoriaAtual || 'Sem categoria'}</td></tr>
                <tr><td colspan="7">------------------------------------</td></tr>
            `;
        }

        html += `
        <tr>
            <td>${item.data}</td>
            <td>${item.descricao}</td>
            <td>${item.tipo}</td>
            <td>R$ ${Number(item.valor || 0).toFixed(2)}</td>
            <td>${item.pagamento}</td>
            <td>${item.fixo}</td>
            <td>${item.obs}</td>
        </tr>
        `;
    });

    html += "</tbody></table>";

    div.innerHTML = html;
}

/* ====== Inicialização: gerar um código automaticamente (opção C) e criar doc no Firestore ====== */
(async function init() {
  // gerar um código automático no carregamento (você pode sobrescrever usando o input)
  const inicial = gerarCodigo(6);
  codigo = inicial;
  codigoBadge.textContent = codigo;

  try {
    const docRef = doc(db, 'listas', codigo);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, { gastos: [] });
    }
    escutarFirestore();
  } catch (err) {
    console.error('Erro init firestore:', err);
  }
})();

/* ====== Exportar funções para o escopo global (para os onclicks inline) ====== */
window.adicionar = adicionar;
window.editar = editar;
window.apagar = apagar;
window.exportarXLSX = exportarXLSX;



