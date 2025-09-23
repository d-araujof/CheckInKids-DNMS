// --- Imports Firebase 12 ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-analytics.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
  query,
  orderBy,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// --- Config Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyBdNNg9g_zd_ZUBzLi_Px5HOdvYLBm_B48",
  authDomain: "checkinkids-dnms.firebaseapp.com",
  projectId: "checkinkids-dnms",
  storageBucket: "checkinkids-dnms.firebasestorage.app",
  messagingSenderId: "655551956270",
  appId: "1:655551956270:web:af32fed74d62931777e6bf",
  measurementId: "G-BHMPF13SQF"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// --- Elementos HTML ---
const lista = document.getElementById("lista-criancas");
const pesquisa = document.getElementById("pesquisa");
const formCadastro = document.getElementById("formCadastro");
const tituloCadastro = document.getElementById("tituloCadastro");
const tabCheckin = document.getElementById("tabCheckin");
const tabCadastro = document.getElementById("tabCadastro");
const checkinSection = document.getElementById("checkinSection");
const cadastroSection = document.getElementById("cadastroSection");

const inputs = {
  nome: document.getElementById("nome"),
  idade: document.getElementById("idade"),
  responsavel: document.getElementById("responsavel"),
  telefone: document.getElementById("telefone"),
  alergias: document.getElementById("alergias"),
  banheiro: document.getElementById("banheiro"),
  pulseira: document.getElementById("pulseira")
};

let editandoId = null;

// --- Troca de abas ---
tabCheckin.addEventListener("click", () => {
  tabCheckin.classList.add("active");
  tabCadastro.classList.remove("active");
  checkinSection.classList.remove("hidden");
  cadastroSection.classList.add("hidden");
});

tabCadastro.addEventListener("click", () => {
  tabCadastro.classList.add("active");
  tabCheckin.classList.remove("active");
  cadastroSection.classList.remove("hidden");
  checkinSection.classList.add("hidden");
});

// --- Salvar ou atualizar criança ---
async function salvarCrianca(e) {
  e.preventDefault();

  const nome = inputs.nome.value.trim();
  const idade = inputs.idade.value.trim();
  const responsavel = inputs.responsavel.value.trim();
  const telefone = inputs.telefone.value.trim();
  const alergias = inputs.alergias.value.trim();
  const banheiro = inputs.banheiro.checked;
  const pulseira = inputs.pulseira.value.trim();

  if (!nome || !idade || !responsavel || !telefone) {
    alert("Preencha todos os campos obrigatórios!");
    return;
  }

  if (editandoId) {
    const ref = doc(db, "criancas", editandoId);
    await updateDoc(ref, { nome, idade, responsavel, telefone, alergias, banheiroSozinho: banheiro, pulseira });
    editandoId = null;
    tituloCadastro.textContent = "Novo Cadastro";
  } else {
    await addDoc(collection(db, "criancas"), { nome, idade, responsavel, telefone, alergias, banheiroSozinho: banheiro, pulseira, presente: false, historico: [] });
  }

  formCadastro.reset();
}

// --- Renderizar lista de crianças ---
function renderLista(snapshot) {
  const termo = pesquisa.value.toLowerCase();
  lista.innerHTML = "";

  snapshot.forEach(docSnap => {
    const c = docSnap.data();
    if (c.nome.toLowerCase().includes(termo)) {
      const li = document.createElement("li");
      li.className = c.presente ? "presente" : "";
      li.innerHTML = `
        <strong>${c.nome}</strong> (${c.idade} anos) - Resp: ${c.responsavel} - Tel: ${c.telefone}
        ${c.alergias ? `<div class="alerta">⚠ ${c.alergias}</div>` : ""}
        <div>Banheiro sozinho: ${c.banheiroSozinho ? "Sim" : "Não"}</div>
        <input type="text" id="pulseira-${docSnap.id}" placeholder="Nº pulseira" value="${c.pulseira || ""}">
        <button class="btn-checkin">${c.presente ? "Presente ✔" : "Check-in"}</button>
        <button class="btn-editar">Editar</button>
      `;
      lista.appendChild(li);

      // Botões funcionando
      li.querySelector(".btn-checkin").addEventListener("click", () => checkin(docSnap.id));
      li.querySelector(".btn-editar").addEventListener("click", () => editar(docSnap.id));
    }
  });
}

// --- Firestore em tempo real ---
const q = query(collection(db, "criancas"), orderBy("nome"));
onSnapshot(q, renderLista);
pesquisa.addEventListener("input", () => onSnapshot(q, renderLista));

// --- Check-in ---
async function checkin(id) {
  const pulseira = document.getElementById(`pulseira-${id}`).value.trim();
  if (!pulseira) { alert("Digite o número da pulseira!"); return; }

  const ref = doc(db, "criancas", id);
  const hoje = new Date().toISOString().split("T")[0];
  const docSnap = await getDoc(ref);
  const c = docSnap.data();

  let historico = c.historico || [];
  const indexHoje = historico.findIndex(h => h.data === hoje);

  if (indexHoje >= 0) historico[indexHoje] = { data: hoje, presente: true, pulseira };
  else historico.push({ data: hoje, presente: true, pulseira });

  await updateDoc(ref, { presente: true, pulseira, historico });
}

// --- Editar criança ---
async function editar(id) {
  const ref = doc(db, "criancas", id);
  const docSnap = await getDoc(ref);
  const c = docSnap.data();

  Object.entries(inputs).forEach(([key, input]) => {
    if (key === "banheiro") input.checked = c.banheiroSozinho;
    else input.value = c[key] || "";
  });

  editandoId = id;
  tabCadastro.click();
  tituloCadastro.textContent = `Editando: ${c.nome}`;
}

// --- Event listeners globais ---
window.checkin = checkin;
window.editar = editar;
window.salvarCrianca = salvarCrianca;
document.getElementById("btnCadastrar").addEventListener("click", salvarCrianca);

