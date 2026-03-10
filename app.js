let appReady = false;
import confetti from "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.module.mjs";
// 🔥 Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc,
  onSnapshot,
  collection,
  getDocs,
  query,
  orderBy,
  limit
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
let lastCarryDate = null;

let draggedElement = null;
let currentTarget = null;
let currentPosition = null;
let previewInsertIndex = null;

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

let player = JSON.parse(localStorage.getItem("mt_player")) || {
  exp: 0,
  level: 0,
  todayExpTasks: 0,
  lastExpDate: null,
  dailyLimitShown: false
};

if(localStorage.getItem("mt_theme_mode")==="light"){
  document.documentElement.classList.add("light-mode");
}

function updateGreeting(user) {
  const greetingEl = document.getElementById("greetingTitle");
  if (!greetingEl) return;

  const hour = new Date().getHours();
  let nameToShow = "Invitado";

  if (user && user.displayName) {
    const parts = user.displayName.trim().split(/\s+/);

    if (parts.length >= 2) {
      // Tomar solo las primeras 2 palabras
      nameToShow = parts.slice(0, 2).join(" ");
    } else {
      nameToShow = parts[0];
    }
  }

  const greetingText =
    hour >= 6 && hour <= 19
      ? `Buen día, ${nameToShow}`
      : `Buenas noches, ${nameToShow}`;

  if (window.innerWidth <= 900) {
    const parts = greetingText.split(", ");
    greetingEl.innerHTML = `
      <span>${parts[0]},</span>
      <span>${parts[1]}</span>
    `;
  } else {
    greetingEl.textContent = greetingText;
  }
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

let hasRendered = false;

onAuthStateChanged(auth, async (user) => {

  if (user) {

    currentUser = user;
    // 🔥 Ocultar tooltip si estaba visible
    loginTooltip.classList.remove("show");
    clearTimeout(tooltipTimeout);

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

    await setDoc(
      userRef,
      {
        name: user.displayName,
        photo: user.photoURL
      },
      { merge: true }
    );

    // 🔥 Listener en tiempo real
    unsubscribe = onSnapshot(userRef, async (snapshot) => {

      if (snapshot.exists()) {
        const data = snapshot.data();
        tasks = data.tasks || {};
        projects = data.projects || {};
        if (data.viewMode) {
          currentViewMode = data.viewMode;
          localStorage.setItem("mt_view_mode", currentViewMode);
        }

        if (data.player) {
          player = data.player;
        } else {
          player = {
            exp: 0,
            level: 0,
            todayExpTasks: 0,
            lastExpDate: null
          };
        }

        // 🔥 cargar tema del usuario
        if (data.theme) {
          currentTheme = data.theme;
          applyTheme(currentTheme);
        }

        if (data.mode) {

          if (data.mode === "light") {
            document.documentElement.classList.add("light-mode");
          } else {
            document.documentElement.classList.remove("light-mode");
          }

          localStorage.setItem("mt_theme_mode", data.mode);
          updateModeIcon();
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

      updateLevel();

      if (!hasRendered) {
          document.body.classList.remove("app-loading");
          appReady = true;
          hasRendered = true;
        }

      statusText.textContent = "Tareas guardadas con éxito";

    });

    updateGreeting(user);
    updateSubtitle(user);

      } else {

        // 🔥 Usuario NO logueado
        currentTheme = localStorage.getItem("app_theme") || "theme-default";
        applyTheme(currentTheme);

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
        updateGreeting(user);
        updateSubtitle(user);

        if (!hasRendered) {
            document.body.classList.remove("app-loading");
            appReady = true;
            hasRendered = true;
          }
      }

    });

function showLeaderboardModal(users){

  const existing = document.getElementById("leaderboardOverlay");
  if(existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "overlay open";
  overlay.id = "leaderboardOverlay";

  const modal = document.createElement("div");
  modal.className = "modal";

  let html = `
    <div class="mhead">
      <strong>TABLA DE POSICIONES</strong>
      <button class="btn" id="closeLeaderboard">Cerrar</button>
    </div>
    <div class="mbody leaderboard-list">
  `;

    if(users.length === 0){
      html += `<div class="leaderboard-empty">Aún no hay jugadores</div>`;
    }

  users.forEach((u,i)=>{

    let posDisplay;

    if(i === 0) posDisplay = "🥇";
    else if(i === 1) posDisplay = "🥈";
    else if(i === 2) posDisplay = "🥉";
    else posDisplay = `<span class="leader-rank-circle">${i+1}</span>`;

    html += `
      <div class="leaderboard-row ${currentUser && u.uid === currentUser.uid ? "leader-self" : ""}">

        <div class="leader-pos">${posDisplay}</div>

        <img 
          class="leader-photo"
          src="${u.photo}"
          onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random'"
        >

        <div class="leader-name">${u.name}</div>

        <div class="leader-level">
          Nivel ${u.level}
        </div>

        <div class="leader-exp">
          ${u.exp} pts
        </div>

      </div>
    `;

  });

  html += `</div>`;

  modal.innerHTML = html;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document
    .getElementById("closeLeaderboard")
    .onclick = ()=>{

      overlay.remove();

      if(leaderboardUnsub){
        leaderboardUnsub();
        leaderboardUnsub = null;
      }

  };

  overlay.onclick = (e)=>{

    if(e.target === overlay){

      overlay.remove();

      if(leaderboardUnsub){
        leaderboardUnsub();
        leaderboardUnsub = null;
      }

    }

  };

}

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
  }, 50); // tiempo que tarda en mostrar los iconos

  profileMenuOpen = true;
}


loginCircleBtn.addEventListener("click", async (e) => {
  e.stopPropagation();

  const isMobile = window.innerWidth <= 900;

  // 🔥 Si es mobile y la sidebar está abierta → cerrarla primero
  if (isMobile && !sidebar.classList.contains("collapsed")) {
    sidebar.classList.add("collapsed");
  }

  if (!profileMenuOpen) {
    openCornerMenu();

    if (!currentUser) {
      clearTimeout(tooltipTimeout);
      tooltipTimeout = setTimeout(() => {
        loginTooltip.classList.add("show");
      }, 1000);
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

const savedData = JSON.parse(localStorage.getItem(storeKey)) || {};

let tasks = savedData.tasks || {};
let projects = savedData.projects || {};

let currentViewMode = localStorage.getItem("mt_view_mode") || "tasks"; // tasks | projects

const tasksViewBtn = document.getElementById("tasksViewBtn");
const projectsViewBtn = document.getElementById("projectsViewBtn");

function updateViewButtons(){

  if(!tasksViewBtn || !projectsViewBtn) return;

  const bubble = document.getElementById("toggleBubble");

  if(currentViewMode === "tasks"){

    tasksViewBtn.classList.add("active");
    projectsViewBtn.classList.remove("active");

    if(bubble) bubble.style.transform = "translateX(0%)";

  }else{

    tasksViewBtn.classList.remove("active");
    projectsViewBtn.classList.add("active");

    if(bubble) bubble.style.transform = "translateX(100%)";

  }

}

if(tasksViewBtn){
  tasksViewBtn.onclick = ()=>{

    currentViewMode = "tasks";
    localStorage.setItem("mt_view_mode", currentViewMode);

    updateViewButtons();
    init();
  };
}

if(projectsViewBtn){
  projectsViewBtn.onclick = ()=>{

    currentViewMode = "projects";
    localStorage.setItem("mt_view_mode", currentViewMode);

    updateViewButtons();
    init();
  };
}

let soundEnabled = JSON.parse(localStorage.getItem("soundEnabled"));
if (soundEnabled === null) soundEnabled = true;

async function save() {

  if (currentUser) {
    await setDoc(
      doc(db, "users", currentUser.uid),
      { 
        tasks,
        projects,
        viewMode: currentViewMode
      },
      { merge: true }
    );

    await setDoc(
      doc(db, "leaderboard", currentUser.uid),
      {
        name: currentUser.displayName,
        photo: currentUser.photoURL,
        level: player.level,
        exp: player.exp
      },
      { merge:true }
    );

  } else {
    localStorage.setItem(storeKey, JSON.stringify({
      tasks,
      projects
    }));
  }

}

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function resetDailyExpIfNeeded(){

  const today = formatLocalDate(new Date());

  if(player.lastExpDate !== today){
    player.todayExpTasks = 0;
    player.lastExpDate = today;
    player.dailyLimitShown = false;
    savePlayer();
  }

}

function rewardExp(){

  resetDailyExpIfNeeded();

  if(player.todayExpTasks >= 5){
    return;
  }

  player.exp += 100;
  player.todayExpTasks++;

  updateLevel();
  savePlayer();
}

function showExpGain(cbElement, amount = 100){

  const rect = cbElement.getBoundingClientRect();

  const el = document.createElement("div");
  el.className = "exp-float";
  el.textContent = `+${amount} EXP`;

  el.style.left = rect.left + rect.width/2 + "px";
  el.style.top = rect.top + "px";

  document.body.appendChild(el);

  requestAnimationFrame(()=>{
    el.classList.add("show");
  });

  setTimeout(()=>{
    el.remove();
  },900);

}

function isToday(d) {
  if (!d) return false;
  const t = new Date();
  return d.toDateString() === t.toDateString();
}

function createDayColumn(date, externalTasks = null, projectId = null) {
  const dayIndex = date ? date.getDay() : null;
  const iso = date ? formatLocalDate(date) : undefined;

  const isProject = projectId !== null;
  let dayTasks;

  if (isProject) {

    if (!projects[projectId].tasks) {
      projects[projectId].tasks = [];
    }

    dayTasks = projects[projectId].tasks;

  } else {

    if (!tasks[iso]) tasks[iso] = [];
    dayTasks = tasks[iso];

  }

  const col = document.createElement("div");
  col.className = "col";
  if (date && isToday(date)) {
    col.classList.add("today-highlight");
  } else {
    col.classList.add("not-today");
  }

  col.innerHTML = `
    <div class="col-head">
      <div>
        <div class="col-title">${DAYS[dayIndex]}</div>
        <div class="col-sub">${date ? date.toLocaleDateString() : ""}</div>

        <div class="progress-wrapper">
          <div class="progress">
            <div class="progress-bar"></div>
          </div>
          <div class="progress-percent">0%</div>
        </div>
      </div>

      ${date && isToday(date) ? `
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
    let originList;

    if (data.fromProject) {

      if(!projects[data.fromProject]) return;
      originList = projects[data.fromProject].tasks;

    }else{

      if (!tasks[data.fromDate]) return;
      originList = tasks[data.fromDate];

    }
    const movedTask = originList[data.index];
    if (!movedTask) return;

    // 🔥 usar el indicator SIEMPRE
    const indicator = list.querySelector(".drop-indicator");

    // 🔒 evitar drop sin preview
    if (!indicator) {
      if (draggedElement) draggedElement.style.opacity = "";
      return;
    }

    originList.splice(data.index, 1);

    let insertIndex = previewInsertIndex;

    if (insertIndex === null) {
      insertIndex = dayTasks.length;
    }

    
    if (
      (!isProject && data.fromDate === iso && data.index < insertIndex) ||
      (isProject && data.fromProject === projectId && data.index < insertIndex)
    ) {
      insertIndex--;
    }

    dayTasks.splice(insertIndex, 0, movedTask);

    if (indicator && draggedElement) {
      list.insertBefore(draggedElement, indicator);
      draggedElement.style.opacity = "";
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

    // si ya estamos en el mismo target y misma posición → no hacer nada
    if (currentTarget === targetElement && currentPosition === position) {
      return;
    }

    currentTarget = targetElement;
    currentPosition = position;

    const parent = targetElement.parentNode;

    if (position === "before") {

      if (dropIndicator.parentNode === parent &&
          dropIndicator.nextSibling === targetElement) {
        return;
      }

      removeIndicator(false);
      parent.insertBefore(dropIndicator, targetElement);

    } else {

      if (dropIndicator.parentNode === parent &&
          targetElement.nextSibling === dropIndicator) {
        return;
      }

      removeIndicator(false);
      parent.insertBefore(dropIndicator, targetElement.nextSibling);
    }

    requestAnimationFrame(() => {
      dropIndicator.classList.add("active");
    });
  }

  function showIndicatorAtEnd(){

    // si ya está al final, no hacer nada
    if (dropIndicator.parentNode === list &&
        list.lastElementChild === dropIndicator) {
      return;
    }

    removeIndicator(false);

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
    for (let i = dayTasks.length - 1; i >= 0; i--) {
      if (!dayTasks[i]) dayTasks.splice(i, 1);
    }
    dayTasks.forEach((t, i) => {
      if (t.expGiven === undefined) t.expGiven = false;
      const el = document.createElement("div");
      el.className = "task" + (t.done ? " done" : "");
      el.draggable = !isTouchDevice;

      el.dataset.index = i;

      if (projectId !== null) {
        el.dataset.project = projectId;
      } else {
        el.dataset.date = iso;
      }

      //FUNCION DE DROP//
      el.addEventListener("drop", e => {
        e.preventDefault();
        e.stopPropagation();

        const raw = e.dataTransfer.getData("text/plain");
        if (!raw) return;

        const data = JSON.parse(raw);
        let originList;

        if (data.fromProject) {
          if (!projects[data.fromProject]) return;
          originList = projects[data.fromProject].tasks;
        } else {
          if (!tasks[data.fromDate]) return;
          originList = tasks[data.fromDate];
        }
        const movedTask = originList[data.index];
        if (!movedTask) return;

        // 🔥 buscar la posición REAL del indicator en el DOM
        const indicator = list.querySelector(".drop-indicator");

        // 🔒 Si no hay indicator → cancelar drop
        if (!indicator) {
          if (draggedElement) draggedElement.style.opacity = "";
          return;
        }

        // eliminar del origen
        originList.splice(data.index, 1);

        let insertIndex = previewInsertIndex;

        if (insertIndex === null) {
          insertIndex = dayTasks.length;
        }

        // ajuste cuando se mueve dentro de la misma lista
        if (
          (data.fromProject && data.fromProject === projectId) ||
          (!data.fromProject && data.fromDate === iso)
        ) {
          if (data.index < insertIndex) {
            insertIndex--;
          }
        }

        dayTasks.splice(insertIndex, 0, movedTask);

        if (indicator && draggedElement) {
          list.insertBefore(draggedElement, indicator);
          draggedElement.style.opacity = "";
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

        if (el === draggedElement) return;

        const rect = el.getBoundingClientRect();
        const offset = e.clientY - rect.top;
        const percent = offset / rect.height;

        const DEAD_ZONE_TOP = 0.4;
        const DEAD_ZONE_BOTTOM = 0.6;

        const draggedIndex = parseInt(draggedElement.dataset.index);
        const targetIndex = parseInt(el.dataset.index);

        let insertIndex = targetIndex;

        if (percent > DEAD_ZONE_BOTTOM) {
          insertIndex = targetIndex + 1;
        }

        // 🔥 ajuste cuando se mueve dentro de la misma lista
        if (draggedIndex < insertIndex) {
          insertIndex--;
        }

        // 🔥 si no cambia posición → no mostrar preview
        if (insertIndex === draggedIndex) {
          removeIndicator();
          return;
        }

        if (percent < DEAD_ZONE_TOP) {
          previewInsertIndex = targetIndex;
          showIndicator(el, "before");
        } 
        else if (percent > DEAD_ZONE_BOTTOM) {
          previewInsertIndex = targetIndex + 1;
          showIndicator(el, "after");
        }
      });

      el.dataset.index = i;
      
      el.innerHTML = `
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

      // DESKTOP
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
          if (e.key === "Enter") saveEdit();
          if (e.key === "Escape") cancelEdit();
        });

        input.addEventListener("blur", saveEdit);

      });


      // MOBILE DOUBLE TAP
      el.addEventListener("touchend", (e) => {

        const now = Date.now();

        if(!el.dataset.lastTap){
          el.dataset.lastTap = now;
          return;
        }

        const delta = now - el.dataset.lastTap;
        el.dataset.lastTap = now;

        if(delta < 300){

          e.preventDefault();
          showTaskMobileMenu(el, t, render);

        }

      });

      el.addEventListener("dragstart", e => {

        draggedElement = el;

        e.dataTransfer.setData("text/plain", JSON.stringify({
          fromDate: iso,
          fromProject: projectId,
          index: i
        }));

        // 🔥 ocultar visualmente la tarea original
        setTimeout(() => {
          el.style.opacity = "0";
        }, 0);

      });

      el.addEventListener("dragend", () => {

        if (draggedElement) {
          draggedElement.style.opacity = "";
        }

        draggedElement = null;

        previewInsertIndex = null;

        removeIndicator();
      });

      if (isTouchDevice) {

        let startY = 0;

        el.addEventListener("touchstart", (e) => {

          e.stopPropagation();

          startY = e.touches[0].clientY;
          draggedElement = el;

          el.classList.add("dragging-touch");

        });

        el.addEventListener("touchmove", (e) => {

          e.preventDefault();

          if (!draggedElement) return;

          const touch = e.touches[0];
          const y = touch.clientY;

          const elementBelow = document.elementFromPoint(touch.clientX, y);

          const taskBelow = elementBelow?.closest(".task");

          if (taskBelow && taskBelow !== draggedElement) {

            const rect = taskBelow.getBoundingClientRect();
            const percent = (y - rect.top) / rect.height;

            if (percent < 0.5) {
              showIndicator(taskBelow, "before");
            } else {
              showIndicator(taskBelow, "after");
            }

          }

        });

        el.addEventListener("touchend", () => {

          const indicator = list.querySelector(".drop-indicator");

          if (indicator && draggedElement) {
            indicator.parentNode.insertBefore(draggedElement, indicator);
          }

          draggedElement?.classList.remove("dragging-touch");

          if (draggedElement) {
            draggedElement.style.opacity = "";
          }

          draggedElement = null;

          removeIndicator();
          save();
        });

      }

      el.querySelector(".icon.danger").onclick = async () => {

        if (soundEnabled) {
          playDeleteTaskSound();
        }

        dayTasks.splice(i,1);

        await save();
        render();
        renderMiniCalendar();

        updateDayModalTaskCount(iso);

      };

      el.querySelector(".cb").onclick = () => {

        const cb = el.querySelector(".cb");

        const wasDone = t.done;

        t.done = !t.done;

        let expShown = false;

        resetDailyExpIfNeeded();

        if(t.done && !t.expGiven){

          t.expGiven = true;
          save(); // 🔒 guardar inmediatamente para evitar exploits

          if(player.todayExpTasks < 5){

            rewardExp();
            expShown = true;

            showExpGain(cb,100);

          }else{

            if(!player.dailyLimitShown){

              player.dailyLimitShown = true;
              savePlayer();

              showToast("Límite diario de EXP alcanzado");
            }

          }

        }


        const total = dayTasks.length;
        const completed = dayTasks.filter(task => task.done).length;

        if (!wasDone && t.done && soundEnabled) {

          if (total > 0 && completed === total) {
            playDayCompleteSound();
            launchConfetti();
          } else {
            playRewardSound();
          }

        }

        t.done ? el.classList.add("done") : el.classList.remove("done");


        if (!wasDone && t.done) {

          const index = dayTasks.indexOf(t);
          const isLast = index === dayTasks.length - 1;

          if(!isLast){

            const delay = expShown ? 900 : 0;

            setTimeout(()=>{

              if(index !== -1 && index < dayTasks.length){
                const task = dayTasks.splice(index,1)[0];
                dayTasks.push(task);
              }

              save();
              render();
              renderMiniCalendar();

            },delay);

          }else{
            save();
            render();
            renderMiniCalendar();
          }

        }else{
          save();
          render();
          renderMiniCalendar();
        }

      };

      list.appendChild(el);
    });


    const total = dayTasks.length;
    const completed = dayTasks.filter(t => t.done).length;

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

    if (e.key === "Enter") {
      e.preventDefault();
    }

    if (e.key === "Enter" && input.value.trim()) {

      let text = input.value.trim();

      // 🔥 Si el primer carácter es letra y está en minúscula → convertirlo
      if (/^[a-záéíóúñ]/.test(text)) {
        text = text.charAt(0).toUpperCase() + text.slice(1);
      }

      const newTask = { text, done:false, expGiven:false };

      const firstDoneIndex = dayTasks.findIndex(t => t.done);

      if(firstDoneIndex === -1){
        dayTasks.push(newTask);
      }else{
        dayTasks.splice(firstDoneIndex, 0, newTask);
      }

      if (iso) {
        updateDayModalTaskCount(iso);
      }

      if (soundEnabled) {
        playAddTaskSound();
      }

      input.value = "";
      save();
      render();
    }
  });

  render();
  return col;

}

function createProjectColumn(projectId){

  const project = projects[projectId];
  if(!project) return document.createElement("div");

  const col = createDayColumn(
    null,
    null,
    projectId
  );

  col.classList.add("today-highlight");

  col.classList.add("project-col");

  const title = col.querySelector(".col-title");
  const sub = col.querySelector(".col-sub");

  if(title) title.textContent = project.title;
  if(sub) sub.textContent = "Proyecto";

  return col;

}

function renderProjectsView(){

  board.innerHTML = "";

  const container = document.createElement("div");
  container.className = "projects-container";

  // BOTON AGREGAR
  const addCard = document.createElement("div");
  addCard.className = "project-add-card";

  addCard.innerHTML = `
    <div class="project-add-inner">
      <svg width="36" height="36" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      <span>Agregar proyecto</span>
    </div>
  `;

  addCard.onclick = async ()=>{

    const title = prompt("Nombre del proyecto");

    if(!title) return;

    const id = "p_" + Date.now();

    projects[id] = {
      title,
      tasks: [],
      createdAt: Date.now()
    };

    await save();

    renderProjectsView();

  };


  // RENDER PROYECTOS
  Object.entries(projects)
    .sort((a,b)=> (a[1].createdAt || 0) - (b[1].createdAt || 0))
    .forEach(([id,project])=>{

    const column = createProjectColumn(id);

    // cambiar título
    const title = column.querySelector(".col-title");
    const sub = column.querySelector(".col-sub");

    if(title) title.textContent = project.title;
    if(sub) sub.textContent = "Proyecto";

    if(title){

      title.addEventListener("dblclick", ()=>{

        const oldTitle = project.title;

        const input = document.createElement("input");
        input.type = "text";
        input.value = oldTitle;
        input.className = "edit-input";

        title.replaceWith(input);

        input.focus();
        input.select();

        function saveEdit(){

          const newValue = input.value.trim();

          if(newValue){
            projects[id].title = newValue;
            save();
          }

          renderProjectsView();
        }

        function cancelEdit(){
          renderProjectsView();
        }

        input.addEventListener("keydown", e=>{
          if(e.key === "Enter") saveEdit();
          if(e.key === "Escape") cancelEdit();
        });

        input.addEventListener("blur", saveEdit);

      });


      // MOBILE DOUBLE TAP
      title.addEventListener("touchend", (e)=>{

        const now = Date.now();

        if(!title.dataset.lastTap){
          title.dataset.lastTap = now;
          return;
        }

        const delta = now - title.dataset.lastTap;
        title.dataset.lastTap = now;

        if(delta < 300){
          e.preventDefault();
          title.dispatchEvent(new Event("dblclick"));
        }

      });

    }

    const titleRow = column.querySelector(".col-title");

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon danger project-delete";

    deleteBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 11v6"/>
      <path d="M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
    `;

    titleRow.appendChild(deleteBtn);

    deleteBtn.onclick = async ()=>{

      draggedElement = null;
      previewInsertIndex = null;

      const confirmDelete = confirm("¿Eliminar proyecto?");

      if(!confirmDelete) return;

      delete projects[id];

      await save();

      renderProjectsView();

    };

    container.appendChild(column);

  });

  container.appendChild(addCard);

  board.appendChild(container);

}



function init() {

  resetDailyExpIfNeeded();

  const todayStr = formatLocalDate(new Date());

  if (lastCarryDate !== todayStr) {

    carryOverPendings();   // mover pendientes
    cleanPastDays();       // 🔥 borrar días pasados
    save();                // 🔥 guardar en Firebase

    lastCarryDate = todayStr;
  }

  board.innerHTML = "";
  updateViewButtons();

  if(currentViewMode === "projects"){
    renderProjectsView();
    renderMiniCalendar();
    return;
  }

  const today = new Date();

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(today.getDate() + i);
    board.appendChild(createDayColumn(d));
  }

  renderMiniCalendar();
  updateLevel();
}

const completeSound = new Audio("/sounds/task_complete.wav");
completeSound.volume = 0.6;
completeSound.preload = "auto";
completeSound.load();

const dayCompleteSound = new Audio("/sounds/day_complete.mp3");
dayCompleteSound.volume = 0.7;
dayCompleteSound.preload = "auto";
dayCompleteSound.load();

const addTaskSound = new Audio("/sounds/add_task.wav");
addTaskSound.volume = 0.6;
addTaskSound.preload = "auto";
addTaskSound.load();

const deleteTaskSound = new Audio("/sounds/delete_task.wav");
deleteTaskSound.volume = 0.6;
deleteTaskSound.preload = "auto";
deleteTaskSound.load();

function playRewardSound() {
  completeSound.currentTime = 0;
  completeSound.play();
}

function playDayCompleteSound() {
  dayCompleteSound.currentTime = 0;
  dayCompleteSound.play();
}

function playAddTaskSound() {
  addTaskSound.currentTime = 0;
  addTaskSound.play();
}

function playDeleteTaskSound() {
  deleteTaskSound.currentTime = 0;
  deleteTaskSound.play();
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

  if (!appReady) return;

  const existing = document.getElementById("appToast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "appToast";
  toast.className = "app-toast";
  toast.textContent = message;

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function showTaskMobileMenu(taskElement, taskData, render){

  const existing = document.getElementById("taskMobileMenu");
  if(existing) existing.remove();

  const rect = taskElement.getBoundingClientRect();
  
  const menu = document.createElement("div");
  menu.id = "taskMobileMenu";

  menu.style.position = "fixed";
  menu.style.left = rect.left + rect.width/2 + "px";
  menu.style.top = rect.top - 10 + "px";
  menu.style.transform = "translate(-50%, -100%)";

  menu.style.padding = "8px 12px";
  menu.style.borderRadius = "10px";

  menu.style.background = "rgba(20,20,25,.9)";
  menu.style.backdropFilter = "blur(10px)";
  menu.style.border = "1px solid rgba(255,255,255,.1)";

  menu.style.fontSize = "13px";
  menu.style.fontWeight = "600";

  menu.style.display = "flex";
  menu.style.gap = "10px";

  menu.style.zIndex = "9999";

  menu.innerHTML = `
    <span id="taskEditBtn" style="cursor:pointer;">Editar</span>
  `;

  document.body.appendChild(menu);

  menu.addEventListener("touchstart", e => e.stopPropagation());

  // EDITAR
  menu.querySelector("#taskEditBtn").onclick = ()=>{

    menu.remove();

    const textDiv = taskElement.querySelector(".ttext");

    const oldText = taskData.text;

    const input = document.createElement("input");
    input.type = "text";
    input.value = oldText;
    input.className = "edit-input";

    textDiv.replaceWith(input);

    input.focus();
    input.select();

    function saveEdit(){

      const newValue = input.value.trim();

      if(newValue){
        taskData.text = newValue;
        save();
      }

      render();
    }

    input.addEventListener("keydown", e=>{
      if(e.key === "Enter") saveEdit();
      if(e.key === "Escape") render();
    });

    input.addEventListener("blur", saveEdit);

  };

  // cerrar si tocás afuera
  setTimeout(()=>{

    document.addEventListener("touchstart", (e)=>{

      if(!menu.contains(e.target)){
        menu.remove();
      }

    },{once:true});

  },50);

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
  const dates = Object.keys(tasks);
  let changed = false;

  dates.forEach(dateKey => {

    // 🔒 evitar tocar el día actual
    if (dateKey === today) return;

    if (dateKey < today) {

      const pending = tasks[dateKey].filter(t => !t.done);

      if (pending.length > 0) {

        if (!tasks[today]) tasks[today] = [];

        // 🔥 mover pendientes a hoy
        // 🔒 evitar duplicados en hoy
        const existingTexts = new Set((tasks[today] || []).map(t => t.text));

        const toMove = pending.filter(t => !existingTexts.has(t.text));

        if (toMove.length > 0) {
          tasks[today] = [
            ...toMove,
            ...(tasks[today] || [])
          ];

          changed = true;
        }

        tasks[dateKey] = tasks[dateKey].filter(t => t.done);
      }

      // 🔥 si ya no quedan tareas en ese día → eliminar
      if (tasks[dateKey].length === 0) {
        delete tasks[dateKey];
      }

    }

  });

  if (changed) save();
}

function cleanPastDays() {

  const today = formatLocalDate(new Date());

  Object.keys(tasks).forEach(dateKey => {

    if (dateKey < today) {
      delete tasks[dateKey];
    }

  });

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

    const todayStr = formatLocalDate(new Date());

    const hasTasks =
      dateStr >= todayStr &&
      tasks[dateStr] &&
      tasks[dateStr].some(t => !t.done);

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

      const isMobile = window.innerWidth <= 900;

      // 🔥 Si es mobile y la sidebar está abierta → cerrarla
      if (isMobile && !sidebar.classList.contains("collapsed")) {
        sidebar.classList.add("collapsed");
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

  const taskCount = (tasks[dateStr] || []).length;
  const label = taskCount === 1 ? "TAREA" : "TAREAS";

  modal.innerHTML = `
    <div class="mhead">
      <strong>
        <span class="task-count">${taskCount}</span> ${label} EN ESTE DÍA
      </strong>
      <button class="btn" id="closeDayModal">Cerrar</button>
    </div>
    <div class="mbody" id="dayModalBody"></div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const body = modal.querySelector("#dayModalBody");

  // 🔥 Reutilizamos tu función existente
  const column = createDayColumn(selectedDate);

  const title = column.querySelector(".col-title")?.textContent || "";
  const sub = column.querySelector(".col-sub")?.textContent || "";

  const strong = modal.querySelector(".mhead strong");

  strong.dataset.dateLabel = `${title} ${sub}`;

  strong.innerHTML = `
    <span class="task-count">${taskCount}</span> ${label} EN ESTE DÍA
  `;

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

function updateDayModalTaskCount(dateStr){

  const strong = document.querySelector("#dayOverlay .mhead strong");
  if(!strong) return;

  const count = (tasks[dateStr] || []).length;
  const label = count === 1 ? "TAREA" : "TAREAS";

  const dateLabel = strong.dataset.dateLabel || "";

  strong.innerHTML = `
    <span class="task-count">${count}</span> ${label} EN ESTE DÍA
  `;
}

function openThemeModal() {

  const existing = document.getElementById("themeOverlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "overlay open";
  overlay.id = "themeOverlay";

  const modal = document.createElement("div");
  modal.className = "modal";

  modal.innerHTML = `
    <div class="mhead">
      <strong>Seleccionar Tema</strong>
      <button class="btn" id="closeThemeModal">Cerrar</button>
    </div>

    <div class="mbody theme-grid">

      <div class="theme-card" data-theme="theme-default">
        <div class="theme-big preview-default"></div>
        <span>Default</span>
      </div>

      <div class="theme-card" data-theme="theme-amatista">
        <div class="theme-big preview-amatista"></div>
        <span>Amatista</span>
      </div>

      <div class="theme-card" data-theme="theme-lava">
        <div class="theme-big preview-lava"></div>
        <span>Lava</span>
      </div>

      <div class="theme-card" data-theme="theme-zafiro">
        <div class="theme-big preview-zafiro"></div>
        <span>Zafiro</span>
      </div>

      <div class="theme-card" data-theme="theme-jade">
        <div class="theme-big preview-jade"></div>
        <span>Jade</span>
      </div>

      <div class="theme-card" data-theme="theme-atardecer">
        <div class="theme-big preview-atardecer"></div>
        <span>Atardecer</span>
      </div>

      <div class="theme-card" data-theme="theme-opalo">
        <div class="theme-big preview-opalo"></div>
        <span>Opalo</span>
      </div>

      <div class="theme-card" data-theme="theme-tulipan">
        <div class="theme-big preview-tulipan"></div>
        <span>Tulipan</span>
      </div>


    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById("closeThemeModal").addEventListener("click", () => {
    overlay.remove();
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const cards = modal.querySelectorAll(".theme-card");

  cards.forEach(card => {
    card.addEventListener("click", async () => {

      const selected = card.dataset.theme;
      currentTheme = selected;

      applyTheme(selected);

      if (currentUser) {
        await setDoc(
          doc(db, "users", currentUser.uid),
          { theme: selected },
          { merge: true }
        );
      } else {
        localStorage.setItem("app_theme", selected);
      }

      overlay.remove();
    });
  });

}

const themeToggle = document.getElementById("themeToggleTop");

const THEMES = [
  "theme-default",
  "theme-amatista",
  "theme-lava",
  "theme-zafiro",
  "theme-jade",
  "theme-atardecer",
  "theme-opalo",
  "theme-tulipan"
];

let currentTheme = "theme-default";

themeToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  openThemeModal();
});

function applyTheme(theme) {
  document.documentElement.classList.remove(...THEMES);
  document.documentElement.classList.add(theme);
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
let sidebarCollapsed = localStorage.getItem("sidebar_collapsed") === "true";

collapseToggle.addEventListener("click", (e) => {
  e.stopPropagation();

  const wasCollapsed = sidebar.classList.contains("collapsed");

  if (wasCollapsed) {
    sidebar.classList.add("opening");
  }

  sidebarCollapsed = !sidebarCollapsed;

  sidebar.classList.toggle("collapsed", sidebarCollapsed);

  localStorage.setItem("sidebar_collapsed", sidebarCollapsed);

  if (wasCollapsed) {
    setTimeout(() => {
      sidebar.classList.remove("opening");
    }, 150); // mismo tiempo que la transición del CSS
  }
});

if (sidebarCollapsed) {
  sidebar.classList.add("no-transition");
  sidebar.classList.add("collapsed");

  requestAnimationFrame(() => {
    sidebar.classList.remove("no-transition");
  });
}

sidebarToggle.addEventListener("click", () => {

  sidebar.classList.add("opening"); // 👈 agregar

  sidebarCollapsed = !sidebarCollapsed;
  sidebar.classList.toggle("collapsed", sidebarCollapsed);

  localStorage.setItem("sidebar_collapsed", sidebarCollapsed);

  setTimeout(() => {
    sidebar.classList.remove("opening"); // 👈 quitar después
  }, 230); // mismo tiempo que la animación CSS
});

const mobileSidebarOpen = document.getElementById("mobileSidebarOpen");

const desktopCollapsedCalendar = document.getElementById("desktopCollapsedCalendar");

if (desktopCollapsedCalendar && sidebar) {
  desktopCollapsedCalendar.addEventListener("click", (e) => {
    e.stopPropagation();
    sidebar.classList.remove("collapsed");
  });
}

if (mobileSidebarOpen && sidebar) {
  mobileSidebarOpen.addEventListener("click", (e) => {
    e.stopPropagation();

    // Abrir sidebar
    sidebar.classList.remove("collapsed");

    // 🔥 Cerrar corner container si está abierto
    if (profileMenuOpen) {
      closeCornerMenu();
    }
  });
}

// 🔒 Bloquear zoom en mobile
document.addEventListener('touchmove', function (e) {
  if (e.scale !== 1) {
    e.preventDefault();
  }
}, { passive: false });

document.addEventListener('gesturestart', function (e) {
  e.preventDefault();
});

setInterval(() => {
  updateSubtitle(currentUser);
}, 600000); // cada 10 minutos

const modeBtn = document.getElementById("modeToggle");

const modeBtnMobile = document.getElementById("modeToggleMobile");

if(modeBtnMobile){
  modeBtnMobile.addEventListener("click", ()=>{
    modeBtn.click();
  });
}

updateModeIcon();

modeBtn.addEventListener("click", async () => {

  document.documentElement.classList.toggle("light-mode");

  const isLight = document.documentElement.classList.contains("light-mode");
  const mobileIcon = document.getElementById("modeIconMobile");
  const mode = isLight ? "light" : "dark";

  localStorage.setItem("mt_theme_mode", mode);

  if (currentUser) {
    await setDoc(
      doc(db, "users", currentUser.uid),
      { mode },
      { merge: true }
    );
  }

  updateModeIcon();
});

function updateModeIcon() {

  const isLight = document.documentElement.classList.contains("light-mode");
  const mobileIcon = document.getElementById("modeIconMobile");

  if (isLight) {

    if(mobileIcon){
      mobileIcon.innerHTML = `
          <svg fill="currentColor" height="18px" width="18px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
             viewBox="0 0 512 512" xml:space="preserve">
          <g>
            <g>
              <path d="M504.866,323.638c-6.955-6.955-17.432-8.997-26.488-5.16c-26.922,11.402-55.473,17.185-84.861,17.185
                c-58.031,0-112.586-22.597-153.619-63.63c-62.919-62.92-81.148-156.527-46.442-238.475c3.835-9.055,1.793-19.533-5.162-26.488
                c-6.955-6.953-17.432-8.992-26.488-5.158c-31.492,13.341-59.785,32.43-84.092,56.738
                C-25.824,162.189-25.822,330.664,77.722,434.208C127.885,484.373,194.578,512,265.515,512c70.927,0,137.611-27.624,187.769-77.781
                c24.308-24.307,43.397-52.6,56.74-84.093C513.86,341.071,511.821,330.591,504.866,323.638z M419.142,400.077
                c-41.037,41.037-95.596,63.638-153.627,63.638c-58.04,0-112.607-22.604-153.651-63.649
                c-84.718-84.716-84.721-222.559-0.006-307.273c6.214-6.213,12.746-12.01,19.573-17.376c-4.941,30.18-4.637,61.147,1.041,91.716
                c9.815,52.833,35.156,100.914,73.284,139.043c50.152,50.152,116.834,77.773,187.761,77.773c14.524,0,28.883-1.157,43.014-3.459
                C431.162,387.321,425.36,393.857,419.142,400.077z"/>
            </g>
          </g>
          </svg>
        `;
    }

    modeBtn.innerHTML = `
      <svg fill="currentColor" height="800px" width="800px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
         viewBox="0 0 512 512" xml:space="preserve">
      <g>
        <g>
          <path d="M504.866,323.638c-6.955-6.955-17.432-8.997-26.488-5.16c-26.922,11.402-55.473,17.185-84.861,17.185
            c-58.031,0-112.586-22.597-153.619-63.63c-62.919-62.92-81.148-156.527-46.442-238.475c3.835-9.055,1.793-19.533-5.162-26.488
            c-6.955-6.953-17.432-8.992-26.488-5.158c-31.492,13.341-59.785,32.43-84.092,56.738
            C-25.824,162.189-25.822,330.664,77.722,434.208C127.885,484.373,194.578,512,265.515,512c70.927,0,137.611-27.624,187.769-77.781
            c24.308-24.307,43.397-52.6,56.74-84.093C513.86,341.071,511.821,330.591,504.866,323.638z M419.142,400.077
            c-41.037,41.037-95.596,63.638-153.627,63.638c-58.04,0-112.607-22.604-153.651-63.649
            c-84.718-84.716-84.721-222.559-0.006-307.273c6.214-6.213,12.746-12.01,19.573-17.376c-4.941,30.18-4.637,61.147,1.041,91.716
            c9.815,52.833,35.156,100.914,73.284,139.043c50.152,50.152,116.834,77.773,187.761,77.773c14.524,0,28.883-1.157,43.014-3.459
            C431.162,387.321,425.36,393.857,419.142,400.077z"/>
        </g>
      </g>
      </svg>
    `;
  } else {

    if(mobileIcon){
      mobileIcon.innerHTML = `
          <svg fill="currentColor" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
             width="18px" height="18px" viewBox="0 0 475.465 475.465"
             xml:space="preserve">
          <g>
            <g>
              <path d="M320.535,320.229c10.701-10.701,19.107-23.173,24.986-37.071c6.095-14.411,9.186-29.694,9.186-45.426
                c0-15.732-3.091-31.015-9.186-45.426c-5.879-13.898-14.285-26.371-24.986-37.071c-10.7-10.701-23.173-19.107-37.071-24.986
                c-14.411-6.095-29.694-9.186-45.426-9.186c-15.73,0-31.014,3.091-45.425,9.186c-13.898,5.878-26.371,14.285-37.071,24.986
                c-10.701,10.701-19.107,23.173-24.985,37.071c-6.096,14.411-9.186,29.695-9.186,45.426c0,15.731,3.09,31.015,9.186,45.426
                c5.878,13.898,14.285,26.37,24.985,37.071s23.173,19.107,37.071,24.985c14.412,6.096,29.695,9.187,45.425,9.187
                c15.732,0,31.015-3.091,45.426-9.187C297.362,339.337,309.835,330.931,320.535,320.229z M238.038,163.903
                c40.776,0,73.83,33.054,73.83,73.829c0,40.774-33.054,73.829-73.83,73.829c-40.774,0-73.828-33.055-73.828-73.829
                C164.209,196.958,197.264,163.903,238.038,163.903z"/>
              <path d="M238.038,354.901c-15.797,0-31.146-3.104-45.62-9.226c-13.958-5.903-26.484-14.346-37.23-25.093
                c-10.747-10.747-19.189-23.273-25.092-37.23c-6.122-14.472-9.226-29.821-9.226-45.62c0-15.799,3.104-31.148,9.226-45.621
                c5.904-13.958,14.346-26.484,25.092-37.23c10.746-10.747,23.272-19.189,37.23-25.093c14.474-6.122,29.823-9.226,45.62-9.226
                c15.798,0,31.148,3.104,45.621,9.226c13.959,5.904,26.485,14.346,37.23,25.093c10.746,10.746,19.188,23.271,25.094,37.23
                c6.121,14.474,9.225,29.822,9.225,45.621c0,15.798-3.104,31.146-9.225,45.62c-5.904,13.958-14.347,26.483-25.094,37.23
                c-10.746,10.747-23.271,19.189-37.23,25.093C269.186,351.797,253.836,354.901,238.038,354.901z M238.038,121.563
                c-15.663,0-30.88,3.077-45.23,9.146c-13.839,5.854-26.258,14.224-36.913,24.879s-19.025,23.074-24.878,36.913
                c-6.069,14.349-9.146,29.566-9.146,45.231c0,15.665,3.077,30.883,9.146,45.231c5.853,13.837,14.223,26.256,24.878,36.912
                c10.655,10.655,23.074,19.025,36.913,24.878c14.35,6.07,29.567,9.147,45.23,9.147c15.665,0,30.882-3.077,45.232-9.147
                c13.839-5.853,26.258-14.223,36.912-24.878c10.655-10.655,19.026-23.074,24.879-36.912c6.069-14.351,9.146-29.568,9.146-45.231
                c0-15.664-3.077-30.881-9.146-45.231c-5.854-13.839-14.225-26.258-24.879-36.913c-10.654-10.655-23.073-19.025-36.912-24.879
                C268.92,124.641,253.701,121.563,238.038,121.563z M238.038,312.062c-40.985,0-74.328-33.344-74.328-74.329
                s33.343-74.329,74.328-74.329c40.986,0,74.33,33.344,74.33,74.329S279.023,312.062,238.038,312.062z M238.038,164.403
                c-40.433,0-73.328,32.896-73.328,73.329s32.895,73.329,73.328,73.329c40.434,0,73.33-32.896,73.33-73.329
                S278.472,164.403,238.038,164.403z"/>
            </g>
            <g>
              <path d="M238.705,377.589c-11.798,0-21.381,9.546-21.419,21.354l-0.17,54.535c-0.038,11.83,9.523,21.449,21.353,21.486
                c0.023,0,0.045,0,0.068,0c11.799,0,21.382-9.546,21.419-21.354l0.171-54.535c0.037-11.83-9.523-21.45-21.354-21.486
                C238.75,377.589,238.727,377.589,238.705,377.589z"/>
              <path d="M238.537,475.464h-0.068c-5.857-0.019-11.354-2.315-15.481-6.469c-4.127-4.152-6.39-9.664-6.372-15.52l0.17-54.535
                c0.039-12.049,9.871-21.852,21.919-21.852c5.925,0.018,11.423,2.314,15.55,6.468c4.128,4.153,6.391,9.665,6.372,15.521
                l-0.171,54.535C260.418,465.661,250.585,475.464,238.537,475.464z M238.771,378.089c-11.565,0-20.949,9.355-20.986,20.855
                l-0.17,54.535c-0.018,5.588,2.142,10.848,6.081,14.812c3.939,3.963,9.186,6.155,14.774,6.173l0.067,0.5v-0.5
                c11.499,0,20.883-9.355,20.919-20.855l0.171-54.535c0.018-5.588-2.143-10.848-6.081-14.812
                C249.606,380.298,244.359,378.105,238.771,378.089z"/>
            </g>
            <g>
              <path d="M237.366,97.876c0.058,0,0.118,0,0.177,0c11.83-0.096,21.341-9.763,21.247-21.593l-0.441-54.535
                c-0.096-11.83-9.75-21.33-21.593-21.246c-11.83,0.096-21.342,9.763-21.246,21.592l0.441,54.536
                C216.046,88.401,225.616,97.876,237.366,97.876z"/>
              <path d="M237.366,98.376c-11.987,0-21.818-9.753-21.916-21.743l-0.441-54.536c-0.047-5.854,2.188-11.377,6.294-15.551
                s9.593-6.498,15.448-6.545l0.16,0c11.999,0,21.841,9.753,21.938,21.743l0.441,54.535c0.097,12.086-9.657,21.999-21.743,22.097
                L237.366,98.376z M236.911,1.001l-0.152,0c-5.587,0.045-10.823,2.264-14.742,6.247c-3.919,3.983-6.053,9.254-6.007,14.842
                l0.441,54.536c0.093,11.442,9.476,20.75,20.916,20.75l0.173,0c11.534-0.094,20.843-9.554,20.75-21.089l-0.441-54.535
                C257.756,10.31,248.363,1.001,236.911,1.001z"/>
            </g>
            <g>
              <path d="M21.919,217.116c-11.798,0-21.381,9.546-21.419,21.353c-0.037,11.831,9.523,21.45,21.354,21.487l54.535,0.171
                c0.023,0,0.045,0,0.068,0c11.798,0,21.382-9.547,21.419-21.354c0.038-11.83-9.523-21.45-21.353-21.487l-54.536-0.171
                C21.964,217.116,21.942,217.116,21.919,217.116z"/>
              <path d="M76.457,260.627h-0.068l-54.537-0.171C9.765,260.418-0.038,250.554,0,238.467c0.039-12.048,9.871-21.851,21.919-21.851
                l54.605,0.171c5.855,0.018,11.353,2.315,15.48,6.468c4.127,4.153,6.39,9.665,6.372,15.521
                C98.338,250.824,88.505,260.627,76.457,260.627z M21.986,217.616c-11.565,0-20.949,9.355-20.986,20.855
                c-0.036,11.535,9.319,20.949,20.855,20.985l54.535,0.171l0.067,0.5v-0.5c11.499,0,20.883-9.355,20.919-20.855
                c0.018-5.587-2.142-10.848-6.081-14.812c-3.939-3.964-9.186-6.156-14.773-6.173L21.986,217.616z"/>
            </g>
            <g>
              <path d="M474.964,236.755c-0.096-11.771-9.666-21.247-21.416-21.247c-0.059,0-0.118,0-0.177,0.001l-54.535,0.441
                c-11.83,0.095-21.342,9.763-21.247,21.592c0.096,11.771,9.666,21.247,21.416,21.247c0.059,0,0.118,0,0.177,0l54.535-0.441
                C465.547,258.253,475.059,248.586,474.964,236.755z"/>
              <path d="M399.184,259.29h-0.179c-11.987,0-21.818-9.754-21.916-21.743c-0.097-12.086,9.657-21.999,21.743-22.096l54.716-0.442
                c11.987,0,21.818,9.754,21.916,21.743c0.097,12.086-9.657,22-21.743,22.097L399.184,259.29z M453.548,216.008l-0.169,0.001
                l-54.539,0.441c-11.534,0.093-20.844,9.553-20.751,21.088c0.093,11.442,9.476,20.751,20.916,20.751h0.175l54.533-0.441
                c11.534-0.094,20.844-9.554,20.751-21.089C474.371,225.317,464.988,216.008,453.548,216.008z"/>
            </g>
            <g>
              <path d="M85.698,412.322c5.459,0,10.92-2.074,15.098-6.227l38.684-38.441c8.391-8.339,8.434-21.901,0.095-30.292
                c-8.338-8.393-21.901-8.435-30.292-0.096l-38.684,38.442c-8.391,8.338-8.434,21.9-0.095,30.292
                C74.691,410.214,80.194,412.322,85.698,412.322z"/>
              <path d="M85.698,412.822c-5.881,0-11.403-2.297-15.548-6.469c-4.127-4.153-6.391-9.665-6.372-15.521
                c0.019-5.854,2.316-11.352,6.469-15.479l38.684-38.442c4.135-4.109,9.622-6.372,15.451-6.372c5.881,0,11.403,2.298,15.548,6.47
                c4.127,4.153,6.39,9.664,6.372,15.52c-0.019,5.855-2.316,11.353-6.469,15.479l-38.684,38.441
                C97.014,410.56,91.527,412.822,85.698,412.822z M124.381,331.54c-5.563,0-10.8,2.16-14.746,6.081l-38.684,38.442
                c-3.964,3.938-6.156,9.186-6.174,14.772c-0.018,5.589,2.142,10.849,6.081,14.812c3.957,3.981,9.227,6.174,14.839,6.174
                c5.563,0,10.8-2.16,14.746-6.081l38.684-38.441c3.964-3.939,6.156-9.186,6.174-14.773c0.017-5.588-2.142-10.849-6.081-14.812
                C135.264,333.733,129.994,331.54,124.381,331.54z"/>
            </g>
            <g>
              <path d="M366.784,138.46l38.25-38.875c8.297-8.433,8.188-21.994-0.244-30.292c-8.434-8.297-21.994-8.187-30.292,0.245
                l-38.251,38.875c-8.297,8.433-8.187,21.994,0.245,30.292c4.172,4.105,9.598,6.152,15.022,6.152
                C357.054,144.857,362.592,142.72,366.784,138.46z"/>
              <path d="M351.515,145.357c-5.788,0-11.247-2.236-15.373-6.295c-8.615-8.478-8.728-22.383-0.251-30.999l38.251-38.875
                c4.154-4.221,9.703-6.546,15.626-6.546c5.787,0,11.247,2.236,15.373,6.295c8.614,8.478,8.727,22.383,0.25,30.999l-38.25,38.875
                C362.986,143.032,357.437,145.357,351.515,145.357z M389.768,63.642c-5.652,0-10.948,2.219-14.913,6.247l-38.251,38.875
                c-8.09,8.222-7.982,21.494,0.239,29.584c3.938,3.875,9.148,6.008,14.672,6.008c5.652,0,10.948-2.219,14.913-6.247l38.25-38.875
                c8.09-8.223,7.983-21.494-0.238-29.584C400.501,65.776,395.291,63.642,389.768,63.642z"/>
            </g>
            <g>
              <path d="M123.004,145.802c5.459,0,10.92-2.074,15.098-6.227c8.391-8.338,8.434-21.901,0.095-30.292L99.755,70.6
                c-8.338-8.392-21.901-8.434-30.292-0.095c-8.391,8.338-8.434,21.901-0.095,30.292l38.441,38.683
                C111.997,143.693,117.5,145.802,123.004,145.802z"/>
              <path d="M123.004,146.302c-5.881,0-11.403-2.297-15.548-6.469L69.014,101.15c-4.127-4.153-6.391-9.665-6.372-15.521
                c0.019-5.855,2.316-11.352,6.469-15.479c4.135-4.109,9.622-6.372,15.451-6.372c5.881,0,11.403,2.297,15.548,6.469l38.441,38.684
                c4.127,4.153,6.391,9.665,6.372,15.52c-0.019,5.855-2.316,11.352-6.469,15.479C134.32,144.039,128.833,146.302,123.004,146.302z
                 M84.562,64.778c-5.563,0-10.8,2.16-14.746,6.081c-3.964,3.939-6.156,9.186-6.174,14.773s2.142,10.848,6.081,14.812l38.441,38.683
                c3.957,3.981,9.227,6.174,14.839,6.174c5.563,0,10.8-2.16,14.746-6.081c3.964-3.939,6.156-9.186,6.174-14.773
                s-2.142-10.848-6.081-14.812L99.401,70.952C95.445,66.971,90.175,64.778,84.562,64.778z"/>
            </g>
            <g>
              <path d="M375.879,405.034c4.172,4.105,9.598,6.152,15.022,6.152c5.539,0,11.077-2.137,15.269-6.396
                c8.297-8.434,8.188-21.994-0.244-30.292l-38.875-38.25c-8.433-8.298-21.993-8.187-30.291,0.245
                c-8.297,8.433-8.188,21.994,0.245,30.291L375.879,405.034z"/>
              <path d="M390.901,411.687c-5.788,0-11.247-2.236-15.373-6.296l-38.874-38.25c-8.615-8.477-8.728-22.383-0.251-30.998
                c4.154-4.222,9.704-6.546,15.627-6.546c5.786,0,11.246,2.235,15.371,6.295l38.875,38.25c8.614,8.478,8.726,22.384,0.25,30.999
                C402.373,409.362,396.824,411.687,390.901,411.687z M352.03,330.597c-5.652,0-10.949,2.219-14.914,6.247
                c-8.091,8.223-7.983,21.494,0.239,29.584l38.874,38.25c3.938,3.875,9.148,6.009,14.672,6.009c5.652,0,10.948-2.219,14.912-6.247
                c8.09-8.223,7.982-21.494-0.238-29.585l-38.875-38.25C362.763,332.73,357.553,330.597,352.03,330.597z"/>
            </g>
          </g>
          </svg>
        `;
    }

    modeBtn.innerHTML = `
      <svg fill="currentColor" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
         width="30px" height="30px" viewBox="0 0 475.465 475.465"
         xml:space="preserve">
      <g>
        <g>
          <path d="M320.535,320.229c10.701-10.701,19.107-23.173,24.986-37.071c6.095-14.411,9.186-29.694,9.186-45.426
            c0-15.732-3.091-31.015-9.186-45.426c-5.879-13.898-14.285-26.371-24.986-37.071c-10.7-10.701-23.173-19.107-37.071-24.986
            c-14.411-6.095-29.694-9.186-45.426-9.186c-15.73,0-31.014,3.091-45.425,9.186c-13.898,5.878-26.371,14.285-37.071,24.986
            c-10.701,10.701-19.107,23.173-24.985,37.071c-6.096,14.411-9.186,29.695-9.186,45.426c0,15.731,3.09,31.015,9.186,45.426
            c5.878,13.898,14.285,26.37,24.985,37.071s23.173,19.107,37.071,24.985c14.412,6.096,29.695,9.187,45.425,9.187
            c15.732,0,31.015-3.091,45.426-9.187C297.362,339.337,309.835,330.931,320.535,320.229z M238.038,163.903
            c40.776,0,73.83,33.054,73.83,73.829c0,40.774-33.054,73.829-73.83,73.829c-40.774,0-73.828-33.055-73.828-73.829
            C164.209,196.958,197.264,163.903,238.038,163.903z"/>
          <path d="M238.038,354.901c-15.797,0-31.146-3.104-45.62-9.226c-13.958-5.903-26.484-14.346-37.23-25.093
            c-10.747-10.747-19.189-23.273-25.092-37.23c-6.122-14.472-9.226-29.821-9.226-45.62c0-15.799,3.104-31.148,9.226-45.621
            c5.904-13.958,14.346-26.484,25.092-37.23c10.746-10.747,23.272-19.189,37.23-25.093c14.474-6.122,29.823-9.226,45.62-9.226
            c15.798,0,31.148,3.104,45.621,9.226c13.959,5.904,26.485,14.346,37.23,25.093c10.746,10.746,19.188,23.271,25.094,37.23
            c6.121,14.474,9.225,29.822,9.225,45.621c0,15.798-3.104,31.146-9.225,45.62c-5.904,13.958-14.347,26.483-25.094,37.23
            c-10.746,10.747-23.271,19.189-37.23,25.093C269.186,351.797,253.836,354.901,238.038,354.901z M238.038,121.563
            c-15.663,0-30.88,3.077-45.23,9.146c-13.839,5.854-26.258,14.224-36.913,24.879s-19.025,23.074-24.878,36.913
            c-6.069,14.349-9.146,29.566-9.146,45.231c0,15.665,3.077,30.883,9.146,45.231c5.853,13.837,14.223,26.256,24.878,36.912
            c10.655,10.655,23.074,19.025,36.913,24.878c14.35,6.07,29.567,9.147,45.23,9.147c15.665,0,30.882-3.077,45.232-9.147
            c13.839-5.853,26.258-14.223,36.912-24.878c10.655-10.655,19.026-23.074,24.879-36.912c6.069-14.351,9.146-29.568,9.146-45.231
            c0-15.664-3.077-30.881-9.146-45.231c-5.854-13.839-14.225-26.258-24.879-36.913c-10.654-10.655-23.073-19.025-36.912-24.879
            C268.92,124.641,253.701,121.563,238.038,121.563z M238.038,312.062c-40.985,0-74.328-33.344-74.328-74.329
            s33.343-74.329,74.328-74.329c40.986,0,74.33,33.344,74.33,74.329S279.023,312.062,238.038,312.062z M238.038,164.403
            c-40.433,0-73.328,32.896-73.328,73.329s32.895,73.329,73.328,73.329c40.434,0,73.33-32.896,73.33-73.329
            S278.472,164.403,238.038,164.403z"/>
        </g>
        <g>
          <path d="M238.705,377.589c-11.798,0-21.381,9.546-21.419,21.354l-0.17,54.535c-0.038,11.83,9.523,21.449,21.353,21.486
            c0.023,0,0.045,0,0.068,0c11.799,0,21.382-9.546,21.419-21.354l0.171-54.535c0.037-11.83-9.523-21.45-21.354-21.486
            C238.75,377.589,238.727,377.589,238.705,377.589z"/>
          <path d="M238.537,475.464h-0.068c-5.857-0.019-11.354-2.315-15.481-6.469c-4.127-4.152-6.39-9.664-6.372-15.52l0.17-54.535
            c0.039-12.049,9.871-21.852,21.919-21.852c5.925,0.018,11.423,2.314,15.55,6.468c4.128,4.153,6.391,9.665,6.372,15.521
            l-0.171,54.535C260.418,465.661,250.585,475.464,238.537,475.464z M238.771,378.089c-11.565,0-20.949,9.355-20.986,20.855
            l-0.17,54.535c-0.018,5.588,2.142,10.848,6.081,14.812c3.939,3.963,9.186,6.155,14.774,6.173l0.067,0.5v-0.5
            c11.499,0,20.883-9.355,20.919-20.855l0.171-54.535c0.018-5.588-2.143-10.848-6.081-14.812
            C249.606,380.298,244.359,378.105,238.771,378.089z"/>
        </g>
        <g>
          <path d="M237.366,97.876c0.058,0,0.118,0,0.177,0c11.83-0.096,21.341-9.763,21.247-21.593l-0.441-54.535
            c-0.096-11.83-9.75-21.33-21.593-21.246c-11.83,0.096-21.342,9.763-21.246,21.592l0.441,54.536
            C216.046,88.401,225.616,97.876,237.366,97.876z"/>
          <path d="M237.366,98.376c-11.987,0-21.818-9.753-21.916-21.743l-0.441-54.536c-0.047-5.854,2.188-11.377,6.294-15.551
            s9.593-6.498,15.448-6.545l0.16,0c11.999,0,21.841,9.753,21.938,21.743l0.441,54.535c0.097,12.086-9.657,21.999-21.743,22.097
            L237.366,98.376z M236.911,1.001l-0.152,0c-5.587,0.045-10.823,2.264-14.742,6.247c-3.919,3.983-6.053,9.254-6.007,14.842
            l0.441,54.536c0.093,11.442,9.476,20.75,20.916,20.75l0.173,0c11.534-0.094,20.843-9.554,20.75-21.089l-0.441-54.535
            C257.756,10.31,248.363,1.001,236.911,1.001z"/>
        </g>
        <g>
          <path d="M21.919,217.116c-11.798,0-21.381,9.546-21.419,21.353c-0.037,11.831,9.523,21.45,21.354,21.487l54.535,0.171
            c0.023,0,0.045,0,0.068,0c11.798,0,21.382-9.547,21.419-21.354c0.038-11.83-9.523-21.45-21.353-21.487l-54.536-0.171
            C21.964,217.116,21.942,217.116,21.919,217.116z"/>
          <path d="M76.457,260.627h-0.068l-54.537-0.171C9.765,260.418-0.038,250.554,0,238.467c0.039-12.048,9.871-21.851,21.919-21.851
            l54.605,0.171c5.855,0.018,11.353,2.315,15.48,6.468c4.127,4.153,6.39,9.665,6.372,15.521
            C98.338,250.824,88.505,260.627,76.457,260.627z M21.986,217.616c-11.565,0-20.949,9.355-20.986,20.855
            c-0.036,11.535,9.319,20.949,20.855,20.985l54.535,0.171l0.067,0.5v-0.5c11.499,0,20.883-9.355,20.919-20.855
            c0.018-5.587-2.142-10.848-6.081-14.812c-3.939-3.964-9.186-6.156-14.773-6.173L21.986,217.616z"/>
        </g>
        <g>
          <path d="M474.964,236.755c-0.096-11.771-9.666-21.247-21.416-21.247c-0.059,0-0.118,0-0.177,0.001l-54.535,0.441
            c-11.83,0.095-21.342,9.763-21.247,21.592c0.096,11.771,9.666,21.247,21.416,21.247c0.059,0,0.118,0,0.177,0l54.535-0.441
            C465.547,258.253,475.059,248.586,474.964,236.755z"/>
          <path d="M399.184,259.29h-0.179c-11.987,0-21.818-9.754-21.916-21.743c-0.097-12.086,9.657-21.999,21.743-22.096l54.716-0.442
            c11.987,0,21.818,9.754,21.916,21.743c0.097,12.086-9.657,22-21.743,22.097L399.184,259.29z M453.548,216.008l-0.169,0.001
            l-54.539,0.441c-11.534,0.093-20.844,9.553-20.751,21.088c0.093,11.442,9.476,20.751,20.916,20.751h0.175l54.533-0.441
            c11.534-0.094,20.844-9.554,20.751-21.089C474.371,225.317,464.988,216.008,453.548,216.008z"/>
        </g>
        <g>
          <path d="M85.698,412.322c5.459,0,10.92-2.074,15.098-6.227l38.684-38.441c8.391-8.339,8.434-21.901,0.095-30.292
            c-8.338-8.393-21.901-8.435-30.292-0.096l-38.684,38.442c-8.391,8.338-8.434,21.9-0.095,30.292
            C74.691,410.214,80.194,412.322,85.698,412.322z"/>
          <path d="M85.698,412.822c-5.881,0-11.403-2.297-15.548-6.469c-4.127-4.153-6.391-9.665-6.372-15.521
            c0.019-5.854,2.316-11.352,6.469-15.479l38.684-38.442c4.135-4.109,9.622-6.372,15.451-6.372c5.881,0,11.403,2.298,15.548,6.47
            c4.127,4.153,6.39,9.664,6.372,15.52c-0.019,5.855-2.316,11.353-6.469,15.479l-38.684,38.441
            C97.014,410.56,91.527,412.822,85.698,412.822z M124.381,331.54c-5.563,0-10.8,2.16-14.746,6.081l-38.684,38.442
            c-3.964,3.938-6.156,9.186-6.174,14.772c-0.018,5.589,2.142,10.849,6.081,14.812c3.957,3.981,9.227,6.174,14.839,6.174
            c5.563,0,10.8-2.16,14.746-6.081l38.684-38.441c3.964-3.939,6.156-9.186,6.174-14.773c0.017-5.588-2.142-10.849-6.081-14.812
            C135.264,333.733,129.994,331.54,124.381,331.54z"/>
        </g>
        <g>
          <path d="M366.784,138.46l38.25-38.875c8.297-8.433,8.188-21.994-0.244-30.292c-8.434-8.297-21.994-8.187-30.292,0.245
            l-38.251,38.875c-8.297,8.433-8.187,21.994,0.245,30.292c4.172,4.105,9.598,6.152,15.022,6.152
            C357.054,144.857,362.592,142.72,366.784,138.46z"/>
          <path d="M351.515,145.357c-5.788,0-11.247-2.236-15.373-6.295c-8.615-8.478-8.728-22.383-0.251-30.999l38.251-38.875
            c4.154-4.221,9.703-6.546,15.626-6.546c5.787,0,11.247,2.236,15.373,6.295c8.614,8.478,8.727,22.383,0.25,30.999l-38.25,38.875
            C362.986,143.032,357.437,145.357,351.515,145.357z M389.768,63.642c-5.652,0-10.948,2.219-14.913,6.247l-38.251,38.875
            c-8.09,8.222-7.982,21.494,0.239,29.584c3.938,3.875,9.148,6.008,14.672,6.008c5.652,0,10.948-2.219,14.913-6.247l38.25-38.875
            c8.09-8.223,7.983-21.494-0.238-29.584C400.501,65.776,395.291,63.642,389.768,63.642z"/>
        </g>
        <g>
          <path d="M123.004,145.802c5.459,0,10.92-2.074,15.098-6.227c8.391-8.338,8.434-21.901,0.095-30.292L99.755,70.6
            c-8.338-8.392-21.901-8.434-30.292-0.095c-8.391,8.338-8.434,21.901-0.095,30.292l38.441,38.683
            C111.997,143.693,117.5,145.802,123.004,145.802z"/>
          <path d="M123.004,146.302c-5.881,0-11.403-2.297-15.548-6.469L69.014,101.15c-4.127-4.153-6.391-9.665-6.372-15.521
            c0.019-5.855,2.316-11.352,6.469-15.479c4.135-4.109,9.622-6.372,15.451-6.372c5.881,0,11.403,2.297,15.548,6.469l38.441,38.684
            c4.127,4.153,6.391,9.665,6.372,15.52c-0.019,5.855-2.316,11.352-6.469,15.479C134.32,144.039,128.833,146.302,123.004,146.302z
             M84.562,64.778c-5.563,0-10.8,2.16-14.746,6.081c-3.964,3.939-6.156,9.186-6.174,14.773s2.142,10.848,6.081,14.812l38.441,38.683
            c3.957,3.981,9.227,6.174,14.839,6.174c5.563,0,10.8-2.16,14.746-6.081c3.964-3.939,6.156-9.186,6.174-14.773
            s-2.142-10.848-6.081-14.812L99.401,70.952C95.445,66.971,90.175,64.778,84.562,64.778z"/>
        </g>
        <g>
          <path d="M375.879,405.034c4.172,4.105,9.598,6.152,15.022,6.152c5.539,0,11.077-2.137,15.269-6.396
            c8.297-8.434,8.188-21.994-0.244-30.292l-38.875-38.25c-8.433-8.298-21.993-8.187-30.291,0.245
            c-8.297,8.433-8.188,21.994,0.245,30.291L375.879,405.034z"/>
          <path d="M390.901,411.687c-5.788,0-11.247-2.236-15.373-6.296l-38.874-38.25c-8.615-8.477-8.728-22.383-0.251-30.998
            c4.154-4.222,9.704-6.546,15.627-6.546c5.786,0,11.246,2.235,15.371,6.295l38.875,38.25c8.614,8.478,8.726,22.384,0.25,30.999
            C402.373,409.362,396.824,411.687,390.901,411.687z M352.03,330.597c-5.652,0-10.949,2.219-14.914,6.247
            c-8.091,8.223-7.983,21.494,0.239,29.584l38.874,38.25c3.938,3.875,9.148,6.009,14.672,6.009c5.652,0,10.948-2.219,14.912-6.247
            c8.09-8.223,7.982-21.494-0.238-29.585l-38.875-38.25C362.763,332.73,357.553,330.597,352.03,330.597z"/>
        </g>
      </g>
      </svg>
    `;
  }

}

function updateLevelButton(level, progress){

  const circle = document.querySelector(".level-ring-progress");
  const number = document.getElementById("levelNumber");
  if(!circle || !number) return;

  const arcLength = circle.getTotalLength();

  circle.style.strokeDasharray = arcLength;
  circle.style.strokeDashoffset =
      arcLength - (progress * arcLength);

  number.textContent = level;
}

function updateLevel(){

  let level = 0;
  let expRemaining = player.exp;

  while(true){

    const needed = getExpForLevel(level);

    if(expRemaining >= needed){
      expRemaining -= needed;
      level++;
    }else{
      break;
    }

  }

  if(level > player.level){

    player.level = level;

    const number = document.getElementById("levelNumber");

    if(number){
      number.classList.add("level-pop");

      setTimeout(()=>{
        number.classList.remove("level-pop");
      },400);
    }

    launchConfetti();
    savePlayer();
  }

  const needed = getExpForLevel(level);
  const progress = expRemaining / needed;

  updateLevelButton(level, progress);

}

async function savePlayer(){

  if(currentUser){
    await setDoc(
      doc(db, "users", currentUser.uid),
      { player },
      { merge: true }
    );

    await setDoc(
      doc(db, "leaderboard", currentUser.uid),
      {
        name: currentUser.displayName,
        photo: currentUser.photoURL,
        level: player.level,
        exp: player.exp
      },
      { merge:true }
    );

  }else{
    localStorage.setItem("mt_player", JSON.stringify(player));
  }

}

let leaderboardUnsub = null;

function openLeaderboard(){

  if(leaderboardUnsub){
    leaderboardUnsub();
  }

  const q = query(
    collection(db, "leaderboard"),
    orderBy("level", "desc"),
    orderBy("exp", "desc"),
    orderBy("name", "asc"),
    limit(30)
  );

  leaderboardUnsub = onSnapshot(q, (snapshot)=>{

    let users = [];

    snapshot.forEach(docSnap => {

      const data = docSnap.data();

      users.push({
        uid: docSnap.id,
        name: data.name || "Usuario",
        photo: data.photo || "",
        level: data.level || 0,
        exp: data.exp || 0
      });

    });

    showLeaderboardModal(users);

  });

}

function getExpForLevel(level){

  const base = 1000;
  const increment = 120;

  const value = base + (level * increment);

  // redondear a múltiplos de 50
  return Math.round(value / 50) * 50;

}

const levelButton = document.getElementById("levelButton");
const levelMenu = document.getElementById("levelMenu");

document.body.appendChild(levelMenu);

levelButton.addEventListener("click", (e)=>{

  e.stopPropagation();

  const rect = levelButton.getBoundingClientRect();

  levelMenu.style.top = rect.bottom + 12 + "px";
  levelMenu.style.left = rect.left - 170 + "px";

  levelMenu.classList.toggle("open");

  updateLevelMenu();

});

document.addEventListener("click", ()=>{
  levelMenu.classList.remove("open");
});

function updateLevelMenu(){

  let level = 0;
  let expRemaining = player.exp;

  while(true){

    const needed = getExpForLevel(level);

    if(expRemaining >= needed){
      expRemaining -= needed;
      level++;
    }else{
      break;
    }

  }

  const needed = getExpForLevel(level);

  const percent = (expRemaining / needed) * 100;

  document.getElementById("levelProgressFill").style.width =
      percent + "%";

  document.getElementById("levelProgressText").textContent =
      `${expRemaining} / ${needed} EXP`;

}

const leaderboardFromLevelBtn =
  document.getElementById("openLeaderboardFromLevel");

if(leaderboardFromLevelBtn){

  leaderboardFromLevelBtn.addEventListener("click",(e)=>{

    e.stopPropagation();

    levelMenu.classList.remove("open");

    openLeaderboard();

  });

}

window.mt = {

  async projects(){

    currentViewMode = "projects";
    localStorage.setItem("mt_view_mode", currentViewMode);

    if (currentUser) {
      await setDoc(
        doc(db, "users", currentUser.uid),
        { viewMode: currentViewMode },
        { merge: true }
      );
    }

    init();
  },

  async tasks(){

    currentViewMode = "tasks";
    localStorage.setItem("mt_view_mode", currentViewMode);

    if (currentUser) {
      await setDoc(
        doc(db, "users", currentUser.uid),
        { viewMode: currentViewMode },
        { merge: true }
      );
    }

    init();
  }

};


document.documentElement.classList.remove("pre-collapsed");