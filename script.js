// --- Imports Firebase 12 ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
  query,
  orderBy,
  where,
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
const db = getFirestore(app);

// --- Elementos HTML ---
const checkinSection = document.getElementById("checkinSection");
const listaHoje = document.getElementById("lista-checkins-hoje");
const listaPesquisa = document.getElementById("lista-pesquisa");
const pesquisa = document.getElementById("pesquisa");
const formCadastro = document.getElementById("formCadastro");
const tituloCadastro = document.getElementById("tituloCadastro");
const tabCheckin = document.getElementById("tabCheckin");
const tabCadastro = document.getElementById("tabCadastro");
const cadastroSection = document.getElementById("cadastroSection");
const dataInput = document.getElementById("dataCheckin");
const dataSelecionadaEl = document.getElementById("dataSelecionada");

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
let unsubscribeCheckins = null;
let criancasCache = [];

// --- Preenche data com hoje ---
const hoje = new Date();
const dia = String(hoje.getDate()).padStart(2, "0");
const mes = String(hoje.getMonth() + 1).padStart(2, "0");
const ano = hoje.getFullYear();
dataInput.value = `${ano}-${mes}-${dia}`;
let dataSelecionada = dataInput.value;
dataSelecionadaEl.textContent = `Check-ins de ${dataSelecionada}`;

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

  if (!nome || !idade || !responsavel || !telefone) {
    alert("Preencha todos os campos obrigatórios!");
    return;
  }

  if (editandoId) {
    const ref = doc(db, "criancas", editandoId);
    await updateDoc(ref, { nome, idade, responsavel, telefone, alergias, banheiroSozinho: banheiro });
    editandoId = null;
    tituloCadastro.textContent = "Novo Cadastro";
  } else {
    await addDoc(collection(db, "criancas"), { nome, idade, responsavel, telefone, alergias, banheiroSozinho: banheiro });
  }

  formCadastro.reset();
}

// --- Carregar crianças para cache ---
const qCriancas = query(collection(db, "criancas"), orderBy("nome"));
onSnapshot(qCriancas, snapshot => {
  criancasCache = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
});

// --- Pesquisar crianças ---
function pesquisarCriancas() {
  const termo = pesquisa.value.trim().toLowerCase();
  listaPesquisa.innerHTML = "";

  if (!termo) return;

  criancasCache.forEach(c => {
    if (c.nome.toLowerCase().includes(termo)) {
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${c.nome}</strong> (${c.idade} anos) - Resp: ${c.responsavel}<br>
        Tel: ${c.telefone}
        ${c.alergias ? `<div class="alerta">⚠ ${c.alergias}</div>` : ""}
        <div>Banheiro sozinho: ${c.banheiroSozinho ? "Sim" : "Não"}</div>
        <input type="text" id="pulseira-${c.id}" placeholder="Nº pulseira">
        <button class="btn-checkin">Check-in</button>
        <button class="btn-editar">Editar</button>
      `;
      listaPesquisa.appendChild(li);

      li.querySelector(".btn-checkin").addEventListener("click", () => checkin(c.id));
      li.querySelector(".btn-editar").addEventListener("click", () => editar(c.id));
    }
  });
}

// --- Check-in ---
async function checkin(idCrianca) {
  const pulseiraInput = document.getElementById(`pulseira-${idCrianca}`);
  if (!pulseiraInput) return;
  const pulseira = pulseiraInput.value.trim();
  if (!pulseira) return alert("Digite o número da pulseira!");

  const data = dataInput.value;
  if (!data) return alert("Selecione a data primeiro!");

  try {
    await addDoc(collection(db, "checkins"), {
      criancaId: idCrianca,
      data,
      pulseira,
      presente: true
    });

    // Limpa pesquisa
    listaPesquisa.innerHTML = "";
    pesquisa.value = "";

  } catch (error) {
    console.error("Erro ao salvar check-in:", error);
    alert("Erro ao salvar check-in no Firebase!");
  }
}

// --- Carregar check-ins por data ---
function carregarCheckinsHoje() {
  // Remove listener antigo, se existir
  if (unsubscribeCheckins) unsubscribeCheckins();

  dataSelecionada = dataInput.value;
  dataSelecionadaEl.textContent = `Check-ins de ${dataSelecionada}`;

  const qCheckins = query(collection(db, "checkins"), where("data", "==", dataSelecionada));

  unsubscribeCheckins = onSnapshot(qCheckins, async snapshot => {
    listaHoje.innerHTML = "";

    for (const docSnap of snapshot.docs) {
      const checkin = docSnap.data();
      const criancaSnap = await getDoc(doc(db, "criancas", checkin.criancaId));
      const c = criancaSnap.data();

      if (!c) continue;

      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${c.nome}</strong> - Pulseira: ${checkin.pulseira}<br>
        Resp: ${c.responsavel} - Tel: ${c.telefone}
        ${c.alergias ? `<div class="alerta">⚠ ${c.alergias}</div>` : ""}
      `;
      listaHoje.appendChild(li);
    }
  });
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
  inputs.pulseira.value = "";
  tabCadastro.click();
  tituloCadastro.textContent = `Editando: ${c.nome}`;
}

// --- Event listeners ---
formCadastro.addEventListener("submit", salvarCrianca);
pesquisa.addEventListener("input", pesquisarCriancas);
dataInput.addEventListener("change", carregarCheckinsHoje);

// --- Inicializa ---
carregarCheckinsHoje();
