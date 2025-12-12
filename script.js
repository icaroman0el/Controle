// script.js (completo — versão corrigida e preservando Firebase)
// Usa Firebase via CDN (módulos)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ====== firebaseConfig ====== */
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
const SAVE_DELAY = 700;

/* ====== Elementos ====== */
const codigoBadge = document.getElementById('codigoBadge');
const codigoInput = document.getElementById('codigoInput');
const loadBtn = document.getElementById('loadBtn');
const newBtn = document.getElementById('newBtn');
const copyCodeBtn = document.getElementById('copyCodeBtn');

/* ====== Eventos UI ====== */
if (loadBtn) loadBtn.addEventListener('click', () => {
  const c = (codigoInput && codigoInput.value || '').trim();
  if (!c) return alert('Digite um código para carregar.');
  carregarCodigo(c);
});

if (newBtn) newBtn.addEventListener('click', () => gerarECriar());

if (copyCodeBtn) copyCodeBtn.addEventListener('click', () => {
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
  if (codigoBadge) codigoBadge.textContent = codigo;
  const docRef = doc(db, 'listas', codigo);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    await setDoc(docRef, { gastos: [] });
  }
  escutarFirestore();
}

async function carregarCodigo(c) {
  codigo = c;
  if (codigoBadge) codigoBadge.textContent = codigo;
  const docRef = doc(db, 'listas', codigo);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    if (!confirm('Código não encontrado. Deseja criar nova lista com esse código?')) {
      codigo = null;
      if (codigoBadge) codigoBadge.textContent = '—';
      return;
    }
    await setDoc(docRef, { gastos: [] });
  }
  escutarFirestore();
}

function escutarFirestore() {
  if (!codigo) return;
  const docRef = doc(db, 'listas', codigo);
  if (window.__UNSUBSCRIBE__) window.__UNSUBSCRIBE__();
  window.__UNSUBSCRIBE__ = onSnapshot(docRef, (snapshot) => {
    const data = snapshot.data();
    dados = data && data.gastos ? data.gastos : [];
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
      await setDoc(docRef, { gastos: dados });
    } catch (err) {
      console.error('Erro ao salvar:', err);
    }
  }, SAVE_DELAY);
}

/* ===========================================================
   ➕ Adicionar / Atualizar Registro (CORRIGIDO)
   =========================================================== */
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

  // Validação básica
  if (!registro.data || !registro.descricao || !registro.valor) {
    alert("Preencha os campos obrigatórios.");
    return;
  }

  // Se não houver código, perguntar / gerar
  if (!codigo) {
    const gerar = confirm('Nenhum código ativo. Deseja gerar um código novo agora?');
    if (gerar) {
      // gera e escuta (async)
      gerarECriar();
      // prosseguimos — registro será salvo localmente e sincronizado pelo salvarNoFirestore
    } else {
      return;
    }
  }

  // Se editIndex for nulo -> adicionar, caso contrário atualizar o item
  if (editIndex === null) {
    dados.push(registro);
  } else {
    dados[editIndex] = registro;
    editIndex = null;
    // voltar botão ao rótulo original
    const addBtn = document.getElementById("addBtn");
    if (addBtn) addBtn.textContent = "Adicionar";
  }

  // Atualiza UI e salva
  atualizarTabela();
  atualizarTotais();
  atualizarPreview();
  salvarNoFirestore();

  // Limpa formulário
  limparFormulario();
}

/* ===========================================================
   🧼 Limpar todos os campos (NOVO)
   =========================================================== */
function limparFormulario() {
  const campos = [
    "data",
    "descricao",
    "categoria",
    "tipo",
    "valor",
    "pagamento",
    "fixo",
    "obs"
  ];

  campos.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  editIndex = null;
}

/* ===========================================================
   📋 Atualizar Tabela (mantém categorias e ícones)
   =========================================================== */
function atualizarTabela() {
  const tbody = document.querySelector("#tabela tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  let dadosOrdenados = [...dados].sort((a, b) => (a.categoria || '').localeCompare(b.categoria || ''));

  let categoriaAtual = null;

  dadosOrdenados.forEach((item) => {
    if (item.categoria !== categoriaAtual) {
      categoriaAtual = item.categoria;
      const catRow = document.createElement("tr");
      catRow.innerHTML = `<td colspan="9" class="categoria-header">${categoriaAtual || 'Sem categoria'}</td>`;
      tbody.appendChild(catRow);
    }

    const realIndex = dados.findIndex(d => d === item);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.data}</td>
      <td>${item.descricao}</td>
      <td>${item.categoria}</td>
      <td>${item.tipo}</td>
      <td><strong>R$ ${Number(item.valor || 0).toFixed(2)}</strong></td>
      <td>${item.pagamento}</td>
      <td>${item.fixo}</td>
      <td>${item.obs}</td>
      <td style="white-space:nowrap; display:flex; gap:8px;">
        <button class="action-btn edit-btn" onclick="editar(${realIndex})" title="Editar">✏️</button>
        <button class="action-btn delete-btn" onclick="apagar(${realIndex})" title="Excluir">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ===========================================================
   📊 Atualizar Totais
   =========================================================== */
function atualizarTotais() {
  let entradas = dados.filter(d => d.tipo === "Entrada").reduce((acc, cur) => acc + Number(cur.valor || 0), 0);
  let saidas = dados.filter(d => d.tipo === "Saída").reduce((acc, cur) => acc + Number(cur.valor || 0), 0);

  const totalEntradasEl = document.getElementById("totalEntradas");
  const totalSaidasEl = document.getElementById("totalSaidas");
  const saldoEl = document.getElementById("saldo");

  if (totalEntradasEl) totalEntradasEl.innerText = entradas.toFixed(2);
  if (totalSaidasEl) totalSaidasEl.innerText = saidas.toFixed(2);
  if (saldoEl) saldoEl.innerText = (entradas - saidas).toFixed(2);
}

/* ===========================================================
   ✏️ Editar e 🗑️ Apagar
   =========================================================== */
function editar(i) {
  const item = dados[i];
  if (!item) return;

  const pad = id => document.getElementById(id);

  if (pad("data")) pad("data").value = item.data;
  if (pad("descricao")) pad("descricao").value = item.descricao;
  if (pad("categoria")) pad("categoria").value = item.categoria;
  if (pad("tipo")) pad("tipo").value = item.tipo;
  if (pad("valor")) pad("valor").value = item.valor;
  if (pad("pagamento")) pad("pagamento").value = item.pagamento;
  if (pad("fixo")) pad("fixo").value = item.fixo;
  if (pad("obs")) pad("obs").value = item.obs;

  editIndex = i;
  const addBtn = document.getElementById("addBtn");
  if (addBtn) addBtn.textContent = "Atualizar";
}

function apagar(i) {
  if (!confirm("Excluir item?")) return;
  dados.splice(i, 1);
  atualizarTabela();
  atualizarTotais();
  atualizarPreview();
  salvarNoFirestore();
}

/* ===========================================================
   📤 Exportar XLSX
   =========================================================== */
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

/* ===========================================================
   🖨 Atualizar Preview (cards ou tabela simples)
   =========================================================== */
function atualizarPreview() {
  const div = document.getElementById("preview");
  if (!div) return;

  // vamos renderizar em CARDS para ficar legível no mobile
  div.innerHTML = "";
  let dadosOrdenados = [...dados].sort((a, b) => (a.categoria || '').localeCompare(b.categoria || ''));

  let categoriaAtual = null;

  dadosOrdenados.forEach((item, idx) => {
    if (item.categoria !== categoriaAtual) {
      categoriaAtual = item.categoria;
      const catEl = document.createElement("div");
      catEl.className = "categoria-header";
      catEl.textContent = categoriaAtual || "Sem categoria";
      catEl.style.margin = "12px 0 6px";
      div.appendChild(catEl);
    }

    const card = document.createElement("div");
    card.className = "preview-card";
    card.style.padding = "10px";
    card.style.marginBottom = "10px";
    card.style.borderRadius = "10px";
    card.style.background = "rgba(255,255,255,0.02)";

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-weight:700">${item.descricao}</div>
        <div style="font-weight:800;color:#ffd4ff">R$ ${Number(item.valor || 0).toFixed(2)}</div>
      </div>
      <div style="font-size:13px;color:#cfc2ff;margin-bottom:6px">
        <span style="display:inline-block;margin-right:8px">📅 ${item.data}</span>
        <span style="display:inline-block;margin-right:8px">🏷️ ${item.tipo}</span>
        <span style="display:inline-block">💳 ${item.pagamento}</span>
      </div>
      <div style="font-size:13px;color:#ddd;margin-bottom:8px">${item.obs || ''}</div>
      <div style="display:flex;gap:8px">
        <button class="action-btn edit-btn" onclick="editar(${idx})">✏️ Editar</button>
        <button class="action-btn delete-btn" onclick="apagar(${idx})">🗑️ Excluir</button>
      </div>
    `;
    div.appendChild(card);
  });

  if (dadosOrdenados.length === 0) {
    div.innerHTML = "<div style='opacity:.7'>Nenhum registro — adicione algo acima.</div>";
  }
}

/* ===========================================================
   Inicialização: gerar código automático e escutar Firestore
   =========================================================== */
(async function init() {
  try {
    const inicial = gerarCodigo(6);
    codigo = inicial;
    if (codigoBadge) codigoBadge.textContent = codigo;

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

/* ===========================================================
   Exportar funções para o escopo global (onclicks inline)
   =========================================================== */
window.adicionar = adicionar;
window.editar = editar;
window.apagar = apagar;
window.exportarXLSX = exportarXLSX;
window.limparFormulario = limparFormulario;
