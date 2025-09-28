import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// Config Firebase
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


// --- Elementos ---
const tabCheckin = document.getElementById("tabCheckin");
const tabCadastro = document.getElementById("tabCadastro");
const checkinSection = document.getElementById("checkinSection");
const cadastroSection = document.getElementById("cadastroSection");
const dataInput = document.getElementById("dataCheckin");
const pesquisa = document.getElementById("pesquisa");
const listaPesquisa = document.getElementById("lista-pesquisa");
const listaPrimeiro = document.getElementById("lista-checkins-primeiro");
const listaSegundo = document.getElementById("lista-checkins-segundo");
const countPrimeiro = document.getElementById("count-primeiro");
const countSegundo = document.getElementById("count-segundo");

const formCadastro = document.getElementById("formCadastro");
const tituloCadastro = document.getElementById("tituloCadastro");

const inputs = {
  nome: document.getElementById("nome"),
  dataNascimento: document.getElementById("dataNascimento"), // novo
  responsavel: document.getElementById("responsavel"),
  telefone: document.getElementById("telefone"),
  alergias: document.getElementById("alergias"),
  banheiro: document.getElementById("banheiro"),
};

// --- Variáveis ---
let editandoId = null;
let unsubscribeCheckins = null;
let criancasCache = [];

// --- Data hoje ---
const hoje = new Date();
dataInput.value = hoje.toISOString().slice(0, 10);

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

// --- Funções auxiliares ---
function calcularIdade(dn) {
  const hoje = new Date();
  const nascimento = new Date(dn);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idade--;
  return idade;
}

function definirSala(idade) {
  if (idade <= 3) return "Babies";
  if (idade <= 6) return "Kids 1";
  if (idade <= 9) return "Kids 2";
  if (idade <= 12) return "Juvenis";
  return "Maior";
}

// --- Salvar criança ---
formCadastro.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nome = inputs.nome.value.trim();
  const dataNascimento = inputs.dataNascimento.value;
  const responsavel = inputs.responsavel.value.trim();
  const telefone = inputs.telefone.value.trim();
  const alergias = inputs.alergias.value.trim();
  const banheiro = inputs.banheiro.checked;

  if (!nome || !dataNascimento || !responsavel || !telefone) {
    alert("Preencha todos os campos obrigatórios!");
    return;
  }

  const idadeCalculada = calcularIdade(dataNascimento);
  const sala = definirSala(idadeCalculada);

  try {
    if (editandoId) {
      await updateDoc(doc(db, "criancas", editandoId), {
        nome,
        dataNascimento,
        idade: idadeCalculada,
        responsavel,
        telefone,
        alergias,
        banheiroSozinho: banheiro,
        sala,
      });
      editandoId = null;
      tituloCadastro.textContent = "Novo Cadastro";
    } else {
      await addDoc(collection(db, "criancas"), {
        nome,
        dataNascimento,
        idade: idadeCalculada,
        responsavel,
        telefone,
        alergias,
        banheiroSozinho: banheiro,
        sala,
      });
    }

    // --- Limpar form e voltar para check-in ---
    formCadastro.reset();
    tabCheckin.click();
    pesquisa.value = "";
    listaPesquisa.innerHTML = "";
  } catch (err) {
    console.error(err);
    alert("Erro ao salvar criança!");
  }
});

// --- Cache de crianças ---
onSnapshot(query(collection(db, "criancas"), orderBy("nome")), (snapshot) => {
  criancasCache = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
});

// --- Pesquisar crianças ---
pesquisa.addEventListener("input", () => {
  listaPesquisa.innerHTML = "";
  const termo = pesquisa.value.trim().toLowerCase();
  if (!termo) return;

  criancasCache.forEach((c) => {
    if (c.nome.toLowerCase().includes(termo)) {
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${c.nome}</strong> ${c.idade} anos<br>
        Sala: ${c.sala}<br>
        Resp: ${c.responsavel}<br>
        Tel: ${c.telefone}
        ${c.alergias ? `<div>⚠ ${c.alergias}</div>` : ""}
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
});

// --- Culto selecionado ---
function getCultoSelecionado() {
  const c = document.querySelector("input[name='culto']:checked");
  return c ? c.value : "primeiro";
}

// --- Check-in ---
async function checkin(idCrianca) {
  const pulseiraInput = document.getElementById(`pulseira-${idCrianca}`);
  if (!pulseiraInput) return;
  const pulseira = pulseiraInput.value.trim();
  if (!pulseira) return alert("Digite o número da pulseira!");

  const data = dataInput.value;
  if (!data) return alert("Selecione a data primeiro!");
  const culto = getCultoSelecionado();

  const qExist = query(
    collection(db, "checkins"),
    where("criancaId", "==", idCrianca),
    where("data", "==", data),
    where("culto", "==", culto)
  );

  try {
    const snapshotExist = await getDocs(qExist);
    if (!snapshotExist.empty)
      return alert(`Criança já registrada para o ${culto} culto hoje.`);

    await addDoc(collection(db, "checkins"), {
      criancaId: idCrianca,
      data,
      pulseira,
      presente: true,
      culto,
    });

    pesquisa.value = "";
    listaPesquisa.innerHTML = "";
    tabCheckin.click();
  } catch (err) {
    console.error(err);
    alert("Erro ao salvar check-in!");
  }
}

// --- Carregar check-ins ---
function carregarCheckinsHoje() {
  if (unsubscribeCheckins) unsubscribeCheckins();

  const dataSelecionada = dataInput.value;
  const qCheckins = query(collection(db, "checkins"), where("data", "==", dataSelecionada));

  unsubscribeCheckins = onSnapshot(qCheckins, async (snapshot) => {
    listaPrimeiro.innerHTML = "";
    listaSegundo.innerHTML = "";

    let countP = 0;
    let countS = 0;

    for (const docSnap of snapshot.docs) {
      const ch = docSnap.data();
      const criSnap = await getDoc(doc(db, "criancas", ch.criancaId));
      const c = criSnap.data();
      if (!c) continue;

      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${c.nome}</strong> Pulseira: ${ch.pulseira}<br>
        Sala: ${c.sala}<br>
        Resp: ${c.responsavel} - Tel: ${c.telefone}<br>
        <div>Banheiro sozinho: ${c.banheiroSozinho ? "Sim" : "Não"}</div>
        ${c.alergias ? `<div>⚠ ${c.alergias}</div>` : ""}<br>
      `;

      if (ch.culto === "primeiro") {
        listaPrimeiro.appendChild(li);
        countP++;
      } else if (ch.culto === "segundo") {
        listaSegundo.appendChild(li);
        countS++;
      }
    }

    countPrimeiro.textContent = countP;
    countSegundo.textContent = countS;
  });
}

// --- Editar ---
async function editar(id) {
  const docSnap = await getDoc(doc(db, "criancas", id));
  const c = docSnap.data();

  Object.entries(inputs).forEach(([key, input]) => {
    if (key === "banheiro") input.checked = c.banheiroSozinho;
    else input.value = c[key] || "";
  });

  editandoId = id;
  tabCadastro.click();
  tituloCadastro.textContent = `Editando: ${c.nome}`;
}

// --- Eventos ---
dataInput.addEventListener("change", carregarCheckinsHoje);

// --- Inicializa ---
carregarCheckinsHoje();

// --- Botão WhatsApp ---
const btnWhatsApp = document.getElementById("btn-whatsapp");
const numeroWhats = "5511975900603"; 

btnWhatsApp.addEventListener("click", () => {
  const gerarResumo = (listaElement, cultoNome) => {
    const salas = { "Babies": 0, "Kids 1": 0, "Kids 2": 0, "Juvenis": 0 };
    listaElement.querySelectorAll("li").forEach(li => {
      const salaMatch = li.innerHTML.match(/Sala: (\w+ \d?|\w+)/);
      if (salaMatch && salas[salaMatch[1]] !== undefined) {
        salas[salaMatch[1]]++;
      }
    });

    let resumo = `${cultoNome}\n`;
    for (const [sala, count] of Object.entries(salas)) {
      resumo += `${sala}: ${count} crianças\n`;
    }
    return resumo;
  };

  const texto = `${gerarResumo(listaPrimeiro, "1º Culto")}\n${gerarResumo(listaSegundo, "2º Culto")}`;

  const url = `https://wa.me/${numeroWhats}?text=${encodeURIComponent(texto)}`;
  window.open(url, "_blank");
});
