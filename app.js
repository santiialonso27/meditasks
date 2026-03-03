import confetti from "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.module.mjs";
// 🔥 Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBKxH2qTEhArWT09faZHNMTKS7Eu3YqhOs",
  authDomain: "multitareas-b3a1e.firebaseapp.com",
  projectId: "multitareas-b3a1e",
  storageBucket: "multitareas-b3a1e.firebasestorage.app",
  messagingSenderId: "944481413077",
  appId: "1:944481413077:web:02b4f4e433ae52da9aff5c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);
const board = document.getElementById("board");
const statusText = document.getElementById("statusText");
const loginCircleBtn = document.getElementById("loginCircleBtn");
const closeMenuBtn = document.getElementById("closeMenuBtn");
const loginTooltip = document.getElementById("loginTooltip");
let tooltipTimeout = null;
const logoutOverlay = document.getElementById("logoutOverlay");
const cancelLogout = document.getElementById("cancelLogout");
const confirmLogout = document.getElementById("confirmLogout");

let currentUser = null;
let unsubscribe = null;
let currentCalendarDate = new Date();
let hasCarriedOver = false;

let draggedElement = null;
let currentTarget = null;
let currentPosition = null;

function updateGreeting(user) {
  const greetingEl = document.getElementById("greetingTitle");
  if (!greetingEl) return;

  const now = new Date();
  const hour = now.getHours();

  let greetingText = "";

  // Obtener nombre
  let firstName = "Invitado";
  if (user && user.displayName) {
    firstName = user.displayName.split(" ")[0];
  }

  if (hour >= 6 && hour <= 19) {
    greetingText = `Buen día, ${firstName}`;
  } else {
    greetingText = `Buenas noches, ${firstName}`;
  }

  greetingEl.textContent = greetingText;
}

function updateSubtitle(user) {
  const subtitleEl = document.getElementById("dynamicSubtitle");
  if (!subtitleEl) return;

  const hour = new Date().getHours();

  const morningPhrases = [
    "Hoy va ser un gran día 🚀",
    "Arranquemos con todo 💪",
    "Un pequeño paso a la vez 🦶",
    "Organizado se vive mejor ✨",
    "Organizate desde temprano ☀️"
  ];

  const nightPhrases = [
    "Organizate antes de dormir 💤",
    "Que sea una noche productiva 🌙",
    "Un cafe y a seguir ☕️",
    "Tus objetivos no duermen 🏆",
    "Ya casi cerras el día ✅"
  ];

  const phrases = (hour >= 6 && hour <= 19)
    ? morningPhrases
    : nightPhrases;

  // elegir frase aleatoria
  const randomIndex = Math.floor(Math.random() * phrases.length);
  subtitleEl.textContent = phrases[randomIndex];
}

onAuthStateChanged(auth, async (user) => {

  updateGreeting(user);
  updateSubtitle(user);

  if (user) {

    currentUser = user;
    // 🔥 Ocultar tooltip si estaba visible
    loginTooltip.classList.remove("show");
    clearTimeout(tooltipTimeout);

    const fullName = user.displayName || "";
    const firstName = fullName.split(" ")[0].toUpperCase();
    // 🔥 Mostrar foto en botón circular
    loginCircleBtn.innerHTML = `
      <img src="${user.photoURL}" alt="Profile">
    `;
    loginCircleBtn.classList.add("logged-in");

    statusText.textContent = "Sincronizando tareas...";

    // 🔥 Cancelar listener anterior si existía
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    const userRef = doc(db, "users", user.uid);

    // 🔥 Listener en tiempo real
    unsubscribe = onSnapshot(userRef, async (snapshot) => {

      if (snapshot.exists()) {

        const data = snapshot.data();

        tasks = data.tasks || {};

        // 🔥 cargar tema del usuario
        if (data.theme) {
          currentTheme = data.theme;
          applyTheme(currentTheme);
          updateActiveThemeUI();
        }

      } else {

        // Si no tenía en la nube → subir lo local
        const localTasks = JSON.parse(localStorage.getItem(storeKey)) || {};
        tasks = localTasks;

        await setDoc(userRef, { tasks }, { merge: true });

      }

      // Limpiar local para evitar duplicados
      localStorage.removeItem(storeKey);

      init();
      statusText.textContent = "Tareas guardadas con éxito";

    });

      } else {

        // 🔥 Usuario NO logueado
        currentTheme = localStorage.getItem("app_theme") || "theme-default";
        applyTheme(currentTheme);
        updateActiveThemeUI();

        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }

        currentUser = null;

        loginCircleBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4"></circle>
            <path d="M4 20c2-4 6-6 8-6s6 2 8 6"></path>
          </svg>
        `;
        loginCircleBtn.classList.remove("logged-in");

        tasks = JSON.parse(localStorage.getItem(storeKey)) || {};
        init();

        statusText.textContent = "Inicia sesión para guardar tus tareas";
      }

    });


let profileMenuOpen = false;
const cornerContainer = document.getElementById("cornerContainer");

cornerContainer.classList.add("collapsed");

function closeCornerMenu() {
  // Fase 1: ocultar iconos instantáneo
  cornerContainer.classList.add("closing");

  // Fase 2: animar ancho en el siguiente frame
  requestAnimationFrame(() => {
    cornerContainer.classList.remove("expanded");
    cornerContainer.classList.add("collapsed");
  });

  profileMenuOpen = false;

  loginTooltip.classList.remove("show");
  clearTimeout(tooltipTimeout);
}

function openCornerMenu() {
  cornerContainer.classList.remove("collapsed");
  cornerContainer.classList.add("expanded");

  // esperar a que termine la transición antes de mostrar iconos
  setTimeout(() => {
    cornerContainer.classList.remove("closing");
  }, 550); // mismo tiempo que la transición CSS

  profileMenuOpen = true;
}


loginCircleBtn.addEventListener("click", async (e) => {
  e.stopPropagation();

  if (!profileMenuOpen) {
    openCornerMenu();

    // 🔥 Si NO está logueado → mostrar tooltip con delay
    if (!currentUser) {
      clearTimeout(tooltipTimeout);
      tooltipTimeout = setTimeout(() => {
        loginTooltip.classList.add("show");
      }, 1000); //1 segundo de delay//
    }

    return;
  }

  if (!currentUser) {
    await signInWithPopup(auth, provider);
  } else {
    logoutOverlay.classList.add("open");
  }
});

closeMenuBtn.addEventListener("click", (e) => {
  e.stopPropagation();

  if (profileMenuOpen) {
    closeCornerMenu();
  }
});

cancelLogout.addEventListener("click", () => {
  logoutOverlay.classList.remove("open");
});

confirmLogout.addEventListener("click", async () => {
  logoutOverlay.classList.remove("open");
  await signOut(auth);
});

logoutOverlay.addEventListener("click", (e) => {
  if (e.target === logoutOverlay) {
    logoutOverlay.classList.remove("open");
  }
});

const settingsBtn = document.getElementById("settingsBtn");

settingsBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  showToast("Ajustes aún no está disponible");
});

//CODIGO ANTIGUO
const DAYS = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const storeKey = "meditasks_tasks";

let tasks = JSON.parse(localStorage.getItem(storeKey)) || {};

let soundEnabled = JSON.parse(localStorage.getItem("soundEnabled"));
if (soundEnabled === null) soundEnabled = true;

async function save() {

  if (currentUser) {
    await setDoc(
      doc(db, "users", currentUser.uid),
      { tasks },
      { merge: true }
    );
  } else {
    localStorage.setItem(storeKey, JSON.stringify(tasks));
  }

}

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function createDayColumn(date) {
  const dayIndex = date.getDay();
  const iso = formatLocalDate(date);
  if (!tasks[iso]) tasks[iso] = [];

  const col = document.createElement("div");
  col.className = "col";
  if (isToday(date)) {
    col.classList.add("today-highlight");
  }

  col.innerHTML = `
    <div class="col-head">
      <div>
        <div class="col-title">${DAYS[dayIndex]}</div>
        <div class="col-sub">${date.toLocaleDateString()}</div>

        <div class="progress-wrapper">
          <div class="progress">
            <div class="progress-bar"></div>
          </div>
          <div class="progress-percent">0%</div>
        </div>
      </div>

      ${isToday(date) ? `
        <span class="pill today">Hoy</span>
      ` : ""}
    </div>

    <div class="list"></div>

    <div class="adder">
      <input class="input" placeholder="Nueva tarea…" />
    </div>
  `;

  const list = col.querySelector(".list");

  // DRAG OVER LIST
  list.addEventListener("dragover", e => {
    e.preventDefault();

    const tasksEls = list.querySelectorAll(".task");

    if (tasksEls.length === 0) {
      showIndicatorAtEnd();
    }
  });

  // DRAG LEAVE
  list.addEventListener("dragleave", e => {
    if (!e.relatedTarget || !list.contains(e.relatedTarget)) {
      removeIndicator();
    }
  });

  // DROP EN LIST (al final)
  list.addEventListener("drop", e => {
    e.preventDefault();
    e.stopPropagation();

    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;

    const data = JSON.parse(raw);
    if (!tasks[data.fromDate]) return;

    const originList = tasks[data.fromDate];
    const movedTask = originList[data.index];
    if (!movedTask) return;

    originList.splice(data.index, 1);

    // 🔥 usar el indicator SIEMPRE
    const indicator = list.querySelector(".drop-indicator");

    let insertIndex = tasks[iso].length;

    if (indicator) {
      const children = Array.from(list.children);
      insertIndex = children.indexOf(indicator);
    }

    // 🔥 AJUSTE CLAVE
    if (data.fromDate === iso && data.index < insertIndex) {
      insertIndex--;
    }

    tasks[iso].splice(insertIndex, 0, movedTask);

    if (indicator && draggedElement) {
      list.insertBefore(draggedElement, indicator);
      draggedElement.style.display = "";
    }

    removeIndicator();
    save();

    if (data.fromDate !== iso) {
      init();
    }
  });

  let dropIndicator = document.createElement("div");
  dropIndicator.className = "drop-indicator";

  function showIndicator(targetElement, position = "after") {

    // 🔥 Si ya está en el mismo lugar, no hacer nada
    if (currentTarget === targetElement && currentPosition === position) {
      return;
    }

    currentTarget = targetElement;
    currentPosition = position;

    removeIndicator(false); // no resetear estado todavía

    if(position === "before"){
      targetElement.insertAdjacentElement("beforebegin", dropIndicator);
    } else {
      targetElement.insertAdjacentElement("afterend", dropIndicator);
    }

    requestAnimationFrame(()=>{
      dropIndicator.classList.add("active");
    });
  }

  function showIndicatorAtEnd(){
    removeIndicator();
    list.appendChild(dropIndicator);
    requestAnimationFrame(()=>{
      dropIndicator.classList.add("active");
    });
  }

  function removeIndicator(resetState = true){

    dropIndicator.classList.remove("active");

    if(dropIndicator.parentNode){
      dropIndicator.parentNode.removeChild(dropIndicator);
    }

    if(resetState){
      currentTarget = null;
      currentPosition = null;
    }
  }

  const input = col.querySelector(".input");
  const progressBar = col.querySelector(".progress-bar");

  // Evitar que el input reciba el drop como texto
  input.addEventListener("dragover", e => {
    e.preventDefault();
  });

  input.addEventListener("drop", e => {
    e.preventDefault();
  });

  col.addEventListener("dragover", e => {
    e.preventDefault();
  });

  function render() {
    list.innerHTML = "";
    tasks[iso] = tasks[iso].filter(Boolean);
    tasks[iso].forEach((t, i) => {
      const el = document.createElement("div");
      el.className = "task" + (t.done ? " done" : "");
      el.draggable = true;
      //FUNCION DE DROP//
      el.addEventListener("drop", e => {
        e.preventDefault();
        e.stopPropagation();

        const raw = e.dataTransfer.getData("text/plain");
        if (!raw) return;

        const data = JSON.parse(raw);
        if (!tasks[data.fromDate]) return;

        const originList = tasks[data.fromDate];
        const movedTask = originList[data.index];
        if (!movedTask) return;

        // eliminar del origen
        originList.splice(data.index, 1);

        // 🔥 buscar la posición REAL del indicator en el DOM
        const indicator = list.querySelector(".drop-indicator");

        let insertIndex = tasks[iso].length;

        if (indicator) {
          const children = Array.from(list.children);
          insertIndex = children.indexOf(indicator);
        }

        tasks[iso].splice(insertIndex, 0, movedTask);

        if (indicator && draggedElement) {
          list.insertBefore(draggedElement, indicator);
          draggedElement.style.display = "";
        }

        removeIndicator();
        save();

        if (data.fromDate !== iso) {
          init();
        }
      });

      //FUNCION DRAGOVER//
      el.addEventListener("dragover", e => {
        e.preventDefault();

        // 🔥 NO permitir interactuar con la misma tarea
        if (el === draggedElement) return;

        const rect = el.getBoundingClientRect();
        const offset = e.clientY - rect.top;
        const middle = rect.height / 2;

        if(offset < middle){
          showIndicator(el, "before");
        } else {
          showIndicator(el, "after");
        }
      });

      el.dataset.index = i;
      el.dataset.date = iso;      el.innerHTML = `
        <div class="cb"></div>
        <div class="tmain">
          <div class="ttext">${t.text}</div>
        </div>
        <button class="icon danger">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `;
      const textDiv = el.querySelector(".ttext");

      textDiv.addEventListener("dblclick", () => {
        const oldText = t.text;

        const input = document.createElement("input");
        input.type = "text";
        input.value = oldText;
        input.className = "edit-input";

        textDiv.replaceWith(input);
        input.focus();
        input.select();

        function saveEdit() {
          const newValue = input.value.trim();
          if (newValue) {
            t.text = newValue;
            save();
          }
          render();
          renderMiniCalendar();
        }

        function cancelEdit() {
          render();
          renderMiniCalendar();
        }

        input.addEventListener("keydown", e => {
          if (e.key === "Enter") {
            saveEdit();
          }
          if (e.key === "Escape") {
            cancelEdit();
          }
        });

        input.addEventListener("blur", saveEdit);
      });
      el.addEventListener("dragstart", e => {

        draggedElement = el;

        e.dataTransfer.setData("text/plain", JSON.stringify({
          fromDate: iso,
          index: i
        }));

        // 🔥 ocultar visualmente la tarea original
        setTimeout(() => {
          el.style.display = "none";
        }, 0);

      });

      el.addEventListener("dragend", () => {

        if (draggedElement) {
          draggedElement.style.display = "";
        }

        draggedElement = null;
        removeIndicator();
      });

      el.querySelector(".cb").onclick = () => {
        const wasDone = t.done;

        t.done = !t.done;
        save();
        render();
        renderMiniCalendar();

        // Si se acaba de completar (no desmarcar)
        if (!wasDone && t.done) {

          const total = tasks[iso].length;
          const completed = tasks[iso].filter(task => task.done).length;

          setTimeout(() => {
            const tasksEls = col.querySelectorAll(".task");
            const last = tasksEls[i];
            if (last) {
              last.classList.add("reward");
            }
          }, 0);

          if (soundEnabled) {
            if (total > 0 && completed === total) {
              // 🎉 Día completo
              playDayCompleteSound();
              launchConfetti();
            } else {
              // ✔ Solo una tarea
              playRewardSound();
            }
          }
        }
      };

      el.querySelector("button").onclick = e => {
        e.stopPropagation();

        tasks[iso].splice(i,1);

        if (soundEnabled) {
          playRewardSound(); // 🔥 sonido al borrar
        }

        save();
        render();
        renderMiniCalendar();
      };

      list.appendChild(el);
    });


    const total = tasks[iso].length;
    const completed = tasks[iso].filter(t => t.done).length;

    let percent = 0;
    if (total > 0) {
      percent = Math.floor((completed / total) * 100);
    }

    progressBar.style.width = percent + "%";

    const percentEl = col.querySelector(".progress-percent");
    if (percentEl) {
      percentEl.textContent = percent + "%";

      if (percent === 100) {
        percentEl.classList.add("complete");
      } else {
        percentEl.classList.remove("complete");
      }
    }
  }

  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && input.value.trim()) {
      tasks[iso].push({ text: input.value.trim(), done:false });
      input.value = "";
      save();
      render();
    }
  });

  render();
  return col;

}

function isToday(d) {
  const t = new Date();
  return d.toDateString() === t.toDateString();
}

function init() {

  if (!hasCarriedOver) {
    carryOverPendings();
    hasCarriedOver = true;
  }

  board.innerHTML = "";
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(today.getDate() + i);
    board.appendChild(createDayColumn(d));
  }

  renderMiniCalendar();
}

const completeSound = new Audio("/sounds/task_complete.mp3");
completeSound.volume = 0.6;
completeSound.preload = "auto";
completeSound.load();

const dayCompleteSound = new Audio("/sounds/day_complete.mp3");
dayCompleteSound.volume = 0.7;
dayCompleteSound.preload = "auto";
dayCompleteSound.load();

function playRewardSound() {
  completeSound.currentTime = 0;
  completeSound.play();
}

function playDayCompleteSound() {
  dayCompleteSound.currentTime = 0;
  dayCompleteSound.play();
}

function launchConfetti() {
  const duration = 2000;
  const end = Date.now() + duration;

  (function frame() {

    const baseSettings = {
      particleCount: 10,
      spread: 70,
      startVelocity: 65,   // 🔥 más potencia
      gravity: 0.7,        // 🔥 caen más lento
      ticks: 100,          // 🔥 viven más tiempo
      scalar: 1.1
    };

    // Esquina inferior izquierda
    confetti({
      ...baseSettings,
      angle: 70,
      origin: { x: 0, y: 1 }
    });

    // Esquina inferior derecha
    confetti({
      ...baseSettings,
      angle: 110,
      origin: { x: 1, y: 1 }
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }

  })();
}

function showToast(message) {

  // si ya existe uno, eliminarlo
  const existing = document.getElementById("appToast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "appToast";
  toast.className = "app-toast";
  toast.textContent = message;

  document.body.appendChild(toast);

  // animación entrada
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  // auto eliminar
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

const soundToggle = document.getElementById("soundToggleTop");
const soundIcon = document.getElementById("soundIcon");

updateSoundIcon();

soundToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  soundEnabled = !soundEnabled;
  localStorage.setItem("soundEnabled", soundEnabled);
  updateSoundIcon();
});

function updateSoundIcon() {
  if (soundEnabled) {
    soundIcon.innerHTML = `
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <path d="M15 9a5 5 0 0 1 0 6"></path>
      <path d="M18 7a9 9 0 0 1 0 10"></path>
    `;
  } else {
    soundIcon.innerHTML = `
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <line x1="23" y1="1" x2="1" y2="23"></line>
    `;
  }
}

function carryOverPendings() {
  const today = formatLocalDate(new Date());

  // Obtener todas las fechas guardadas
  const dates = Object.keys(tasks);

  dates.forEach(dateKey => {
    if (dateKey < today) { // fechas anteriores
      const pending = tasks[dateKey].filter(t => !t.done);

      if (pending.length > 0) {
        if (!tasks[today]) tasks[today] = [];

        // agregar pendientes al día actual
        tasks[today] = [
          ...pending.map(t => ({ ...t, done: false })),
          ...tasks[today]
        ];
      }

      // eliminar el día viejo
      delete tasks[dateKey];
    }
  });
  save()
}

function renderMiniCalendar() {
  const container = document.getElementById("miniCalendar");
  if (!container) return;

  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let startDay = firstDay.getDay();

  // Convertir para que la semana empiece en Lunes
  startDay = (startDay === 0) ? 6 : startDay - 1;
  const totalDays = lastDay.getDate();

  const monthName = currentCalendarDate.toLocaleDateString("es-ES", { month: "long" });
  const monthTitle =
    monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const weekdays = ["L","M","M","J","V","S","D"];

  let html = `
    <div class="month-header">
      <button class="month-nav-btn" id="prevMonth">‹</button>
      <div class="month-title">${monthTitle} ${year}</div>
      <button class="month-nav-btn" id="nextMonth">›</button>
    </div>

    <div class="weekdays">
      ${weekdays.map(d => `<div>${d}</div>`).join("")}
    </div>

    <div class="days">
  `;

  // DÍAS DEL MES ANTERIOR
  const prevLastDay = new Date(year, month, 0).getDate();

  for (let i = startDay - 1; i >= 0; i--) {
    html += `
      <div class="day other-month">
        ${prevLastDay - i}
      </div>
    `;
  }

  for (let d = 1; d <= totalDays; d++) {
    const today = new Date();

    const isToday =
      d === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear();

    const dateObj = new Date(year, month, d);
    const dateStr = formatLocalDate(dateObj);

    const hasTasks =
      tasks[dateStr] &&
      tasks[dateStr].length > 0;

    html += `
      <div class="day ${isToday ? "today" : ""}" data-date="${dateStr}">
        <span class="day-number">${d}</span>
        ${hasTasks && !isToday ? `<span class="dot"></span>` : ""}
      </div>
    `;
  }

  // DÍAS DEL MES SIGUIENTE
  const totalCells = startDay + totalDays;
  const nextDays = (7 - (totalCells % 7)) % 7;

  for (let i = 1; i <= nextDays; i++) {
    html += `
      <div class="day other-month">
        ${i}
      </div>
    `;
  }

  html += `</div>`;

  container.innerHTML = html;

  // ⬅️ Después de renderizar el HTML, volvemos a enganchar los botones

  const prevMonthBtn = document.getElementById("prevMonth");
  const nextMonthBtn = document.getElementById("nextMonth");

  if (prevMonthBtn) {
    prevMonthBtn.addEventListener("click", () => {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
      renderMiniCalendar();
    });
  }

  if (nextMonthBtn) {
    nextMonthBtn.addEventListener("click", () => {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
      renderMiniCalendar();
    });
  }
  const dayEls = container.querySelectorAll(".day:not(.other-month)");

  dayEls.forEach(dayEl => {
    dayEl.addEventListener("click", () => {

      const dateStr = dayEl.dataset.date;

      const todayStr = formatLocalDate(new Date());

      if (dateStr < todayStr) {
        showToast("No es posible crear tareas en días pasados");
        return;
      }

      openDayModal(dateStr);
    });
  });
}



function openDayModal(dateStr) {

  const existing = document.getElementById("dayOverlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "overlay open";
  overlay.id = "dayOverlay";

  const modal = document.createElement("div");
  modal.className = "modal";

  const [year, month, day] = dateStr.split("-").map(Number);
  const selectedDate = new Date(year, month - 1, day);

  modal.innerHTML = `
    <div class="mhead">
      <strong>${selectedDate.toLocaleDateString()}</strong>
      <button class="btn" id="closeDayModal">Cerrar</button>
    </div>
    <div class="mbody" id="dayModalBody"></div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const body = modal.querySelector("#dayModalBody");

  // 🔥 Reutilizamos tu función existente
  const column = createDayColumn(selectedDate);
  body.appendChild(column);

  modal.querySelector("#closeDayModal").addEventListener("click", () => {
    overlay.remove();
    init(); // 🔥 refresca las 7 columnas
  });

  overlay.addEventListener("click", e => {
    if (e.target === overlay) {
      overlay.remove();
      init(); // 🔥 refresca board
    }
  });
}

const themeToggle = document.getElementById("themeToggleTop");
const themeMenu = document.getElementById("themeMenu");
const themeOptions = document.querySelectorAll(".theme-option");

const THEMES = [
  "theme-default",
  "theme-violet-pink",
  "theme-lava"
];

let currentTheme = "theme-default";

themeToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  themeMenu.classList.toggle("open");
});

document.addEventListener("click", () => {
  themeMenu.classList.remove("open");
});

themeOptions.forEach(option => {
  option.addEventListener("click", async () => {
    const selected = option.dataset.theme;
    currentTheme = selected;

    applyTheme(selected);
    updateActiveThemeUI();

    // 🔥 Guardar en Firebase si está logueado
    if (currentUser) {
      await setDoc(
        doc(db, "users", currentUser.uid),
        { theme: selected },
        { merge: true }
      );
    } else {
      // fallback si no está logueado
      localStorage.setItem("app_theme", selected);
    }

    themeMenu.classList.remove("open");
  });
});

function applyTheme(theme) {
  document.documentElement.classList.remove(...THEMES);
  document.documentElement.classList.add(theme);
}

function updateActiveThemeUI(){
  themeOptions.forEach(option=>{
    option.classList.toggle(
      "active",
      option.dataset.theme === currentTheme
    );
  });
}

window.addEventListener("beforeunload", function (e) {

  const hasTasks = Object.values(tasks).some(day => day.length > 0);

  if (!currentUser && hasTasks) {
    e.preventDefault();
    e.returnValue = "";
  }

});

const sidebar = document.querySelector(".sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const collapseToggle = document.getElementById("collapseToggle");

collapseToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  sidebarCollapsed = !sidebarCollapsed;
  sidebar.classList.toggle("collapsed", sidebarCollapsed);
});

let sidebarCollapsed = localStorage.getItem("sidebar_collapsed") === "true";

if (sidebarCollapsed) {
  sidebar.classList.add("collapsed");
}

sidebarToggle.addEventListener("click", () => {
  sidebarCollapsed = !sidebarCollapsed;
  sidebar.classList.toggle("collapsed", sidebarCollapsed);
  localStorage.setItem("sidebar_collapsed", sidebarCollapsed);
});

setInterval(() => {
  updateSubtitle(currentUser);
}, 600000); // cada 10 minutos

init();
