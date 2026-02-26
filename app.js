const board = document.getElementById("board");
const statusText = document.getElementById("statusText");


const DAYS = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const storeKey = "blitzit_tasks";

let tasks = JSON.parse(localStorage.getItem(storeKey)) || {};

let soundEnabled = JSON.parse(localStorage.getItem("soundEnabled"));
if (soundEnabled === null) soundEnabled = true;

function save() {
  localStorage.setItem(storeKey, JSON.stringify(tasks));
}

function createDayColumn(date) {
  const dayIndex = date.getDay();
  const iso = date.toISOString().slice(0,10);
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

        <div class="progress">
          <div class="progress-bar"></div>
        </div>

      </div>
      <span class="pill ${isToday(date) ? "today" : ""}">
        ${isToday(date) ? "Hoy" : ""}
      </span>
    </div>

    <div class="list"></div>

    <div class="adder">
      <input class="input" placeholder="Nueva tarea…" />
    </div>
  `;

  const list = col.querySelector(".list");
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
      el.addEventListener("drop", e => {
        e.preventDefault();

        const raw = e.dataTransfer.getData("text/plain");
        if (!raw) return;

        const data = JSON.parse(raw);
        if (!tasks[data.fromDate]) return;

        const originList = tasks[data.fromDate];
        const movedTask = originList[data.index];
        if (!movedTask) return;

        // eliminar del origen
        originList.splice(data.index, 1);

        let insertIndex = i;

        // si viene del mismo día y estaba arriba
        if (data.fromDate === iso && data.index < i) {
          insertIndex--;
        }

        tasks[iso].splice(insertIndex, 0, movedTask);

        save();
        init();
      });
      el.addEventListener("dragover", e => {
          e.preventDefault();
          el.style.borderColor = "rgba(139,92,246,.6)";
        });

        el.addEventListener("dragleave", () => {
          el.style.borderColor = "";
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
        }

        function cancelEdit() {
          render();
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
        e.dataTransfer.setData("text/plain", JSON.stringify({
          fromDate: iso,
          index: i
        }));
        el.style.opacity = "0.4";
      });

      el.addEventListener("dragend", () => {
        el.style.opacity = "1";
      });

      el.querySelector(".cb").onclick = () => {
        const wasDone = t.done;

        t.done = !t.done;
        save();
        render();

        // Si se acaba de completar (no desmarcar)
        if (!wasDone && t.done) {
          setTimeout(() => {
            const tasksEls = col.querySelectorAll(".task");
            const last = tasksEls[i];
            if (last) {
              last.classList.add("reward");
            }
            if (soundEnabled) {
              playRewardSound();
            }
          }, 0);
        }
      };

      el.querySelector("button").onclick = e => {
        e.stopPropagation();
        tasks[iso].splice(i,1);
        save(); render();
      };

      list.appendChild(el);
    });

    list.addEventListener("dragover", e => {
      e.preventDefault();
    });

    list.addEventListener("drop", e => {
      e.preventDefault();

      const raw = e.dataTransfer.getData("text/plain");
      if (!raw) return;

      const data = JSON.parse(raw);
      if (!tasks[data.fromDate]) return;

      const originList = tasks[data.fromDate];
      const movedTask = originList[data.index];
      if (!movedTask) return;

      // eliminar del origen
      originList.splice(data.index, 1);

      // insertar al final
      tasks[iso].push(movedTask);

      save();
      init();
    });

    const total = tasks[iso].length;
    const completed = tasks[iso].filter(t => t.done).length;

    let percent = 0;
    if (total > 0) {
      percent = (completed / total) * 100;
    }

    progressBar.style.width = percent + "%";
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
  carryOverPendings();
  
  board.innerHTML = "";
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(today.getDate() + i);
    board.appendChild(createDayColumn(d));
  }
  statusText.textContent = "Listo · tareas guardadas localmente";
}

function playRewardSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, ctx.currentTime); // tono agudo
  oscillator.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);

  gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.25);
}

const soundToggle = document.getElementById("soundToggle");
const soundIcon = document.getElementById("soundIcon");

updateSoundIcon();

soundToggle.addEventListener("click", () => {
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
  const today = new Date().toISOString().slice(0,10);

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

  save();
}

function renderMiniCalendar() {
  const container = document.getElementById("miniCalendar");
  if (!container) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let startDay = firstDay.getDay();

  // Convertir para que la semana empiece en Lunes
  startDay = (startDay === 0) ? 6 : startDay - 1;
  const totalDays = lastDay.getDate();

  const monthName = now.toLocaleDateString("es-ES", { month: "long" });
  const monthTitle =
    monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const weekdays = ["L","M","M","J","V","S","D"];

  let html = `
    <div class="month-title">${monthTitle} ${year}</div>
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

  // días del mes actual
  for (let d = 1; d <= totalDays; d++) {
    const isToday =
      d === now.getDate();

    html += `
      <div class="day ${isToday ? "today" : ""}">
        ${d}
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
}

renderMiniCalendar();

init();