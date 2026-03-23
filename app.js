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
  limit,
  updateDoc
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
const profileLogoutBtn = document.getElementById("profileLogoutBtn");
const loginTooltip = document.getElementById("loginTooltip");
const authGate = document.getElementById("authGate");
const authGateGoogleBtn = document.getElementById("authGateGoogleBtn");
let tooltipTimeout = null;
const logoutOverlay = document.getElementById("logoutOverlay");
const cancelLogout = document.getElementById("cancelLogout");
const confirmLogout = document.getElementById("confirmLogout");

let currentUser = null;
let unsubscribe = null;
let currentCalendarDate = new Date();
let lastCarryDate = null;
let tasks = {};
let projects = {};
let projectOrder = [];
let taskLabels = [];
let currentViewMode = localStorage.getItem("mt_view_mode") || "tasks";
const storeKey = "mt_tasks_local";
const DAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado"
];
const TASK_TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});
const TASK_LABEL_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899"
];

const ACHIEVEMENTS = [
  {
    id: "mate_metodo",
    name: "Mate y método",
    desc: "Completá 3 tareas en total",
    exp: 120,
    check: (stats) => stats.completedTasks >= 3
  },
  {
    id: "bautismo_proyecto",
    name: "Bautismo de proyecto",
    desc: "Creá un proyecto",
    exp: 160,
    check: (stats) => stats.projectsCount >= 1
  },
  {
    id: "dia_redondo",
    name: "Día redondo",
    desc: "Completá todas las tareas del día",
    exp: 180,
    check: (stats) => stats.todayAllDone
  },
  {
    id: "trilogia_dia",
    name: "Trilogía del día",
    desc: "Completá todas las tareas del día durante 3 días consecutivos",
    exp: 380,
    check: () => player.allTasksStreak >= 3
  },
  {
    id: "racha_multitareas",
    name: "Racha multitareas",
    desc: "Obtené una racha de 3 días usando MultiTareas por 3 días consecutivos",
    exp: 260,
    check: () => player.activeStreak >= 3
  },
  {
    id: "quinto_escalon",
    name: "Quinto escalón",
    desc: "Alcanzá el nivel 5",
    exp: 300,
    check: () => player.level >= 5
  },
  {
    id: "diez_a_fondo",
    name: "Diez a fondo",
    desc: "Completá 10 tareas en total",
    exp: 220,
    check: (stats) => stats.completedTasks >= 10
  },
  {
    id: "barrio_proyectos",
    name: "Barrio de proyectos",
    desc: "Creá 3 proyectos",
    exp: 240,
    check: (stats) => stats.projectsCount >= 3
  },
  {
    id: "agenda_fina",
    name: "Agenda fina",
    desc: "Programá 3 tareas con horario",
    exp: 200,
    check: (stats) => stats.scheduledTasks >= 3
  }
];

const ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map((achievement) => achievement.id));

let draggedElement = null;
let currentTarget = null;
let currentPosition = null;
let previewInsertIndex = null;
let draggedProjectId = null;
let draggedProjectElement = null;
let projectDragActive = false;
let mobileTaskReorderMode = false;
let activeMobileDropList = null;
let mobileActiveDropTarget = null;
let mobileTouchDragGhost = null;
let mobileTouchDragOffsetX = 0;
let mobileTouchDragOffsetY = 0;

let officeModeEnabled = false;
let officeModeTimeoutSeconds = 60;
let inactivityTimer = null;
let isLocked = false;
let securityPinHash = "";
let legacySecurityPin = "";

const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
const MOBILE_BREAKPOINT = 900;
const MOBILE_TASK_LONG_PRESS_MS = 420;
const MOBILE_TASK_MOVE_TOLERANCE = 12;
const MOBILE_TASK_FOCUS_KEYBOARD_DELAY_MS = 160;
const MOBILE_DRAG_AUTOSCROLL_EDGE_PX = 72;
const MOBILE_DRAG_AUTOSCROLL_MAX_SPEED = 16;
const MOBILE_DRAG_PREVIEW_STICKY_TOP = 0.38;
const MOBILE_DRAG_PREVIEW_STICKY_BOTTOM = 0.62;
const OFFICE_MODE_LOCK_STORAGE_KEY = "mt_office_mode_locked";
const TASK_NOTIFICATION_SETTINGS_STORAGE_KEY = "mt_task_notifications_enabled";
const TASK_NOTIFICATION_LEAD_MS = 30 * 60 * 1000;
const MAX_SCHEDULE_TIMEOUT_MS = 2147483647;

let taskNotificationsEnabled = true;
try {
  const storedTaskNotifications = JSON.parse(
    localStorage.getItem(TASK_NOTIFICATION_SETTINGS_STORAGE_KEY)
  );
  if (typeof storedTaskNotifications === "boolean") {
    taskNotificationsEnabled = storedTaskNotifications;
  }
} catch (err) {
  console.error(err);
}

let activeTaskMobileFocus = null;
let activeTaskActionMenu = null;
let mobileTaskReorderBanner = null;
let mobileDragAutoScrollRaf = null;
let mobileDragAutoScrollSpeed = 0;
let mobileDragAutoScrollTouch = null;
let mobileDragAutoScrollCallback = null;
let mobileFocusScrollSnapshot = null;
const scheduledTaskNotificationTimers = new Map();
let taskNotificationAutoPromptAttempted = false;

function closeTaskActionMenu() {
  if (!activeTaskActionMenu) return;

  activeTaskActionMenu.anchorElement?.classList.remove("open");
  activeTaskActionMenu.anchorElement?.classList.remove("open-upwards");
  activeTaskActionMenu.anchorElement?.classList.remove("schedule-open");
  activeTaskActionMenu.anchorElement?.classList.remove("tag-open");
  activeTaskActionMenu.anchorElement?.classList.remove("tag-create-open");
  activeTaskActionMenu.anchorElement?.classList.remove("postpone-open");
  activeTaskActionMenu.taskElement?.classList.remove("menu-open");
  activeTaskActionMenu.hostColumn?.classList.remove("task-focus-host");
  activeTaskActionMenu.overlayElement?.remove();
  document.body.classList.remove("task-action-focus");
  activeTaskActionMenu = null;
}

function positionTaskActionMenu(anchorElement) {
  const menuElement = anchorElement?.querySelector(".task-menu-stack");
  if (!menuElement) return;

  const taskElement = anchorElement.closest(".task");
  const taskRect = taskElement?.getBoundingClientRect();
  anchorElement.classList.remove("open-upwards");
  anchorElement.classList.remove("side-open-left");

  const anchorRect = anchorElement.getBoundingClientRect();
  const menuHeight = menuElement.offsetHeight;
  const gap = 16;
  const viewportPadding = 24;

  if (taskRect) {
    const belowOffset = Math.max(gap, Math.round(taskRect.bottom - anchorRect.top) + gap);
    const aboveOffset = Math.max(gap, Math.round(anchorRect.bottom - taskRect.top) + gap);
    anchorElement.style.setProperty("--task-menu-below-offset", `${belowOffset}px`);
    anchorElement.style.setProperty("--task-menu-above-offset", `${aboveOffset}px`);
  } else {
    anchorElement.style.removeProperty("--task-menu-below-offset");
    anchorElement.style.removeProperty("--task-menu-above-offset");
  }

  const spaceBelow = window.innerHeight - anchorRect.bottom - viewportPadding;
  const spaceAbove = anchorRect.top - viewportPadding;

  if (spaceBelow < menuHeight + gap && spaceAbove > spaceBelow) {
    anchorElement.classList.add("open-upwards");
  }

  const maxMenuSpace = anchorElement.classList.contains("open-upwards")
    ? Math.max(140, spaceAbove)
    : Math.max(140, spaceBelow);

  menuElement.style.maxHeight = `${maxMenuSpace}px`;
  menuElement.style.overflowY = "auto";

  const sidePanels = anchorElement.querySelectorAll(".task-side-panel");
  sidePanels.forEach((panel) => {
    panel.style.maxHeight = `${Math.max(160, maxMenuSpace)}px`;
    panel.style.overflowY = "auto";
  });

  if (isMobileViewport()) {
    sidePanels.forEach((panel) => {
      const panelHeight = panel.offsetHeight || 0;
      const preferBelowTop = anchorRect.bottom + 12;
      const preferAboveTop = anchorRect.top - panelHeight - 12;
      let top = preferBelowTop;

      if (top + panelHeight > window.innerHeight - viewportPadding && preferAboveTop >= viewportPadding) {
        top = preferAboveTop;
      }

      top = Math.min(
        Math.max(viewportPadding, top),
        Math.max(viewportPadding, window.innerHeight - panelHeight - viewportPadding)
      );

      panel.style.top = `${Math.round(top)}px`;
    });

    return;
  }

  const spaceRight = window.innerWidth - anchorRect.right - viewportPadding;
  const spaceLeft = anchorRect.left - viewportPadding;
  const widestPanel = 228 + 206 + 14;
  if (spaceRight < widestPanel && spaceLeft > spaceRight) {
    anchorElement.classList.add("side-open-left");
  }
}

function toggleTaskActionMenu(taskElement, anchorElement) {
  const isSameMenu =
    activeTaskActionMenu &&
    activeTaskActionMenu.anchorElement === anchorElement;

  closeTaskActionMenu();

  if (isSameMenu) return;

  const overlay = document.createElement("div");
  overlay.id = "taskActionOverlay";
  overlay.addEventListener("click", closeTaskActionMenu);
  document.body.appendChild(overlay);

  const hostColumn = taskElement.closest(".col");
  hostColumn?.classList.add("task-focus-host");
  anchorElement.classList.add("open");
  taskElement.classList.add("menu-open");
  document.body.classList.add("task-action-focus");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  taskElement?.scrollIntoView({
    block: "center",
    inline: "nearest",
    behavior: prefersReducedMotion ? "auto" : "smooth"
  });
  positionTaskActionMenu(anchorElement);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      positionTaskActionMenu(anchorElement);
    });
  });
  if (!prefersReducedMotion) {
    setTimeout(() => positionTaskActionMenu(anchorElement), 320);
  }
  activeTaskActionMenu = { taskElement, anchorElement, hostColumn, overlayElement: overlay };
}

function getStablePreviewPosition(targetIndex, percent, draggedIndex, isSameContainer) {
  const existingTarget = mobileActiveDropTarget;
  const existingIndex = existingTarget?.insertIndex;

  if (isSameContainer && targetIndex === draggedIndex + 1) {
    if (percent < MOBILE_DRAG_PREVIEW_STICKY_TOP) return null;
    return "after";
  }

  if (isSameContainer && targetIndex === draggedIndex - 1) {
    if (percent > MOBILE_DRAG_PREVIEW_STICKY_BOTTOM) return null;
    return "before";
  }

  if (percent <= MOBILE_DRAG_PREVIEW_STICKY_TOP) return "before";
  if (percent >= MOBILE_DRAG_PREVIEW_STICKY_BOTTOM) return "after";

  if (existingTarget?.taskIndex === targetIndex && existingTarget?.sameContainer === isSameContainer) {
    if (existingIndex === targetIndex) return "before";
    if (existingIndex === targetIndex + 1) return "after";
  }

  return percent < 0.5 ? "before" : "after";
}

function isMobileViewport() {
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

function isMobileTaskFocusEnabled() {
  return isTouchDevice && isMobileViewport();
}

function forceMobileRenderRefresh(renderFn) {
  if (!isMobileViewport()) return;
  requestAnimationFrame(() => {
    if (currentViewMode === "tasks") {
      init();
      return;
    }
    renderFn?.();
    renderMiniCalendar();
  });
}

function captureMobileScrollSnapshot() {
  if (!isMobileViewport()) return;
  const host = document.querySelector(".board-scroll");
  if (!host) return;
  mobileFocusScrollSnapshot = {
    host,
    top: host.scrollTop,
    left: host.scrollLeft
  };
}

function restoreMobileScrollSnapshot() {
  if (!mobileFocusScrollSnapshot) return;
  const { host, top, left } = mobileFocusScrollSnapshot;
  if (host) {
    host.scrollTop = top;
    host.scrollLeft = left;
  }
  mobileFocusScrollSnapshot = null;
}

function clearTaskMobileFocus() {
  if (activeTaskMobileFocus) {
    const { taskElement, menuElement, overlayElement, cloneElement } = activeTaskMobileFocus;

    taskElement?.classList.remove("task-mobile-focus");
    taskElement?.classList.remove("task-mobile-focus-source");
    menuElement?.remove();
    overlayElement?.remove();
    cloneElement?.remove();

    activeTaskMobileFocus = null;
  }

  // Defensive cleanup: ensure no lingering focus classes remain on tasks.
  document.querySelectorAll(".task.task-mobile-focus, .task.task-mobile-focus-source").forEach((el) => {
    el.classList.remove("task-mobile-focus");
    el.classList.remove("task-mobile-focus-source");
  });
}

function resetTransientOverlays() {
  closeTaskActionMenu();
  clearTaskMobileFocus();
  document.getElementById("taskActionOverlay")?.remove();
  document.getElementById("taskMobileOverlay")?.remove();
  document.body.classList.remove("task-action-focus");
}

function ensureAuthGateVisible() {
  if (!authGate) return;
  if (!isMobileViewport()) return;
  authGate.classList.add("open");
  authGate.style.display = "flex";
  authGate.style.pointerEvents = "auto";
  authGate.style.zIndex = "100000";
  const modal = authGate.querySelector(".modal");
  if (modal) {
    modal.style.opacity = "1";
    modal.style.transform = "none";
  }
}

function resetAuthGateStyles() {
  if (!authGate) return;
  authGate.style.display = "";
  authGate.style.pointerEvents = "";
  authGate.style.zIndex = "";
  const modal = authGate.querySelector(".modal");
  if (modal) {
    modal.style.opacity = "";
    modal.style.transform = "";
  }
}

function isMobileTaskReorderEnabled() {
  return isMobileTaskFocusEnabled() && mobileTaskReorderMode;
}

window.addEventListener("pageshow", () => {
  resetTransientOverlays();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) resetTransientOverlays();
});

function getDragOriginList(data) {
  if (data.fromProject) {
    return projects[data.fromProject]?.tasks || null;
  }

  return tasks[data.fromDate] || null;
}

function getDropTargetList(targetDate, targetProjectId) {
  if (targetProjectId) {
    return projects[targetProjectId]?.tasks || null;
  }

  if (!targetDate) return null;
  if (!tasks[targetDate]) tasks[targetDate] = [];
  return tasks[targetDate];
}

function canDropTaskInTarget(data, targetDate, targetProjectId) {
  const sourceIsProject = !!data.fromProject;
  const targetIsProject = !!targetProjectId;

  if (sourceIsProject || targetIsProject) {
    return sourceIsProject && targetIsProject && data.fromProject === targetProjectId;
  }

  return !!targetDate;
}

function moveTaskToTarget(data, targetDate, targetProjectId, insertIndex = null) {
  if (!canDropTaskInTarget(data, targetDate, targetProjectId)) return false;

  const originList = getDragOriginList(data);
  const targetList = getDropTargetList(targetDate, targetProjectId);

  if (!originList || !targetList) return false;

  const movedTask = originList[data.index];
  if (!movedTask) return false;

  originList.splice(data.index, 1);

  let safeInsertIndex = insertIndex;
  if (safeInsertIndex === null || safeInsertIndex === undefined) {
    safeInsertIndex = targetList.length;
  }

  const sameProjectTarget = !!targetProjectId && data.fromProject === targetProjectId;
  const sameDateTarget = !!targetDate && data.fromDate === targetDate;

  if ((sameProjectTarget || sameDateTarget) && data.index < safeInsertIndex) {
    safeInsertIndex--;
  }

  safeInsertIndex = Math.max(0, Math.min(safeInsertIndex, targetList.length));
  targetList.splice(safeInsertIndex, 0, movedTask);

  return true;
}

function removeActiveMobileDropIndicator(resetState = true) {
  if (activeMobileDropList?._removeIndicator) {
    activeMobileDropList._removeIndicator(resetState);
  }
  activeMobileDropList = null;
  mobileActiveDropTarget = null;
  previewInsertIndex = null;
}

function clearMobileTouchDragGhost() {
  mobileTouchDragGhost?.remove();
  mobileTouchDragGhost = null;
}

function createMobileTouchDragGhost(taskElement, touch) {
  clearMobileTouchDragGhost();

  const rect = taskElement.getBoundingClientRect();
  mobileTouchDragOffsetX = touch.clientX - rect.left;
  mobileTouchDragOffsetY = touch.clientY - rect.top;

  const ghost = taskElement.cloneNode(true);
  ghost.id = "mobileTaskDragGhost";
  ghost.classList.add("mobile-task-drag-ghost");
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  document.body.appendChild(ghost);

  mobileTouchDragGhost = ghost;
  updateMobileTouchDragGhostPosition(touch);
}

function updateMobileTouchDragGhostPosition(touch) {
  if (!mobileTouchDragGhost) return;

  mobileTouchDragGhost.style.left = `${touch.clientX - mobileTouchDragOffsetX}px`;
  mobileTouchDragGhost.style.top = `${touch.clientY - mobileTouchDragOffsetY}px`;
}

function getBoardScrollContainer() {
  return document.querySelector(".board-scroll");
}

function stopMobileDragAutoscroll() {
  if (mobileDragAutoScrollRaf) {
    cancelAnimationFrame(mobileDragAutoScrollRaf);
    mobileDragAutoScrollRaf = null;
  }

  mobileDragAutoScrollSpeed = 0;
  mobileDragAutoScrollTouch = null;
  mobileDragAutoScrollCallback = null;
}

function runMobileDragAutoscroll() {
  const container = getBoardScrollContainer();

  if (!container || !mobileDragAutoScrollSpeed) {
    stopMobileDragAutoscroll();
    return;
  }

  container.scrollBy({
    top: mobileDragAutoScrollSpeed,
    behavior: "auto"
  });

  if (mobileDragAutoScrollTouch && typeof mobileDragAutoScrollCallback === "function") {
    mobileDragAutoScrollCallback(mobileDragAutoScrollTouch);
  }

  mobileDragAutoScrollRaf = requestAnimationFrame(runMobileDragAutoscroll);
}

function updateMobileDragAutoscroll(touch, onScroll) {
  const container = getBoardScrollContainer();
  if (!container) return;

  const rect = container.getBoundingClientRect();
  let speed = 0;

  if (touch.clientY < rect.top + MOBILE_DRAG_AUTOSCROLL_EDGE_PX) {
    const intensity = (rect.top + MOBILE_DRAG_AUTOSCROLL_EDGE_PX - touch.clientY) / MOBILE_DRAG_AUTOSCROLL_EDGE_PX;
    speed = -Math.ceil(MOBILE_DRAG_AUTOSCROLL_MAX_SPEED * Math.min(intensity, 1));
  } else if (touch.clientY > rect.bottom - MOBILE_DRAG_AUTOSCROLL_EDGE_PX) {
    const intensity = (touch.clientY - (rect.bottom - MOBILE_DRAG_AUTOSCROLL_EDGE_PX)) / MOBILE_DRAG_AUTOSCROLL_EDGE_PX;
    speed = Math.ceil(MOBILE_DRAG_AUTOSCROLL_MAX_SPEED * Math.min(intensity, 1));
  }

  mobileDragAutoScrollTouch = {
    clientX: touch.clientX,
    clientY: touch.clientY
  };
  mobileDragAutoScrollCallback = onScroll;

  if (!speed) {
    stopMobileDragAutoscroll();
    return;
  }

  mobileDragAutoScrollSpeed = speed;

  if (!mobileDragAutoScrollRaf) {
    mobileDragAutoScrollRaf = requestAnimationFrame(runMobileDragAutoscroll);
  }
}

function removeMobileTaskReorderBanner() {
  mobileTaskReorderBanner?.remove();
  mobileTaskReorderBanner = null;
}

function updateMobileTaskReorderBanner() {
  removeMobileTaskReorderBanner();

  if (!isMobileTaskReorderEnabled()) return;

  const banner = document.createElement("div");
  banner.id = "taskReorderBanner";
  banner.textContent = "Cambia el orden de tus tareas";
  banner.addEventListener("click", () => {
    setMobileTaskReorderMode(false);
  });
  banner.addEventListener("touchstart", (e) => {
    e.stopPropagation();
  });
  document.body.appendChild(banner);

  requestAnimationFrame(() => {
    banner.classList.add("visible");
  });

  mobileTaskReorderBanner = banner;
}

function setMobileTaskReorderMode(enabled) {
  mobileTaskReorderMode = enabled;
  document.body.classList.toggle("mobile-task-reorder-mode", enabled);

  if (!enabled) {
    stopMobileDragAutoscroll();
    clearMobileTouchDragGhost();
    removeActiveMobileDropIndicator();
  }

  updateMobileTaskReorderBanner();
  init();
}

document.addEventListener("touchstart", (e) => {
  if (!isMobileTaskReorderEnabled()) return;
  if (e.target.closest(".task")) return;
  if (e.target.closest("#taskReorderBanner")) return;
  if (e.target.closest("#taskMobileMenu")) return;

  setMobileTaskReorderMode(false);
}, { passive: true });

document.addEventListener("pointerdown", (e) => {
  if (e.target.closest(".task-actions-anchor")) return;
  closeTaskActionMenu();
});

document.addEventListener("selectstart", (e) => {
  if (!isMobileViewport()) return;
  if (e.target.closest(".edit-input")) return;
  e.preventDefault();
});

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseStoredAppData(rawData) {
  if (!rawData || typeof rawData !== "object") {
    return { tasks: {}, projects: {}, labels: [], projectOrder: [] };
  }

  const hasStructuredShape =
    Object.prototype.hasOwnProperty.call(rawData, "tasks") ||
    Object.prototype.hasOwnProperty.call(rawData, "projects") ||
    Object.prototype.hasOwnProperty.call(rawData, "labels");

  if (!hasStructuredShape) {
    return {
      tasks: rawData,
      projects: {},
      labels: [],
      projectOrder: []
    };
  }

  return {
    tasks: rawData.tasks || {},
    projects: rawData.projects || {},
    labels: Array.isArray(rawData.labels) ? rawData.labels : [],
    projectOrder: Array.isArray(rawData.projectOrder) ? rawData.projectOrder : []
  };
}

function reconcileProjectOrder(order, projectMap) {
  const safeOrder = Array.isArray(order) ? order : [];
  const seen = new Set();
  const result = [];

  safeOrder.forEach((id) => {
    if (!projectMap[id] || seen.has(id)) return;
    seen.add(id);
    result.push(id);
  });

  const missing = Object.keys(projectMap)
    .filter((id) => !seen.has(id))
    .sort((a, b) => (projectMap[a]?.createdAt || 0) - (projectMap[b]?.createdAt || 0));

  result.push(...missing);
  return result;
}

function normalizeTaskLabel(label) {
  if (!label || typeof label !== "object") return null;

  const name = typeof label.name === "string" ? label.name.trim() : "";
  const color = typeof label.color === "string" ? label.color.trim() : "";
  const id = typeof label.id === "string" ? label.id.trim() : "";

  if (!name || !color || !id) return null;

  return {
    id,
    name,
    color,
    createdAt: Number(label.createdAt) || Date.now()
  };
}

function normalizeLabelCatalog(labels) {
  if (!Array.isArray(labels)) return [];

  const seen = new Set();

  return labels
    .map(normalizeTaskLabel)
    .filter((label) => {
      if (!label || seen.has(label.id)) return false;
      seen.add(label.id);
      return true;
    })
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

function mergeLabelCatalog(...catalogs) {
  return normalizeLabelCatalog(catalogs.flat());
}

function normalizeTaskScheduling(task) {
  if (!task) return task;

  if (typeof task.timeSlot !== "string" || !TASK_TIME_OPTIONS.includes(task.timeSlot)) {
    task.timeSlot = null;
  }

  if (typeof task.tagId !== "string") {
    task.tagId = "";
  }

  task.timeCategory = task.timeSlot ? "scheduled" : "all-day";
  return task;
}

function getTaskLabelById(labelId) {
  if (!labelId) return null;
  return taskLabels.find((label) => label.id === labelId) || null;
}

function formatTaskLabelName(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return "";

  if (/^[a-záéíóúñ]/.test(trimmed)) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }

  return trimmed;
}

function createTaskLabel(name, color) {
  const label = {
    id: `label_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: formatTaskLabelName(name),
    color,
    createdAt: Date.now()
  };

  taskLabels = mergeLabelCatalog(taskLabels, [label]);
  return label;
}

function removeTaskLabelEverywhere(labelId) {
  if (!labelId) return;

  taskLabels = taskLabels.filter((label) => label.id !== labelId);

  Object.values(tasks).forEach((taskList) => {
    if (!Array.isArray(taskList)) return;
    taskList.forEach((task) => {
      if (task?.tagId === labelId) task.tagId = "";
    });
  });

  Object.values(projects).forEach((project) => {
    if (!project?.tasks || !Array.isArray(project.tasks)) return;
    project.tasks.forEach((task) => {
      if (task?.tagId === labelId) task.tagId = "";
    });
  });
}

function addDaysToIsoDate(isoDate, daysToAdd) {
  if (!isoDate) return null;
  const [year, month, day] = isoDate.split("-").map(Number);
  const nextDate = new Date(year, month - 1, day);
  nextDate.setDate(nextDate.getDate() + daysToAdd);
  return formatLocalDate(nextDate);
}

function sortTaskList(taskList) {
  taskList.sort((a, b) => {
    const taskA = normalizeTaskScheduling(a);
    const taskB = normalizeTaskScheduling(b);

    if (!!taskA.done !== !!taskB.done) {
      return taskA.done ? 1 : -1;
    }

    if (taskA.done && taskB.done) return 0;

    const hasTimeA = !!taskA.timeSlot;
    const hasTimeB = !!taskB.timeSlot;

    if (hasTimeA !== hasTimeB) {
      return hasTimeA ? -1 : 1;
    }

    if (!hasTimeA && !hasTimeB) return 0;

    return taskA.timeSlot.localeCompare(taskB.timeSlot);
  });
}

async function closeMobileKeyboardIfNeeded() {
  const activeElement = document.activeElement;
  if (!activeElement) return;

  const tagName = activeElement.tagName;
  const isEditable =
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    activeElement.isContentEditable;

  if (!isEditable) return;

  activeElement.blur();
  await delay(MOBILE_TASK_FOCUS_KEYBOARD_DELAY_MS);
}

async function scrollTaskIntoViewForMobile(taskElement){
  if (!isMobileTaskFocusEnabled() || !taskElement) return false;

  const rect = taskElement.getBoundingClientRect();
  const topSafe = 110;
  const bottomSafe = window.innerHeight - 180;

  if (rect.top >= topSafe && rect.bottom <= bottomSafe) {
    return false;
  }

  taskElement.scrollIntoView({
    block: "start",
    behavior: "smooth"
  });

  await delay(280);
  return true;
}

function normalizePlayer(raw = {}) {
  const normalized = {
    exp: 0,
    level: 0,
    todayExpTasks: 0,
    lastExpDate: null,
    dailyLimitShown: false,
    achievements: {},
    allTasksStreak: 0,
    lastAllTasksDate: null,
    activeStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    updatedAt: 0,
    ...raw
  };

  if (!normalized.achievements || typeof normalized.achievements !== "object") {
    normalized.achievements = {};
  }
  Object.keys(normalized.achievements).forEach((key) => {
    if (!ACHIEVEMENT_IDS.has(key)) {
      delete normalized.achievements[key];
    }
  });
  if (typeof normalized.longestStreak !== "number") {
    normalized.longestStreak = 0;
  }
  if (typeof normalized.activeStreak !== "number") {
    normalized.activeStreak = 0;
  }
  normalized.longestStreak = Math.max(normalized.longestStreak, normalized.activeStreak);

  return normalized;
}

function isDayFullyCompleted(dateStr){
  if (!dateStr) return false;
  const list = tasks?.[dateStr];
  if (!Array.isArray(list) || list.length === 0) return false;
  return list.every((task) => task.done);
}

function getAchievementStats(){
  let completedTasks = 0;
  let scheduledTasks = 0;
  let totalTasks = 0;

  Object.values(tasks || {}).forEach((list) => {
    if (!Array.isArray(list)) return;
    list.forEach((task) => {
      totalTasks++;
      if (task.done) completedTasks++;
      if (task.timeSlot) scheduledTasks++;
    });
  });

  Object.values(projects || {}).forEach((project) => {
    if (!project || !Array.isArray(project.tasks)) return;
    project.tasks.forEach((task) => {
      totalTasks++;
      if (task.done) completedTasks++;
      if (task.timeSlot) scheduledTasks++;
    });
  });

  const projectsCount = Object.keys(projects || {}).length;
  const today = formatLocalDate(new Date());
  const todayAllDone = isDayFullyCompleted(today);

  return { completedTasks, scheduledTasks, totalTasks, projectsCount, todayAllDone };
}

function isPreviousDay(prevDateStr, nextDateStr){
  if (!prevDateStr || !nextDateStr) return false;
  const prev = new Date(`${prevDateStr}T00:00:00`);
  const next = new Date(`${nextDateStr}T00:00:00`);
  return next - prev === 86400000;
}

function updateActiveStreak(){
  const today = formatLocalDate(new Date());
  if (player.lastActiveDate === today) return false;

  if (!player.lastActiveDate) {
    player.activeStreak = 1;
  } else if (isPreviousDay(player.lastActiveDate, today)) {
    player.activeStreak = Math.max(1, Number(player.activeStreak) || 0) + 1;
  } else {
    player.activeStreak = 1;
  }

  player.longestStreak = Math.max(
    Number(player.longestStreak) || 0,
    Number(player.activeStreak) || 0
  );

  player.lastActiveDate = today;
  player.updatedAt = Date.now();
  return true;
}

function updateAllTasksStreakForDate(dateStr){
  if (!dateStr) return false;
  const today = formatLocalDate(new Date());
  if (dateStr !== today) return false;
  if (!isDayFullyCompleted(dateStr)) return false;
  if (player.lastAllTasksDate === dateStr) return false;

  if (player.lastAllTasksDate && new Date(`${dateStr}T00:00:00`) <= new Date(`${player.lastAllTasksDate}T00:00:00`)) {
    return false;
  }

  if (!player.lastAllTasksDate) {
    player.allTasksStreak = 1;
  } else if (isPreviousDay(player.lastAllTasksDate, dateStr)) {
    player.allTasksStreak = Math.max(1, Number(player.allTasksStreak) || 0) + 1;
  } else {
    player.allTasksStreak = 1;
  }

  player.lastAllTasksDate = dateStr;
  player.updatedAt = Date.now();
  return true;
}

function isAchievementUnlocked(id){
  return !!player?.achievements?.[id]?.unlocked;
}

function unlockAchievement(achievement){
  if (!achievement || !achievement.id) return false;
  if (!player.achievements || typeof player.achievements !== "object") {
    player.achievements = {};
  }
  if (isAchievementUnlocked(achievement.id)) return false;

  const today = formatLocalDate(new Date());
  player.achievements[achievement.id] = {
    unlocked: true,
    date: today,
    exp: achievement.exp
  };

  player.exp += achievement.exp;
  player.updatedAt = Date.now();
  return true;
}

function getAchievementExpTotal(){
  return ACHIEVEMENTS.reduce((sum, achievement) => {
    if (!isAchievementUnlocked(achievement.id)) return sum;
    const storedExp = Number(player.achievements?.[achievement.id]?.exp);
    return sum + (Number.isFinite(storedExp) ? storedExp : achievement.exp);
  }, 0);
}

function notifyAchievementUnlocks(unlockedNow){
  if (!unlockedNow.length) return;
  enqueueAchievementUnlocks(unlockedNow);
}

const achievementUnlockQueue = [];
let achievementUnlockActive = null;

function enqueueAchievementUnlocks(achievements, { preview = false } = {}){
  if (!Array.isArray(achievements) || achievements.length === 0) return;
  achievements.forEach((achievement) => {
    if (!achievement || !achievement.id) return;
    achievementUnlockQueue.push({ ...achievement, preview });
  });
  if (!achievementUnlockActive) {
    showNextAchievementUnlock();
  }
}

function showNextAchievementUnlock(){
  if (achievementUnlockActive) return;
  const next = achievementUnlockQueue.shift();
  if (!next) return;
  achievementUnlockActive = next;
  openAchievementUnlockModal(next);
}

function openAchievementUnlockModal(achievement){
  const existing = document.getElementById("achievementUnlockOverlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "achievement-unlock-overlay";
  overlay.id = "achievementUnlockOverlay";

  const modal = document.createElement("div");
  modal.className = "achievement-unlock-card";
  modal.innerHTML = `
    <div class="achievement-unlock-badge">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M8 21h8"/>
        <path d="M12 17v4"/>
        <path d="M7 4h10v4a5 5 0 0 1-10 0z"/>
        <path d="M5 6H3a2 2 0 0 0 2 3"/>
        <path d="M19 6h2a2 2 0 0 1-2 3"/>
      </svg>
    </div>
    <div class="achievement-unlock-title">Logro desbloqueado</div>
    <div class="achievement-unlock-name">${achievement.name}</div>
    <div class="achievement-unlock-desc">${achievement.desc}</div>
    <div class="achievement-unlock-reward">+${achievement.exp} EXP</div>
    <button class="btn primary achievement-unlock-btn" id="achievementUnlockNext">Genial</button>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.classList.add("open");
  });

  const nextBtn = overlay.querySelector("#achievementUnlockNext");
  nextBtn?.addEventListener("click", () => {
    closeAchievementUnlockModal();
  });

  launchConfetti();
}

function closeAchievementUnlockModal(){
  const overlay = document.getElementById("achievementUnlockOverlay");
  if (overlay) overlay.remove();
  achievementUnlockActive = null;
  showNextAchievementUnlock();
}

function previewAchievementUnlocks(input){
  let list = [];

  if (typeof input === "number") {
    const count = Math.max(1, Math.min(ACHIEVEMENTS.length, Math.floor(input)));
    list = ACHIEVEMENTS.slice(0, count);
  } else if (Array.isArray(input)) {
    list = input
      .map((id) => ACHIEVEMENTS.find((achievement) => achievement.id === id))
      .filter(Boolean);
  } else if (typeof input === "string") {
    const found = ACHIEVEMENTS.find((achievement) => achievement.id === input);
    if (found) list = [found];
  } else {
    list = ACHIEVEMENTS.slice(0, 3);
  }

  if (list.length) {
    enqueueAchievementUnlocks(list, { preview: true });
  }
}

function renderAchievementsMenu(){
  const root = document.getElementById("settingsPanelAchievements");
  if (!root) return;

  const grid = root.querySelector("#achievementsGrid");
  const countEl = root.querySelector("#achievementsUnlockedCount");
  const expEl = root.querySelector("#achievementsExpTotal");
  if (!grid) return;

  const unlockedCount = ACHIEVEMENTS.filter((achievement) => isAchievementUnlocked(achievement.id)).length;
  if (countEl) countEl.textContent = unlockedCount;
  if (expEl) expEl.textContent = getAchievementExpTotal();
  const stats = getAchievementStats();
  const activeStreakEl = root.querySelector("#achievementsActiveStreak");
  const longestStreakEl = root.querySelector("#achievementsLongestStreak");
  const completedTasksEl = root.querySelector("#achievementsCompletedTasks");
  const projectsCountEl = root.querySelector("#achievementsProjectsCount");
  const scheduledTasksEl = root.querySelector("#achievementsScheduledTasks");

  if (activeStreakEl) activeStreakEl.textContent = player.activeStreak || 0;
  if (longestStreakEl) longestStreakEl.textContent = player.longestStreak || 0;
  if (completedTasksEl) completedTasksEl.textContent = stats.completedTasks;
  if (projectsCountEl) projectsCountEl.textContent = stats.projectsCount;
  if (scheduledTasksEl) scheduledTasksEl.textContent = stats.scheduledTasks;

  grid.innerHTML = ACHIEVEMENTS.map((achievement) => {
    const unlocked = isAchievementUnlocked(achievement.id);
    const info = player.achievements?.[achievement.id] || {};
    const dateText = unlocked && info.date ? info.date : "";
    const statusMarkup = unlocked
      ? `
        <span class="achievement-status-pill unlocked">Desbloqueado</span>
        <span class="achievement-status-date">${dateText}</span>
      `
      : `<span class="achievement-status-pill locked">Bloqueado</span>`;
    const statusClass = unlocked ? "unlocked" : "locked";
    return `
      <div class="achievement-card ${statusClass}">
        <div class="achievement-top">
          <div class="achievement-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M8 21h8"/>
              <path d="M12 17v4"/>
              <path d="M7 4h10v4a5 5 0 0 1-10 0z"/>
              <path d="M5 6H3a2 2 0 0 0 2 3"/>
              <path d="M19 6h2a2 2 0 0 1-2 3"/>
            </svg>
          </div>
          <div class="achievement-reward">+${achievement.exp} EXP</div>
        </div>
        <div class="achievement-name">${achievement.name}</div>
        <div class="achievement-desc">${achievement.desc}</div>
        <div class="achievement-status">${statusMarkup}</div>
      </div>
    `;
  }).join("");
}

function openAchievementsMenu(){
  openSettingsOverlay("achievements");
  renderAchievementsMenu();
}

function closeAchievementsMenu(){
  closeSettingsOverlay();
}

function checkAchievements({ dateContext = null, silent = false } = {}){
  let changed = false;
  const unlockedNow = [];

  if (updateActiveStreak()) {
    changed = true;
  }

  if (dateContext && updateAllTasksStreakForDate(dateContext)) {
    changed = true;
  }

  const stats = getAchievementStats();

  ACHIEVEMENTS.forEach((achievement) => {
    if (!ACHIEVEMENT_IDS.has(achievement.id)) return;
    if (isAchievementUnlocked(achievement.id)) return;
    if (achievement.check(stats)) {
      if (unlockAchievement(achievement)) {
        unlockedNow.push(achievement);
        changed = true;
      }
    }
  });

  if (unlockedNow.length && !silent) {
    notifyAchievementUnlocks(unlockedNow);
  }

  if (unlockedNow.length) {
    updateLevel();
  }

  if (changed) {
    savePlayer();
  }

  renderAchievementsMenu();
  return changed;
}

function bindMobileTapToClick(root){
  if (!root || !isTouchDevice) return;
  root.querySelectorAll("button").forEach((button) => {
    if (button.dataset.touchBound) return;
    button.dataset.touchBound = "true";
    const trigger = (e) => {
      if (button.dataset.touchFired === "true") return;
      button.dataset.touchFired = "true";
      setTimeout(() => {
        button.dataset.touchFired = "false";
      }, 0);
      e.preventDefault();
      e.stopPropagation();
      button.click();
    };
    button.addEventListener("touchend", trigger, { passive: false });
    button.addEventListener("pointerup", (e) => {
      if (e.pointerType !== "touch") return;
      trigger(e);
    });
  });
}

function openTaskTimeQuickEditor(taskElement, taskData, render){
  if (!taskElement || !taskData) return;
  if (document.getElementById("taskTimeEditorPanel")) return;

  const timePill = taskElement.querySelector(".task-time");
  if (!timePill) return;

  const overlay = document.createElement("div");
  overlay.id = "taskTimeEditorOverlay";

  const editor = document.createElement("div");
  editor.className = "task-time-editor-float";
  editor.id = "taskTimeEditorPanel";

  const title = document.createElement("div");
  title.className = "task-time-editor-title";
  title.textContent = "Editar Horario";

  const select = document.createElement("select");
  select.className = "task-time-select";

  const options = [{ label: "Todo el dia", value: "" }, ...TASK_TIME_OPTIONS.map((slot) => ({ label: slot, value: slot }))];
  options.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option.value;
    opt.textContent = option.label;
    if ((taskData.timeSlot || "") === option.value) opt.selected = true;
    select.appendChild(opt);
  });

  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "task-time-editor-btn confirm";
  confirmBtn.innerHTML = "✓";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "task-time-editor-btn cancel";
  cancelBtn.innerHTML = "✕";

  const controls = document.createElement("div");
  controls.className = "task-time-editor-controls";
  const selectWrap = document.createElement("div");
  selectWrap.className = "task-time-select-wrap";
  const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  chevron.setAttribute("viewBox", "0 0 16 16");
  chevron.setAttribute("fill", "none");
  chevron.setAttribute("stroke", "currentColor");
  chevron.setAttribute("stroke-width", "1.9");
  chevron.setAttribute("stroke-linecap", "round");
  chevron.setAttribute("stroke-linejoin", "round");
  chevron.classList.add("task-time-select-icon");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "m3 6 5 5 5-5");
  chevron.appendChild(path);
  selectWrap.appendChild(select);
  selectWrap.appendChild(chevron);
  controls.appendChild(selectWrap);
  controls.appendChild(confirmBtn);
  controls.appendChild(cancelBtn);

  editor.appendChild(title);
  editor.appendChild(controls);

  document.body.appendChild(overlay);
  document.body.appendChild(editor);

  const positionEditor = () => {
    const rect = timePill.getBoundingClientRect();
    const panelWidth = editor.offsetWidth || 260;
    const panelHeight = editor.offsetHeight || 140;
    const padding = 12;

    let left = rect.left + (rect.width / 2) - (panelWidth / 2);
    left = Math.min(Math.max(padding, left), window.innerWidth - panelWidth - padding);

    let top = rect.bottom + 10;
    if (top + panelHeight > window.innerHeight - padding) {
      top = rect.top - panelHeight - 10;
    }
    top = Math.min(Math.max(padding, top), window.innerHeight - panelHeight - padding);

    editor.style.left = `${Math.round(left)}px`;
    editor.style.top = `${Math.round(top)}px`;
  };

  positionEditor();
  requestAnimationFrame(() => {
    editor.classList.add("open");
  });

  const cleanup = () => {
    overlay.remove();
    editor.remove();
    render();
  };

  confirmBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const selected = select.value || null;
    taskData.timeSlot = selected;
    taskData.timeCategory = selected ? "scheduled" : "all-day";
    await save();
    overlay.remove();
    editor.remove();
    render();
    renderMiniCalendar();
    checkAchievements();
  });

  cancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    cleanup();
  });

  select.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  select.addEventListener("change", (e) => {
    e.stopPropagation();
  });

  if (isTouchDevice) {
    bindMobileTapToClick(editor);
  }

  overlay.addEventListener("click", cleanup);
  window.addEventListener("resize", positionEditor, { once: true });
}

let player = normalizePlayer(JSON.parse(localStorage.getItem("mt_player")) || {});

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

  const greetingPrefix =
    hour >= 6 && hour <= 19
      ? "Buen día,"
      : "Buenas noches,";
  const greetingText = `${greetingPrefix} ${nameToShow}`;

  if (window.innerWidth <= 900) {
    greetingEl.textContent = "";

    const prefix = document.createElement("span");
    prefix.className = "greeting-prefix";
    prefix.textContent = greetingPrefix;

    const name = document.createElement("span");
    name.className = "greeting-name";
    name.textContent = nameToShow;

    greetingEl.append(prefix, name);
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

function setStatusSaving(){
  statusText.innerHTML = `
    <svg width="18px" height="18px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="none">
    <g fill="currentColor">
    <path d="M8 1.5A6.5 6.5 0 001.5 8 .75.75 0 010 8a8 8 0 0113.5-5.81v-.94a.75.75 0 011.5 0v3a.75.75 0 01-.75.75h-3a.75.75 0 010-1.5h1.44A6.479 6.479 0 008 1.5zM15.25 7.25A.75.75 0 0116 8a8 8 0 01-13.5 5.81v.94a.75.75 0 01-1.5 0v-3a.75.75 0 01.75-.75h3a.75.75 0 010 1.5H3.31A6.5 6.5 0 0014.5 8a.75.75 0 01.75-.75z"/>
    </g>
    </svg>
    <span class="status-label">Guardando Datos</span>
  `;
}

function setStatusSaved(){
  statusText.innerHTML = `
      <svg fill="currentColor" width="22px" height="22px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" d="M23,14 C23,16.7614237 20.7614237,19 18,19 L7,19 C3.6862915,19 1,16.3137085 1,13 C1,9.95876977 3.26703071,7.43346119 6.21989093,7.05027488 C7.50901474,5.16507238 9.65343535,4 12,4 C15.1586186,4 17.8750012,6.1056212 18.7254431,9.0522437 C21.1430685,9.40362782 23,11.4849591 23,14 Z M18,17 C19.6568542,17 21,15.6568542 21,14 C21,12.3431458 19.6568542,11 18,11 C17.9686786,11.0001061 17.9686786,11.0001061 17.9374883,11.0006341 L17.0737589,11.0181765 L16.9309417,10.1661557 C16.5303438,7.77626335 14.4511274,6 12,6 C10.1923998,6 8.55429829,6.96642863 7.6664163,8.50398349 L7.39066076,8.98151234 L6.83965518,9.0031404 C4.69934052,9.08715198 3,10.8504451 3,13 C3,15.209139 4.790861,17 7,17 L18,17 Z M10,12.5857864 L13.2928932,9.29289322 L14.7071068,10.7071068 L10,15.4142136 L7.29289322,12.7071068 L8.70710678,11.2928932 L10,12.5857864 Z"/>
      </svg>
      <span class="status-label">Datos Guardados</span>
    `;
}

function setStatusLocal(){
  statusText.innerHTML = `
      <svg fill="currentColor" width="22px" height="22px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" d="M17.5857864,19 L7,19 C3.6862915,19 1,16.3137085 1,13 C1,10.1320517 3.01605065,7.72290805 5.72212244,7.136336 L1.29289322,2.70710678 L2.70710678,1.29289322 L22.7071068,21.2928932 L21.2928932,22.7071068 L17.5857864,19 Z M7.45532281,8.86953637 L7.39066076,8.98151234 L6.83965518,9.0031404 C4.69934052,9.08715198 3,10.8504451 3,13 C3,15.209139 4.790861,17 7,17 L15.5857864,17 L7.45532281,8.86953637 Z M21.641028,17.4268145 L20.2257382,16.0115247 C20.7069401,15.4794096 21,14.7739287 21,14 C21,12.3431458 19.6568542,11 18,11 C17.9686786,11.0001061 17.9686786,11.0001061 17.9374883,11.0006341 L17.0737589,11.0181765 L16.9309417,10.1661557 C16.5303438,7.77626335 14.4511274,6 12,6 C11.4659176,6 10.9466324,6.08436874 10.4571233,6.24290982 L8.92460896,4.71039545 C9.86234872,4.25169049 10.9093398,4 12,4 C15.1586186,4 17.8750012,6.1056212 18.7254431,9.0522437 C21.1430685,9.40362782 23,11.4849591 23,14 C23,15.3262254 22.4836544,16.5318518 21.641028,17.4268145 Z"/>
      </svg>
      <span class="status-label">Modo Sin Conexión</span>
    `;
}

function setStatusPending(){
  statusText.innerHTML = `
    <svg fill="currentColor" width="22px" height="22px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path fill-rule="evenodd" d="M17.5857864,19 L7,19 C3.6862915,19 1,16.3137085 1,13 C1,10.1320517 3.01605065,7.72290805 5.72212244,7.136336 L1.29289322,2.70710678 L2.70710678,1.29289322 L22.7071068,21.2928932 L21.2928932,22.7071068 L17.5857864,19 Z M7.45532281,8.86953637 L7.39066076,8.98151234 L6.83965518,9.0031404 C4.69934052,9.08715198 3,10.8504451 3,13 C3,15.209139 4.790861,17 7,17 L15.5857864,17 L7.45532281,8.86953637 Z M21.641028,17.4268145 L20.2257382,16.0115247 C20.7069401,15.4794096 21,14.7739287 21,14 C21,12.3431458 19.6568542,11 18,11 C17.9686786,11.0001061 17.9686786,11.0001061 17.9374883,11.0006341 L17.0737589,11.0181765 L16.9309417,10.1661557 C16.5303438,7.77626335 14.4511274,6 12,6 C11.4659176,6 10.9466324,6.08436874 10.4571233,6.24290982 L8.92460896,4.71039545 C9.86234872,4.25169049 10.9093398,4 12,4 C15.1586186,4 17.8750012,6.1056212 18.7254431,9.0522437 C21.1430685,9.40362782 23,11.4849591 23,14 C23,15.3262254 22.4836544,16.5318518 21.641028,17.4268145 Z"/>
    </svg>
    <span class="status-label">Modo Sin Conexión: Cambios pendientes</span>
  `;
}

function setStatusNotLogged(){
  statusText.innerHTML = `
    <svg fill="currentColor" width="22px" height="22px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path fill-rule="evenodd" d="M17.5857864,19 L7,19 C3.6862915,19 1,16.3137085 1,13 C1,10.1320517 3.01605065,7.72290805 5.72212244,7.136336 L1.29289322,2.70710678 L2.70710678,1.29289322 L22.7071068,21.2928932 L21.2928932,22.7071068 L17.5857864,19 Z M7.45532281,8.86953637 L7.39066076,8.98151234 L6.83965518,9.0031404 C4.69934052,9.08715198 3,10.8504451 3,13 C3,15.209139 4.790861,17 7,17 L15.5857864,17 L7.45532281,8.86953637 Z M21.641028,17.4268145 L20.2257382,16.0115247 C20.7069401,15.4794096 21,14.7739287 21,14 C21,12.3431458 19.6568542,11 18,11 C17.9686786,11.0001061 17.9686786,11.0001061 17.9374883,11.0006341 L17.0737589,11.0181765 L16.9309417,10.1661557 C16.5303438,7.77626335 14.4511274,6 12,6 C11.4659176,6 10.9466324,6.08436874 10.4571233,6.24290982 L8.92460896,4.71039545 C9.86234872,4.25169049 10.9093398,4 12,4 C15.1586186,4 17.8750012,6.1056212 18.7254431,9.0522437 C21.1430685,9.40362782 23,11.4849591 23,14 C23,15.3262254 22.4836544,16.5318518 21.641028,17.4268145 Z"/>
    </svg>
    <span class="status-label">Inicia sesión para guardar tus tareas</span>
  `;
}

let hasRendered = false;

function formatProfileTriggerName(displayName){
  const raw = String(displayName || "Invitado").trim();
  const parts = raw.split(/\s+/).filter(Boolean);

  if(parts.length >= 3){
    return `${parts[0]} ${parts[1]}`;
  }

  if(parts.length === 2){
    return parts[0];
  }

  return parts[0] || "Invitado";
}

function renderLoginCircle(photoURL, displayName){
  if(!loginCircleBtn) return;

  const hasPhoto = !!photoURL;
  const safeName = formatProfileTriggerName(displayName);

  loginCircleBtn.innerHTML = `
    <div class="profile-trigger-avatar">
      ${
        hasPhoto
          ? `<img class="profile-trigger-photo" alt="Profile">`
          : `<svg class="profile-trigger-fallback" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4"></circle>
              <path d="M4 20c2-4 6-6 8-6s6 2 8 6"></path>
            </svg>`
      }
    </div>
    <div class="profile-trigger-copy">
      <div class="profile-trigger-name" id="profileTriggerName"></div>
      <div class="profile-trigger-level-row">
        <span class="profile-trigger-level-text">NIVEL <span id="profileTriggerLevel">0</span></span>
        <span class="profile-trigger-level-bar">
          <span class="profile-trigger-level-fill" id="profileTriggerProgress"></span>
        </span>
      </div>
    </div>
    <svg class="profile-trigger-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `;

  const triggerName = document.getElementById("profileTriggerName");
  if(triggerName){
    triggerName.textContent = safeName;
  }

  const triggerPhoto = loginCircleBtn.querySelector(".profile-trigger-photo");
  if(triggerPhoto){
    triggerPhoto.src = photoURL;
  }

  const triggerLevel = document.getElementById("profileTriggerLevel");
  const triggerProgress = document.getElementById("profileTriggerProgress");
  const levelState = getLevelProgressState();

  if(triggerLevel){
    triggerLevel.textContent = String(levelState.level);
  }

  if(triggerProgress){
    triggerProgress.style.width = `${levelState.progress * 100}%`;
  }

  if(profileLogoutBtn){
    profileLogoutBtn.textContent = currentUser ? "Cerrar Sesion" : "Iniciar sesión";
  }
}

onAuthStateChanged(auth, async (user) => {

  if (user) {

    currentUser = user;
    document.body.classList.remove("logged-out");
    authGate?.classList.remove("open");
    resetAuthGateStyles();
    updateSettingsProfile(user);
    syncOfficeModeControls();
    // 🔥 Ocultar tooltip si estaba visible
    loginTooltip.classList.remove("show");
    clearTimeout(tooltipTimeout);

    // 🔥 Mostrar foto en botón circular
    renderLoginCircle(user.photoURL, user.displayName);
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

    // 🔥 Listener en tiempo real ONSNAPSHOT
    unsubscribe = onSnapshot(userRef, async (snapshot) => {

      if (!snapshot.exists()) return;   // 🔥 salir si el documento no existe

      if (snapshot.exists()) {
        const data = snapshot.data();

        officeModeEnabled = data.officeModeEnabled ?? data.securityPinEnabled ?? false;
        officeModeTimeoutSeconds = normalizeOfficeModeTimeout(
          data.officeModeTimeoutSeconds
        );
        securityPinHash = data.securityPinHash || "";
        legacySecurityPin = data.securityPin || "";
        isLocked = !!data.officeModeLocked;
        setLocalOfficeLockState(isLocked);

        updateSettingsProfile(user);
        syncOfficeModeControls();

        if(officeModeEnabled){
          if(isLocked){
            lockApp(false);
          }else{
            hideLockScreen();
            clearLockFeedback();
            resetInactivityTimer();
          }
        }else{
          clearTimeout(inactivityTimer);
          isLocked = false;
          hideLockScreen();
        }

        const cloudTasks = data.tasks || {};
        const cloudProjects = data.projects || {};
        const cloudProjectOrder = Array.isArray(data.projectOrder) ? data.projectOrder : [];
        const cloudLabels = normalizeLabelCatalog(data.labels || []);

        const localData = parseStoredAppData(JSON.parse(localStorage.getItem(storeKey)) || {});
        const localTasks = localData.tasks || {};
        const localProjects = localData.projects || {};
        const localProjectOrder = Array.isArray(localData.projectOrder) ? localData.projectOrder : [];
        const localLabels = normalizeLabelCatalog(localData.labels || []);

        // 🔥 fusionar tareas
        tasks = { ...cloudTasks };

        Object.entries(localTasks).forEach(([date, localList]) => {

          if(!tasks[date]) tasks[date] = [];

          const existingTexts = new Set(tasks[date].map(t => t.text));

          localList.forEach(t => {
            if(!existingTexts.has(t.text)){
              tasks[date].push(t);
            }
          });

        });

        // 🔥 fusionar proyectos
        projects = { ...cloudProjects };

        Object.entries(localProjects).forEach(([id, proj]) => {

          if(!projects[id]){
            projects[id] = proj;
          }

        });

        projectOrder = reconcileProjectOrder(
          cloudProjectOrder.length ? cloudProjectOrder : localProjectOrder,
          projects
        );

        taskLabels = mergeLabelCatalog(cloudLabels, localLabels);

        const hasLocalTasks = Object.keys(localTasks).length > 0;
        const hasLocalProjects = Object.keys(localProjects).length > 0;
        const hasLocalLabels = localLabels.length > 0;

        if(hasLocalTasks || hasLocalProjects || hasLocalLabels || localProjectOrder.length > 0){
          await setDoc(userRef,{
            tasks,
            projects,
            labels: taskLabels,
            projectOrder
          },{ merge:true });
        }

        if (data.viewMode) {
          currentViewMode = data.viewMode;
          localStorage.setItem("mt_view_mode", currentViewMode);
        }

        if (data.player) {
          const remotePlayer = normalizePlayer(data.player);
          const localPlayer = normalizePlayer(player || {});
          player = remotePlayer.updatedAt >= localPlayer.updatedAt
            ? remotePlayer
            : localPlayer;
        } else if (!player || typeof player.exp !== "number") {
          player = normalizePlayer({});
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
        const localData = parseStoredAppData(JSON.parse(localStorage.getItem(storeKey)) || {});
        tasks = localData.tasks || {};
        projects = localData.projects || {};
        projectOrder = reconcileProjectOrder(localData.projectOrder || [], projects);
        taskLabels = normalizeLabelCatalog(localData.labels || []);
        await setDoc(
          userRef,
          { tasks, projects, labels: taskLabels, projectOrder },
          { merge: true }
        );
      }

      // Limpiar local para evitar duplicados
      localStorage.removeItem(storeKey);

      init();

      updateLevel();

      if (!hasRendered) {
          document.body.classList.remove("app-loading");
          document.getElementById("loadingScreen")?.remove();
          appReady = true;
          hasRendered = true;
        }

      setStatusSaved();

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
        document.body.classList.add("logged-out");
        authGate?.classList.add("open");
        resetTransientOverlays();
        ensureAuthGateVisible();
        officeModeEnabled = false;
        officeModeTimeoutSeconds = 60;
        securityPinHash = "";
        legacySecurityPin = "";
        isLocked = false;
        setLocalOfficeLockState(false);
        clearTimeout(inactivityTimer);
        hideLockScreen();
        updateSettingsProfile(null);
        syncOfficeModeControls();

        renderLoginCircle("", "Invitado");
        loginCircleBtn.classList.remove("logged-in");

        const localData = parseStoredAppData(JSON.parse(localStorage.getItem(storeKey)) || {});

        tasks = localData.tasks || {};
        projects = localData.projects || {};
        projectOrder = reconcileProjectOrder(localData.projectOrder || [], projects);
        taskLabels = normalizeLabelCatalog(localData.labels || []);
        init();

        setStatusNotLogged(); 
        updateGreeting(user);
        updateSubtitle(user);

        if (!hasRendered) {
            document.body.classList.remove("app-loading");
            document.getElementById("loadingScreen")?.remove();
            appReady = true;
            hasRendered = true;
        }
      }

    });

authGateGoogleBtn?.addEventListener("click", async (e) => {
  e.preventDefault();
  e.stopPropagation();
  await signInWithPopup(auth, provider);
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

cornerContainer?.classList.add("collapsed");

function closeCornerMenu() {
  if(!cornerContainer) return;

  cornerContainer.classList.remove("expanded", "closing");
  cornerContainer.classList.add("collapsed");
  loginCircleBtn?.setAttribute("aria-expanded", "false");

  profileMenuOpen = false;

  loginTooltip.classList.remove("show");
  clearTimeout(tooltipTimeout);
}

function openCornerMenu() {
  if(!cornerContainer) return;

  cornerContainer.classList.remove("collapsed");
  cornerContainer.classList.add("expanded");
  loginCircleBtn?.setAttribute("aria-expanded", "true");

  profileMenuOpen = true;
}


loginCircleBtn?.addEventListener("click", (e) => {
  e.stopPropagation();

  const isMobile = window.innerWidth <= 900;

  // Si es mobile y la sidebar está abierta, cerrarla primero
  if (isMobile && !sidebar.classList.contains("collapsed")) {
    sidebar.classList.add("collapsed");
  }

  if (profileMenuOpen) {
    closeCornerMenu();
    return;
  }

  openCornerMenu();

  if (!currentUser) {
    clearTimeout(tooltipTimeout);
    tooltipTimeout = setTimeout(() => {
      loginTooltip.classList.add("show");
    }, 900);
  }
});

document.addEventListener("click", (e) => {
  if(!profileMenuOpen) return;
  if(cornerContainer?.contains(e.target)) return;
  closeCornerMenu();
});

profileLogoutBtn?.addEventListener("click", async (e) => {
  e.stopPropagation();
  closeCornerMenu();

  if (!currentUser) {
    await signInWithPopup(auth, provider);
    return;
  }

  logoutOverlay.classList.add("open");
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
const settingsOverlay = document.getElementById("settingsOverlay");
const settingsCloseBtn = document.getElementById("settingsCloseBtn");
const officeModeToggle = document.getElementById("officeModeToggle");
const officeModeTimeoutSelect = document.getElementById("officeModeTimeoutSelect");
const taskNotificationsToggle = document.getElementById("taskNotificationsToggle");
const settingsNotificationsPermission = document.getElementById("settingsNotificationsPermission");
const settingsAuthNote = document.getElementById("settingsAuthNote");
const settingsNav = document.getElementById("settingsNav");
const settingsMobileNavToggle = document.getElementById("settingsMobileNavToggle");
const settingsMobileNavCurrentIcon = document.getElementById("settingsMobileNavCurrentIcon");
const settingsMobileNavCurrentLabel = document.getElementById("settingsMobileNavCurrentLabel");
const settingsProfileName = document.getElementById("settingsProfileName");
const settingsProfileAvatar = document.getElementById("settingsProfileAvatar");
const settingsAccountAvatar = document.getElementById("settingsAccountAvatar");
const settingsAccountName = document.getElementById("settingsAccountName");
const settingsAccountEmail = document.getElementById("settingsAccountEmail");
const settingsAccountStatus = document.getElementById("settingsAccountStatus");
const settingsAccountLevel = document.getElementById("settingsAccountLevel");
const settingsAccountExp = document.getElementById("settingsAccountExp");
const settingsAccountCompletedTasks = document.getElementById("settingsAccountCompletedTasks");
const settingsAccountProjects = document.getElementById("settingsAccountProjects");
const settingsAccountLogoutBtn = document.getElementById("settingsAccountLogoutBtn");
const reportErrorBtn = document.getElementById("reportErrorBtn");
const suggestFeatureBtn = document.getElementById("suggestFeatureBtn");
const settingsNavItems = Array.from(document.querySelectorAll(".settings-nav-item"));
const settingsPanels = {
  account: document.getElementById("settingsPanelAccount"),
  notifications: document.getElementById("settingsPanelNotifications"),
  achievements: document.getElementById("settingsPanelAchievements"),
  help: document.getElementById("settingsPanelHelp"),
  security: document.getElementById("settingsPanelSecurity")
};
const APP_VERSION = document.querySelector(".brand-meta .version")?.textContent?.trim()
  || document.querySelector(".changelog-version")?.textContent?.trim()
  || "v2.4";
const FEEDBACK_FORM_ENDPOINT = "https://formsubmit.co/ajax/santiialonso27@gmail.com";

const OFFICE_MODE_TIMEOUT_OPTIONS = [30, 60, 120, 300, 600, 1800];

function normalizeOfficeModeTimeout(value){
  const parsed = Number(value);
  return OFFICE_MODE_TIMEOUT_OPTIONS.includes(parsed) ? parsed : 60;
}

async function hashSecurityPin(pin){
  const data = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function updateSettingsProfile(user = currentUser){
  if(settingsProfileName){
    settingsProfileName.textContent = user?.displayName || "Invitado";
  }

  if(settingsProfileAvatar){
    settingsProfileAvatar.src = user?.photoURL || "/flav-icon.png";
  }
}

function formatSettingsStat(value){
  return Number(value || 0).toLocaleString("es-AR");
}

function renderSettingsAccountPanel(user = currentUser){
  const stats = getAchievementStats();
  const levelState = getLevelProgressState();
  const hasSession = !!user;

  if(settingsAccountAvatar){
    settingsAccountAvatar.src = user?.photoURL || "/flav-icon.png";
  }

  if(settingsAccountName){
    settingsAccountName.textContent = user?.displayName || "Invitado";
  }

  if(settingsAccountEmail){
    settingsAccountEmail.textContent = user?.email || "Sin sesión iniciada";
  }

  if(settingsAccountStatus){
    settingsAccountStatus.textContent = hasSession
      ? "Tu cuenta está sincronizando tareas y progreso en tiempo real."
      : "Inicia sesión para sincronizar tus tareas y progreso.";
  }

  if(settingsAccountLevel){
    settingsAccountLevel.textContent = formatSettingsStat(levelState.level);
  }

  if(settingsAccountExp){
    settingsAccountExp.textContent = formatSettingsStat(Math.max(0, Number(player?.exp) || 0));
  }

  if(settingsAccountCompletedTasks){
    settingsAccountCompletedTasks.textContent = formatSettingsStat(stats.completedTasks);
  }

  if(settingsAccountProjects){
    settingsAccountProjects.textContent = formatSettingsStat(stats.projectsCount);
  }

  if(settingsAccountLogoutBtn){
    settingsAccountLogoutBtn.textContent = hasSession ? "Cerrar sesión" : "Iniciar sesión";
  }
}

function setLocalOfficeLockState(locked){
  localStorage.setItem(OFFICE_MODE_LOCK_STORAGE_KEY, locked ? "true" : "false");
}

function persistTaskNotificationsPreference(){
  localStorage.setItem(
    TASK_NOTIFICATION_SETTINGS_STORAGE_KEY,
    JSON.stringify(taskNotificationsEnabled)
  );
}

function getBrowserNotificationPermission(){
  if(!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function updateNotificationPermissionHint(){
  if(!settingsNotificationsPermission) return;

  const permission = getBrowserNotificationPermission();

  if(permission === "unsupported"){
    settingsNotificationsPermission.textContent = "Tu navegador no soporta notificaciones web.";
    return;
  }

  if(permission === "granted"){
    settingsNotificationsPermission.innerHTML = 'Permiso en este dispositivo: <span class="settings-permission-ok">Autorizado</span>.';
    return;
  }

  if(permission === "denied"){
    settingsNotificationsPermission.textContent = "Permiso bloqueado en este dispositivo: habilítalo desde la configuración del navegador.";
    return;
  }

  settingsNotificationsPermission.textContent = "Permiso pendiente en este dispositivo: al abrir la app se solicitará autorización. Debes permitirlo por separado en cada móvil o computadora.";
}

function clearScheduledTaskNotifications(){
  scheduledTaskNotificationTimers.forEach((timerId) => {
    clearTimeout(timerId);
  });
  scheduledTaskNotificationTimers.clear();
}

function parseTaskDateTime(dateStr, timeSlot){
  if(!dateStr || !timeSlot) return null;

  const [year, month, day] = String(dateStr).split("-").map(Number);
  const [hours, minutes] = String(timeSlot).split(":").map(Number);

  if(
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ){
    return null;
  }

  const parsedDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

  if(Number.isNaN(parsedDate.getTime())){
    return null;
  }

  return parsedDate;
}

function showTaskReminderNotification({ taskText, timeSlot }){
  if(!taskNotificationsEnabled) return;
  if(getBrowserNotificationPermission() !== "granted") return;

  try{
    const notification = new Notification("Recordatorio de tarea", {
      body: `${taskText}\nEmpieza a las ${timeSlot}.`,
      tag: `mt-task-reminder-${timeSlot}-${taskText.slice(0, 40)}`
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }catch(err){
    console.error(err);
  }
}

function scheduleTaskNotifications(){
  clearScheduledTaskNotifications();

  if(!taskNotificationsEnabled) return;
  if(getBrowserNotificationPermission() !== "granted") return;

  const now = Date.now();

  Object.entries(tasks || {}).forEach(([dateStr, taskList]) => {
    if(!Array.isArray(taskList)) return;

    taskList.forEach((task, index) => {
      if(!task || !task.timeSlot || task.done) return;

      const scheduledAt = parseTaskDateTime(dateStr, task.timeSlot);
      if(!scheduledAt) return;

      const reminderAt = scheduledAt.getTime() - TASK_NOTIFICATION_LEAD_MS;
      const delay = reminderAt - now;

      if(delay <= 0 || delay > MAX_SCHEDULE_TIMEOUT_MS) return;

      const notificationKey = `${dateStr}|${task.timeSlot}|${index}|${task.text || ""}`;
      const timerId = window.setTimeout(() => {
        showTaskReminderNotification({
          taskText: task.text || "Tienes una tarea programada",
          timeSlot: task.timeSlot
        });
        scheduledTaskNotificationTimers.delete(notificationKey);
      }, delay);

      scheduledTaskNotificationTimers.set(notificationKey, timerId);
    });
  });
}

async function requestTaskNotificationPermissionIfNeeded(){
  const permission = getBrowserNotificationPermission();

  if(permission === "unsupported" || permission === "granted" || permission === "denied"){
    return permission;
  }

  try{
    return await Notification.requestPermission();
  }catch(err){
    console.error(err);
    return getBrowserNotificationPermission();
  }
}

async function maybeAutoRequestTaskNotificationsPermission(){
  if(taskNotificationAutoPromptAttempted) return;
  if(!taskNotificationsEnabled) return;
  if(getBrowserNotificationPermission() !== "default") return;

  taskNotificationAutoPromptAttempted = true;

  const permission = await requestTaskNotificationPermissionIfNeeded();

  if(permission === "granted"){
    scheduleTaskNotifications();
  }else if(permission === "denied"){
    taskNotificationsEnabled = false;
    persistTaskNotificationsPreference();
    clearScheduledTaskNotifications();
  }else if(permission === "default"){
    taskNotificationAutoPromptAttempted = false;
  }

  syncTaskNotificationControls();
}

function bindAutoNotificationPermissionFallback(){
  const tryWithGesture = async () => {
    if(getBrowserNotificationPermission() !== "default"){
      return;
    }
    await maybeAutoRequestTaskNotificationsPermission();
  };

  document.addEventListener("pointerdown", tryWithGesture, { once: true });
  document.addEventListener("keydown", tryWithGesture, { once: true });
}

function syncTaskNotificationControls(){
  const permission = getBrowserNotificationPermission();

  if(taskNotificationsToggle){
    taskNotificationsToggle.checked = taskNotificationsEnabled;
    taskNotificationsToggle.disabled = permission === "unsupported";
  }

  updateNotificationPermissionHint();
}

function syncOfficeModeControls(){
  if(officeModeToggle){
    officeModeToggle.checked = officeModeEnabled;
    officeModeToggle.disabled = !currentUser;
  }

  if(officeModeTimeoutSelect){
    officeModeTimeoutSelect.value = String(officeModeTimeoutSeconds);
    officeModeTimeoutSelect.disabled = !currentUser;
  }

  if(settingsAuthNote){
    settingsAuthNote.classList.toggle("show", !currentUser);
  }

  syncTaskNotificationControls();
}

function isMobileSettingsViewport(){
  return window.matchMedia("(max-width: 900px)").matches;
}

function getActiveSettingsNavItem(){
  return settingsNavItems.find(item => item.classList.contains("active")) || settingsNavItems[0] || null;
}

function syncMobileSettingsNavState(){
  if(!settingsMobileNavToggle) return;

  const activeItem = getActiveSettingsNavItem();
  const activeLabel = activeItem?.textContent?.trim() || "Cuenta";
  const activeIcon = activeItem?.querySelector(".settings-nav-icon")?.innerHTML || "";
  const isExpanded = Boolean(isMobileSettingsViewport() && settingsNav?.classList.contains("mobile-open"));

  if(settingsMobileNavCurrentLabel){
    settingsMobileNavCurrentLabel.textContent = activeLabel;
  }

  if(settingsMobileNavCurrentIcon){
    settingsMobileNavCurrentIcon.innerHTML = activeIcon;
  }

  settingsMobileNavToggle.setAttribute("aria-expanded", isExpanded ? "true" : "false");
}

function closeMobileSettingsNav(){
  settingsNav?.classList.remove("mobile-open");
  syncMobileSettingsNavState();
}

function openSettingsPanel(panelName = "security"){
  settingsNavItems.forEach(item => {
    item.classList.toggle("active", item.dataset.settingsPanel === panelName);
  });

  Object.entries(settingsPanels).forEach(([name, panel]) => {
    if(panel){
      panel.classList.toggle("active", name === panelName);
    }
  });

  syncMobileSettingsNavState();
}

function openSettingsOverlay(panelName = "security"){
  const effectivePanel = (isMobileSettingsViewport() && panelName === "security")
    ? "account"
    : panelName;

  updateSettingsProfile();
  renderSettingsAccountPanel();
  syncOfficeModeControls();
  openSettingsPanel(effectivePanel);
  closeMobileSettingsNav();
  settingsOverlay.classList.add("open");
}

function closeSettingsOverlay(){
  closeFeedbackModal();
  closeMobileSettingsNav();
  settingsOverlay.classList.remove("open");
}

function getFeedbackConfig(type){
  return type === "error"
    ? {
        typeLabel: "Reporte de error",
        badge: "Soporte",
        title: "Reportar un error",
        description: "Contanos qué pasó y, si podés, incluí el momento exacto o los pasos para reproducirlo.",
        fieldLabel: "Describe el error en detalle",
        placeholder: "Ejemplo: al mover una tarea entre proyectos, desaparece después de recargar."
      }
    : {
        typeLabel: "Sugerencia",
        badge: "Ideas",
        title: "Enviar una sugerencia",
        description: "Compartí la mejora que te gustaría ver en MultiTareas y, si querés, cómo te imaginás el flujo.",
        fieldLabel: "Describe tu sugerencia en detalle",
        placeholder: "Ejemplo: me gustaría poder filtrar tareas por etiqueta y guardar vistas favoritas."
      };
}

function updateHelpButtonSentState(button){
  if(!button) return;

  const originalHtml = button.dataset.originalHtml || button.innerHTML;
  button.dataset.originalHtml = originalHtml;

  const activeTimer = Number(button.dataset.sentTimerId || 0);
  if(activeTimer){
    clearTimeout(activeTimer);
  }

  button.classList.add("is-sent");
  button.innerHTML = `
    <span class="settings-help-btn-title">Enviado</span>
    <span class="settings-help-btn-subtitle">Gracias por enviarnos tu aporte.</span>
  `;

  const nextTimer = window.setTimeout(() => {
    button.classList.remove("is-sent");
    button.innerHTML = originalHtml;
    delete button.dataset.sentTimerId;
  }, 2600);

  button.dataset.sentTimerId = String(nextTimer);
}

async function sendFeedbackEmail({ type, message }){
  if(FEEDBACK_FORM_ENDPOINT.includes("TU_GMAIL@gmail.com")){
    throw new Error("FEEDBACK_ENDPOINT_NOT_CONFIGURED");
  }

  const reporterName = currentUser?.displayName?.trim() || "Invitado";

  const details = [
    `Tipo: ${type}`,
    `Nombre: ${reporterName}`,
    `Version: ${APP_VERSION}`,
    `Nombre de cuenta: ${currentUser?.displayName || "Sin sesion iniciada"}`,
    `Email de cuenta: ${currentUser?.email || "No disponible"}`,
    `UID: ${currentUser?.uid || "No disponible"}`,
    `Fecha local: ${new Date().toLocaleString("es-AR")}`,
    `Origen: ${window.location.href}`,
    "",
    "Detalle:",
    message
  ].join("\n");

  const formData = new FormData();
  formData.append("name", reporterName);
  if(currentUser?.email){
    formData.append("email", currentUser.email);
  }
  formData.append("message", details);
  formData.append("tipo", type);
  formData.append("nombre_persona", reporterName);
  formData.append("version_app", APP_VERSION);
  formData.append("texto", message);
  formData.append("nombre_cuenta", currentUser?.displayName || "Sin sesion iniciada");
  formData.append("email_cuenta", currentUser?.email || "No disponible");
  formData.append("_subject", `[MultiTareas ${APP_VERSION}] ${type} - ${reporterName}`);
  formData.append("_template", "table");
  formData.append("_captcha", "false");

  const response = await fetch(FEEDBACK_FORM_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json"
    },
    body: formData
  });

  const data = await response.json().catch(() => null);

  if(!response.ok || data?.success === false){
    throw new Error(data?.message || "FEEDBACK_SEND_FAILED");
  }
}

function closeFeedbackModal(){
  document.getElementById("feedbackModalOverlay")?.remove();
}

function openFeedbackModal(type, triggerButton){
  closeFeedbackModal();

  const config = getFeedbackConfig(type);
  const overlay = document.createElement("div");
  overlay.className = "overlay open";
  overlay.id = "feedbackModalOverlay";
  overlay.innerHTML = `
    <div class="feedback-modal" role="dialog" aria-modal="true" aria-labelledby="feedbackModalTitle">
      <div class="feedback-modal-header">
        <div class="feedback-modal-badge">${config.badge}</div>
        <h3 id="feedbackModalTitle">${config.title}</h3>
        <p>${config.description}</p>
      </div>

      <label class="feedback-field">
        <span>${config.fieldLabel}</span>
        <textarea id="feedbackMessageInput" class="feedback-textarea" maxlength="2000" placeholder="${config.placeholder}"></textarea>
      </label>

      <div class="feedback-meta">
        <div class="feedback-meta-chip">Version ${APP_VERSION}</div>
      </div>

      <div id="feedbackStatus" class="feedback-status"></div>

      <div class="feedback-actions">
        <button id="feedbackCancelBtn" class="feedback-secondary-btn" type="button">Cancelar</button>
        <button id="feedbackSubmitBtn" class="feedback-primary-btn" type="button">Enviar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const messageInput = overlay.querySelector("#feedbackMessageInput");
  const status = overlay.querySelector("#feedbackStatus");
  const cancelBtn = overlay.querySelector("#feedbackCancelBtn");
  const submitBtn = overlay.querySelector("#feedbackSubmitBtn");

  if(messageInput){
    requestAnimationFrame(() => {
      messageInput.focus();
    });
  }

  const closeModal = () => closeFeedbackModal();

  cancelBtn?.addEventListener("click", closeModal);

  overlay.addEventListener("click", (event) => {
    if(event.target === overlay){
      closeModal();
    }
  });

  overlay.addEventListener("keydown", (event) => {
    if((event.metaKey || event.ctrlKey) && event.key === "Enter"){
      submitBtn?.click();
    }
  });

  submitBtn?.addEventListener("click", async () => {
    const message = messageInput?.value.trim() || "";

    status.classList.remove("success");

    if(!message){
      status.textContent = config.fieldLabel;
      messageInput?.focus();
      return;
    }

    submitBtn.disabled = true;
    cancelBtn.disabled = true;
    submitBtn.textContent = "Enviando...";
    status.textContent = "";

    try{
      await sendFeedbackEmail({
        type: config.typeLabel,
        message
      });

      submitBtn.textContent = "Enviado";
      status.textContent = "Enviado correctamente.";
      status.classList.add("success");
      updateHelpButtonSentState(triggerButton);
      showToast("Enviado");

      window.setTimeout(() => {
        closeModal();
      }, 550);
    }catch(err){
      console.error(err);
      submitBtn.disabled = false;
      cancelBtn.disabled = false;
      submitBtn.textContent = "Enviar";
      status.textContent = err.message === "FEEDBACK_ENDPOINT_NOT_CONFIGURED"
        ? "Falta configurar el Gmail de destino en app.js."
        : "No se pudo enviar. Intenta nuevamente.";
    }
  });
}

async function saveOfficeModePreferences(updates){
  if(!currentUser) return;

  await setDoc(
    doc(db,"users",currentUser.uid),
    updates,
    { merge:true }
  );
}

settingsBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  closeCornerMenu();
  openSettingsOverlay("account");
});

settingsCloseBtn?.addEventListener("click", closeSettingsOverlay);

settingsOverlay?.addEventListener("click", e=>{
  if(e.target === settingsOverlay){
    closeSettingsOverlay();
  }
});

settingsMobileNavToggle?.addEventListener("click", (e) => {
  e.stopPropagation();
  if(!isMobileSettingsViewport() || !settingsNav){
    return;
  }
  settingsNav.classList.toggle("mobile-open");
  syncMobileSettingsNavState();
});

settingsNavItems.forEach(item=>{
  item.addEventListener("click", ()=>{
    renderSettingsAccountPanel();
    syncTaskNotificationControls();
    openSettingsPanel(item.dataset.settingsPanel);
    if(isMobileSettingsViewport()){
      closeMobileSettingsNav();
    }
  });
});

reportErrorBtn?.addEventListener("click", () => {
  closeSettingsOverlay();
  openFeedbackModal("error", reportErrorBtn);
});

suggestFeatureBtn?.addEventListener("click", () => {
  closeSettingsOverlay();
  openFeedbackModal("suggestion", suggestFeatureBtn);
});

settingsAccountLogoutBtn?.addEventListener("click", async (e) => {
  e.stopPropagation();
  closeSettingsOverlay();

  if (!currentUser) {
    await signInWithPopup(auth, provider);
    return;
  }

  logoutOverlay.classList.add("open");
});

officeModeToggle?.addEventListener("change", async ()=>{
  try{
    if(officeModeToggle.checked){
      await enableOfficeMode();
    }else{
      await disableOfficeMode();
    }
  }catch(err){
    console.error(err);
    showToast("No se pudo actualizar el Modo Oficina");
    syncOfficeModeControls();
  }
});

officeModeTimeoutSelect?.addEventListener("change", async ()=>{
  officeModeTimeoutSeconds = normalizeOfficeModeTimeout(officeModeTimeoutSelect.value);
  syncOfficeModeControls();

  if(!currentUser) return;

  try{
    await saveOfficeModePreferences({
      officeModeTimeoutSeconds
    });

    if(officeModeEnabled){
      resetInactivityTimer();
    }
  }catch(err){
    console.error(err);
    showToast("No se pudo guardar el tiempo de bloqueo");
  }
});

taskNotificationsToggle?.addEventListener("change", async ()=>{
  if(!taskNotificationsToggle.checked){
    taskNotificationsEnabled = false;
    persistTaskNotificationsPreference();
    clearScheduledTaskNotifications();
    syncTaskNotificationControls();
    showToast("Notificaciones de tareas desactivadas");
    return;
  }

  const permission = await requestTaskNotificationPermissionIfNeeded();

  if(permission !== "granted"){
    taskNotificationsEnabled = false;
    persistTaskNotificationsPreference();
    clearScheduledTaskNotifications();
    syncTaskNotificationControls();

    if(permission === "denied"){
      showToast("Permiso de notificaciones bloqueado");
    }else if(permission === "unsupported"){
      showToast("Este navegador no soporta notificaciones");
    }else{
      showToast("Permiso de notificaciones no concedido");
    }
    return;
  }

  taskNotificationsEnabled = true;
  persistTaskNotificationsPreference();
  syncTaskNotificationControls();
  scheduleTaskNotifications();
  showToast("Notificaciones de tareas activadas");
});

document.addEventListener("keydown", e=>{
  if(e.key === "Escape" && document.getElementById("feedbackModalOverlay")){
    closeFeedbackModal();
    return;
  }

  if(e.key === "Escape" && settingsOverlay?.classList.contains("open")){
    closeSettingsOverlay();
  }
});

document.addEventListener("visibilitychange", ()=>{
  if(document.hidden) return;
  syncTaskNotificationControls();
  scheduleTaskNotifications();
});

window.addEventListener("resize", () => {
  updateGreeting(currentUser);
  if(!isMobileSettingsViewport()){
    closeMobileSettingsNav();
    return;
  }
  syncMobileSettingsNavState();
});

syncMobileSettingsNavState();
syncTaskNotificationControls();
window.setTimeout(() => {
  maybeAutoRequestTaskNotificationsPermission();
}, 500);
bindAutoNotificationPermissionFallback();


if(tasksViewBtn){
  tasksViewBtn.onclick = async ()=>{

    currentViewMode = "tasks";

    if(currentUser){
      await setDoc(
        doc(db,"users",currentUser.uid),
        { viewMode: currentViewMode },
        { merge:true }
      );
    }

    updateViewButtons();
    init();
  };
}

if(projectsViewBtn){
  projectsViewBtn.onclick = async ()=>{

    currentViewMode = "projects";

    if(currentUser){
      await setDoc(
        doc(db,"users",currentUser.uid),
        { viewMode: currentViewMode },
        { merge:true }
      );
    }

    updateViewButtons();
    init();
  };
}

let soundEnabled = JSON.parse(localStorage.getItem("soundEnabled"));
if (soundEnabled === null) soundEnabled = true;

async function save(){
  scheduleTaskNotifications();

  // 🔴 si no hay internet → guardar directo en local
  if(!navigator.onLine){

    localStorage.setItem(storeKey, JSON.stringify({
      tasks,
      projects,
      labels: taskLabels,
      projectOrder
    }));

    setStatusPending();
    return;
  }

  // 🟡 si hay usuario → intentar guardar en firebase
  if(currentUser){

    setStatusSaving();

    try{

      await updateDoc(
        doc(db,"users",currentUser.uid),
        {
          tasks: tasks,
          projects: projects,
          labels: taskLabels,
          projectOrder,
          viewMode: currentViewMode
        }
      );

      await setDoc(
        doc(db,"leaderboard",currentUser.uid),
        {
          name: currentUser.displayName,
          photo: currentUser.photoURL,
          level: player.level,
          exp: player.exp
        },
        { merge:true }
      );

      setStatusSaved();

    }catch(err){

      // fallback local
      localStorage.setItem(storeKey, JSON.stringify({
        tasks,
        projects,
        labels: taskLabels,
        projectOrder
      }));

      setStatusPending();

    }

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
  let changed = false;

  if(player.lastExpDate !== today){
    player.todayExpTasks = 0;
    player.lastExpDate = today;
    player.dailyLimitShown = false;
    player.updatedAt = Date.now();
    changed = true;
  }

  return changed;

}

function rewardExp(){

  resetDailyExpIfNeeded();

  if(player.todayExpTasks >= 5){
    return false;
  }

  player.exp += 100;
  player.todayExpTasks++;
  player.updatedAt = Date.now();

  updateLevel();
  return true;
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
  const dayName = dayIndex !== null ? DAYS[dayIndex].toUpperCase() : "";
  const dayNumber = date ? date.getDate() : "";
  const iso = date ? formatLocalDate(date) : undefined;

  const isProject = projectId !== null;
  const todayIso = formatLocalDate(new Date());
  const isTodayColumn = !isProject && iso === todayIso;
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
  if (isTodayColumn) {
    col.classList.add("today-highlight");
  } else {
    col.classList.add("not-today");
  }

  col.innerHTML = `
    <div class="col-head">
      <div class="col-head-main">
        <div class="col-topline ${date ? "has-date" : "no-date"} ${isTodayColumn ? "is-today" : ""}">
          <div class="col-title">${dayName}</div>
          ${date ? (isTodayColumn ? `<span class="pill today">Hoy</span>` : `<span class="col-topline-spacer" aria-hidden="true"></span>`) : ""}
          ${date ? `<span class="col-day-number" aria-hidden="true">${dayNumber}</span>` : ""}
        </div>
        <div class="col-sub">${date ? date.toLocaleDateString() : ""}</div>

        <div class="progress-wrapper">
          <div class="progress">
            <div class="progress-bar"></div>
          </div>
          <div class="progress-percent">0%</div>
        </div>
      </div>
    </div>

    <div class="list"></div>

    <div class="adder">
      <input class="input" placeholder="Nueva tarea…" enterkeyhint="done" />
    </div>
  `;

  const list = col.querySelector(".list");
  list.dataset.date = iso || "";
  list.dataset.project = projectId || "";

  // DRAG OVER LIST
  list.addEventListener("dragover", e => {
    if (projectDragActive) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    if (e.target.closest(".task")) return;
    const raw = e.dataTransfer.getData("text/plain");
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (
          (data.fromProject && !projectId) ||
          (!data.fromProject && projectId) ||
          (data.fromProject && projectId && data.fromProject !== projectId)
        ) {
          removeIndicator();
          return;
        }
      } catch {}
    }
    showIndicatorAtEnd();
  });

  // DRAG LEAVE
  list.addEventListener("dragleave", e => {
    if (!e.relatedTarget || !list.contains(e.relatedTarget)) {
      removeIndicator();
    }
  });

  // DROP EN LIST (al final)
  list.addEventListener("drop", e => {
    if (projectDragActive) return;
    e.preventDefault();
    e.stopPropagation();

    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;

    const data = JSON.parse(raw);
    if (
      (data.fromProject && !projectId) ||
      (!data.fromProject && projectId) ||
      (data.fromProject && projectId && data.fromProject !== projectId)
    ) {
      showToast("No es posible mover tareas entre proyectos.");
      if (draggedElement) draggedElement.style.opacity = "";
      removeIndicator();
      return;
    }
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

    // 🔥 usar el indicator si existe, si no insertar al final
    const indicator = list.querySelector(".drop-indicator");

    originList.splice(data.index, 1);

    let insertIndex = previewInsertIndex;

    if (insertIndex === null) {
      insertIndex = dayTasks.length;
    }
    if (!indicator) {
      previewInsertIndex = null;
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
    } else if (draggedElement) {
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

  list._showIndicator = showIndicator;
  list._showIndicatorAtEnd = showIndicatorAtEnd;
  list._removeIndicator = removeIndicator;

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
    closeTaskActionMenu();
    clearTaskMobileFocus();
    list.innerHTML = "";
    for (let i = dayTasks.length - 1; i >= 0; i--) {
      if (!dayTasks[i]) dayTasks.splice(i, 1);
    }
    dayTasks.forEach((task) => {
      normalizeTaskScheduling(task);
      if (isProject) {
        task.timeSlot = null;
        task.timeCategory = "all-day";
      }
    });
    sortTaskList(dayTasks);
    dayTasks.forEach((t, i) => {
      if (t.expGiven === undefined) t.expGiven = false;
      const el = document.createElement("div");
      el.className = "task" + (t.done ? " done" : "");
      if (isMobileTaskReorderEnabled()) {
        el.classList.add("task-reorder-ready");
      }
      el.draggable = !isTouchDevice;

      el.dataset.index = i;

      if (projectId !== null) {
        el.dataset.project = projectId;
      } else {
        el.dataset.date = iso;
      }

      //FUNCION DE DROP//
      el.addEventListener("drop", e => {
        if (projectDragActive) return;
        e.preventDefault();
        e.stopPropagation();

        const raw = e.dataTransfer.getData("text/plain");
        if (!raw) return;

        const data = JSON.parse(raw);
        if (
          (data.fromProject && !projectId) ||
          (!data.fromProject && projectId) ||
          (data.fromProject && projectId && data.fromProject !== projectId)
        ) {
          showToast("No es posible mover tareas entre proyectos.");
          if (draggedElement) draggedElement.style.opacity = "";
          removeIndicator();
          return;
        }
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
        if (projectDragActive) {
          e.preventDefault();
          return;
        }
        e.preventDefault();

        if (el === draggedElement) return;

        if (
          draggedElement?.dataset?.project &&
          projectId &&
          draggedElement.dataset.project !== projectId
        ) {
          removeIndicator();
          return;
        }

        if (
          draggedElement?.dataset?.project &&
          !projectId
        ) {
          removeIndicator();
          return;
        }

        if (
          !draggedElement?.dataset?.project &&
          projectId
        ) {
          removeIndicator();
          return;
        }

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
      const activeLabel = getTaskLabelById(t.tagId);
      const taskLabelMarkup = activeLabel
        ? `
        <div class="task-label-badge" style="--task-label-color:${activeLabel.color}">
          <button class="task-label-dot" type="button" aria-label="Quitar etiqueta"></button>
          <span>${activeLabel.name}</span>
        </div>
      `
        : "";
      
      el.innerHTML = `
        <div class="cb"></div>
        ${!isProject && t.timeSlot ? `<span class="task-time">${t.timeSlot}</span>` : ""}
        <div class="tmain">
          <div class="ttext">${t.text}</div>
          ${taskLabelMarkup}
        </div>
        <div class="task-actions-anchor">
          <div class="task-menu-stack">
            ${!isProject ? `
            <button class="task-menu-btn" data-action="schedule" type="button">
              <svg class="task-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="8"/>
                <path d="M12 8v4l3 2"/>
              </svg>
              <span>Definir horario</span>
              <svg class="task-menu-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m6 3 5 5-5 5"/>
              </svg>
            </button>
            ` : ""}
            <button class="task-menu-btn" data-action="tag" type="button">
              <svg class="task-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 10 10 20l-7-7V4h9l8 6Z"/>
                <circle cx="7.5" cy="8.5" r="1"/>
              </svg>
              <span>Etiquetar tarea</span>
              <svg class="task-menu-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m6 3 5 5-5 5"/>
              </svg>
            </button>
            ${!isProject ? `
            <button class="task-menu-btn" data-action="postpone" type="button">
              <svg class="task-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M5 9h4l-4 4h4"/>
                <path d="M11 13h4l-4 4h4"/>
                <path d="M17 9h2l-2 2h2"/>
              </svg>
              <span>Posponer tarea</span>
              <svg class="task-menu-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m6 3 5 5-5 5"/>
              </svg>
            </button>
            ` : ""}
            <button class="task-menu-btn danger" data-action="delete" type="button">
              <svg class="task-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 7h16"/>
                <path d="M9 7V5h6v2"/>
                <path d="M7 7l1 12h8l1-12"/>
                <path d="M10 11v5"/>
                <path d="M14 11v5"/>
              </svg>
              <span>Borrar tarea</span>
            </button>
          </div>
          ${!isProject ? `<div class="task-side-panel task-time-panel" aria-label="Seleccionar horario"></div>` : ""}
          <div class="task-side-panel task-tag-panel" aria-label="Seleccionar etiqueta"></div>
          <div class="task-side-panel task-tag-create-panel" aria-label="Crear etiqueta"></div>
          ${!isProject ? `<div class="task-side-panel task-postpone-panel" aria-label="Posponer tarea"></div>` : ""}
          <button class="icon task-action" aria-label="Editar tarea" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
          </button>
        </div>
      `;
      const textDiv = el.querySelector(".ttext");
      const taskLabelDot = el.querySelector(".task-label-dot");
      const timePill = el.querySelector(".task-time");

      if (timePill) {
        timePill.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openTaskTimeQuickEditor(el, t, render);
        });
      }

      if (taskLabelDot) {
        taskLabelDot.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!t.tagId) return;
          t.tagId = "";
          await save();
          render();
          renderMiniCalendar();
        });
      }

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
          forceMobileRenderRefresh(render);
          restoreMobileScrollSnapshot();
        }

        function cancelEdit() {
          render();
          renderMiniCalendar();
          forceMobileRenderRefresh(render);
          restoreMobileScrollSnapshot();
        }

        input.addEventListener("keydown", e => {
          if (e.key === "Enter") saveEdit();
          if (e.key === "Escape") cancelEdit();
        });

        input.addEventListener("blur", saveEdit);

      });


      if (isMobileTaskFocusEnabled()) {
        let longPressTimer = null;
        let pressStartX = 0;
        let pressStartY = 0;
        let longPressTriggered = false;

        const clearLongPressTimer = () => {
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        };

        el.addEventListener("touchstart", (e) => {
          if (!isMobileTaskFocusEnabled()) return;
          if (isMobileTaskReorderEnabled()) return;
          if (e.touches.length !== 1) return;
          if (e.target.closest(".cb") || e.target.closest(".task-actions-anchor")) return;
          if (activeTaskMobileFocus && activeTaskMobileFocus.taskElement !== el) return;

          longPressTriggered = false;
          pressStartX = e.touches[0].clientX;
          pressStartY = e.touches[0].clientY;

          clearLongPressTimer();
          longPressTimer = setTimeout(() => {
            longPressTriggered = true;
            showTaskMobileMenu(el, t, render);
          }, MOBILE_TASK_LONG_PRESS_MS);
        });

        el.addEventListener("touchmove", (e) => {
          if (!longPressTimer) return;

          const moveX = Math.abs(e.touches[0].clientX - pressStartX);
          const moveY = Math.abs(e.touches[0].clientY - pressStartY);

          if (moveX > MOBILE_TASK_MOVE_TOLERANCE || moveY > MOBILE_TASK_MOVE_TOLERANCE) {
            clearLongPressTimer();
          }
        });

        el.addEventListener("touchend", (e) => {
          if (longPressTriggered) {
            e.preventDefault();
          }
          clearLongPressTimer();
        });

        el.addEventListener("touchcancel", () => {
          clearLongPressTimer();
        });
      }

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

      if (isTouchDevice && (!isMobileViewport() || isMobileTaskReorderEnabled())) {

        let startY = 0;

        el.addEventListener("touchstart", (e) => {
          if (isMobileViewport() && !isMobileTaskReorderEnabled()) return;
          if (e.target.closest(".cb") || e.target.closest(".task-actions-anchor")) return;

          e.stopPropagation();

          startY = e.touches[0].clientY;
          draggedElement = el;

          if (isMobileViewport()) {
            createMobileTouchDragGhost(el, e.touches[0]);
            el.style.opacity = "0";
            el.style.pointerEvents = "none";
          }

          el.classList.add("dragging-touch");

        });

        el.addEventListener("touchmove", (e) => {
          if (isMobileViewport() && !isMobileTaskReorderEnabled()) return;

          e.preventDefault();

          if (!draggedElement) return;

          const dragData = {
            fromDate: iso,
            fromProject: projectId,
            index: i
          };

          const handleTouchDragPosition = (touch) => {
            const y = touch.clientY;
            updateMobileTouchDragGhostPosition(touch);

            const elementBelow = document.elementFromPoint(touch.clientX, y);
            const taskBelow = elementBelow?.closest(".task");
            const targetColumn = elementBelow?.closest(".col");
            const targetList =
              taskBelow?.closest(".list") ||
              elementBelow?.closest(".list") ||
              targetColumn?.querySelector(".list");

            if (!targetList) {
              removeActiveMobileDropIndicator();
              return;
            }

            const targetDate = targetList.dataset.date || null;
            const targetProject = targetList.dataset.project || null;

            if (!canDropTaskInTarget(dragData, targetDate, targetProject)) {
              showToast("No es posible mover tareas entre proyectos.");
              removeActiveMobileDropIndicator();
              return;
            }

            if (activeMobileDropList && activeMobileDropList !== targetList) {
              activeMobileDropList._removeIndicator?.();
            }

            activeMobileDropList = targetList;

            if (taskBelow && taskBelow !== draggedElement) {
              const rect = taskBelow.getBoundingClientRect();
              const percent = (y - rect.top) / rect.height;
              const targetIndex = parseInt(taskBelow.dataset.index, 10);
              const sameProjectTarget = !!targetProject && projectId === targetProject;
              const sameDateTarget = !!targetDate && iso === targetDate;
              const isSameContainer = sameProjectTarget || sameDateTarget;
              const previewPosition = getStablePreviewPosition(targetIndex, percent, i, isSameContainer);

              if (!previewPosition) {
                return;
              }

              const visualInsertIndex = previewPosition === "before"
                ? targetIndex
                : targetIndex + 1;

              let rawInsertIndex = visualInsertIndex;

              if (isSameContainer && i < rawInsertIndex) {
                rawInsertIndex--;
              }

              if (rawInsertIndex === i) {
                return;
              }

              previewInsertIndex = visualInsertIndex;
              mobileActiveDropTarget = {
                targetDate,
                targetProject,
                insertIndex: visualInsertIndex,
                list: targetList,
                taskIndex: targetIndex,
                sameContainer: isSameContainer
              };
              targetList._showIndicator?.(taskBelow, previewPosition);
            } else {
              const targetTasks = getDropTargetList(targetDate, targetProject);
              const taskElements = Array.from(targetList.querySelectorAll(".task"));
              const firstTask = targetList.querySelector(".task");
              const lastTask = taskElements[taskElements.length - 1];
              const isEmptyList = taskElements.length === 0;
              const isAboveFirstTask =
                firstTask &&
                y < firstTask.getBoundingClientRect().top;
              const isBelowLastTask =
                lastTask &&
                y > lastTask.getBoundingClientRect().bottom;

              if (!isEmptyList && !isAboveFirstTask && !isBelowLastTask) {
                removeActiveMobileDropIndicator();
                return;
              }

              const visualInsertIndex = isEmptyList
                ? 0
                : isAboveFirstTask
                ? 0
                : (targetTasks ? targetTasks.length : 0);
              let rawInsertIndex = visualInsertIndex;

              const sameProjectTarget = !!targetProject && projectId === targetProject;
              const sameDateTarget = !!targetDate && iso === targetDate;

              if ((sameProjectTarget || sameDateTarget) && i < rawInsertIndex) {
                rawInsertIndex--;
              }

              if (rawInsertIndex === i) {
                return;
              }

              previewInsertIndex = visualInsertIndex;
              mobileActiveDropTarget = {
                targetDate,
                targetProject,
                insertIndex: visualInsertIndex,
                list: targetList,
                taskIndex: isAboveFirstTask || isEmptyList ? 0 : (taskElements.length - 1),
                sameContainer: (!!targetProject && projectId === targetProject) || (!!targetDate && iso === targetDate)
              };
              if (isEmptyList) {
                targetList._showIndicatorAtEnd?.();
              } else if (isAboveFirstTask) {
                targetList._showIndicator?.(firstTask, "before");
              } else {
                targetList._showIndicatorAtEnd?.();
              }
            }
          };

          const touch = e.touches[0];
          handleTouchDragPosition(touch);
          updateMobileDragAutoscroll(touch, handleTouchDragPosition);

        });

        el.addEventListener("touchend", () => {
          if (isMobileViewport() && !isMobileTaskReorderEnabled()) return;

          const dropTarget = mobileActiveDropTarget;

          if (draggedElement && dropTarget) {
            const moved = moveTaskToTarget(
              {
                fromDate: iso,
                fromProject: projectId,
                index: i
              },
              dropTarget.targetDate,
              dropTarget.targetProject,
              dropTarget.insertIndex
            );

            if (moved) {
              save();
              init();
            }
          }

          draggedElement?.classList.remove("dragging-touch");

          if (draggedElement) {
            draggedElement.style.opacity = "";
            draggedElement.style.pointerEvents = "";
          }

          draggedElement = null;

          stopMobileDragAutoscroll();
          clearMobileTouchDragGhost();
          removeActiveMobileDropIndicator();
        });

        el.addEventListener("touchcancel", () => {
          draggedElement?.classList.remove("dragging-touch");

          if (draggedElement) {
            draggedElement.style.opacity = "";
            draggedElement.style.pointerEvents = "";
          }

          draggedElement = null;

          stopMobileDragAutoscroll();
          clearMobileTouchDragGhost();
          removeActiveMobileDropIndicator();
        });

      }

      const taskActionAnchor = el.querySelector(".task-actions-anchor");
      const taskActionButton = el.querySelector(".task-action");
      const taskScheduleButton = el.querySelector('[data-action="schedule"]');
      const taskTagButton = el.querySelector('[data-action="tag"]');
      const taskPostponeButton = el.querySelector('[data-action="postpone"]');
      const taskDeleteButton = el.querySelector('[data-action="delete"]');
      const taskTimePanel = el.querySelector(".task-time-panel");
      const taskTagPanel = el.querySelector(".task-tag-panel");
      const taskTagCreatePanel = el.querySelector(".task-tag-create-panel");
      const taskPostponePanel = el.querySelector(".task-postpone-panel");

      const persistTaskCompletion = async (
        nextDone,
        {
          allowReward = true,
          triggerSounds = true,
          moveToBottomOnComplete = true,
          cbElement = null
        } = {}
      ) => {
        const wasDone = t.done;
        if (wasDone === nextDone) {
          return false;
        }

        let shouldSavePlayer = false;
        let expShown = false;

        t.done = nextDone;

        if (allowReward) {
          shouldSavePlayer = resetDailyExpIfNeeded() || shouldSavePlayer;

          if (t.done && !t.expGiven) {
            t.expGiven = true;

            if (player.todayExpTasks < 5) {
              const rewarded = rewardExp();

              if (rewarded) {
                shouldSavePlayer = true;
                expShown = true;
                if (cbElement) showExpGain(cbElement, 100);
              }
            } else if (!player.dailyLimitShown) {
              player.dailyLimitShown = true;
              shouldSavePlayer = true;
              showToast("Límite diario de EXP alcanzado");
            }
          }
        }

        const total = dayTasks.length;
        const completed = dayTasks.filter((task) => task.done).length;
        const dayCompleted = total > 0 && completed === total;

        if (triggerSounds && !wasDone && t.done && soundEnabled) {
          if (total > 0 && completed === total) {
            playDayCompleteSound();
            launchConfetti();
          } else {
            playRewardSound();
          }
        }

        t.done ? el.classList.add("done") : el.classList.remove("done");

        if (!wasDone && t.done && moveToBottomOnComplete) {
          const currentIndex = dayTasks.indexOf(t);
          const isLast = currentIndex === dayTasks.length - 1;

          if (currentIndex !== -1 && !isLast) {
            const taskToMove = dayTasks.splice(currentIndex, 1)[0];
            dayTasks.push(taskToMove);
          }

          if (!isLast) {
            const delay = expShown ? 900 : 0;

            setTimeout(async () => {
              await save();
              if (shouldSavePlayer) await savePlayer();
              render();
              renderMiniCalendar();
              checkAchievements({ dateContext: dayCompleted ? iso : null });
            }, delay);
            return true;
          }
        }

        await save();
        if (shouldSavePlayer) await savePlayer();
        render();
        renderMiniCalendar();
        checkAchievements({ dateContext: dayCompleted ? iso : null });
        return true;
      };

      taskActionButton.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isMobileTaskFocusEnabled()) {
          showTaskMobileMenu(el, t, render);
          return;
        }
        toggleTaskActionMenu(el, taskActionAnchor);
      };

      taskActionAnchor.querySelectorAll(".task-menu-btn").forEach((button) => {
        button.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
      });

      if (taskScheduleButton && taskTimePanel) {
        const visibleTimeOptions = TASK_TIME_OPTIONS.filter((slot) => {
          if (!isTodayColumn) return true;
          const [hours, minutes] = slot.split(":").map(Number);
          const slotMinutes = (hours * 60) + minutes;
          const now = new Date();
          const currentMinutes = (now.getHours() * 60) + now.getMinutes();
          return slotMinutes >= currentMinutes;
        });

        const scheduleOptions = t.timeSlot
          ? [{ label: "Todo el dia", value: "" }, ...visibleTimeOptions.map((slot) => ({ label: slot, value: slot }))]
          : visibleTimeOptions.map((slot) => ({ label: slot, value: slot }));

      taskTimePanel.innerHTML = scheduleOptions.map((option) => `
          <button
            class="task-side-option${option.value === "" ? (!t.timeSlot ? " active" : "") : (t.timeSlot === option.value ? " active" : "")}"
            type="button"
            data-time-slot="${option.value}"
          >${option.label}</button>
        `).join("");
        bindMobileTapToClick(taskTimePanel);

        taskScheduleButton.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          taskActionAnchor.classList.remove("tag-open");
          taskActionAnchor.classList.remove("tag-create-open");
          taskActionAnchor.classList.remove("postpone-open");
          taskActionAnchor.classList.toggle("schedule-open");
          positionTaskActionMenu(taskActionAnchor);
        };

        taskTimePanel.querySelectorAll(".task-side-option").forEach((option) => {
          option.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const selected = option.dataset.timeSlot || null;
            t.timeSlot = selected;
            t.timeCategory = selected ? "scheduled" : "all-day";
            closeTaskActionMenu();
            sortTaskList(dayTasks);
            await save();
            render();
            renderMiniCalendar();
            checkAchievements();
          });
        });
      }

      if (taskTagButton && taskTagPanel && taskTagCreatePanel) {
        const renderTagPanel = () => {
          const labelOptions = taskLabels.map((label) => `
            <div class="task-tag-row">
              <button
                class="task-side-option task-tag-option${t.tagId === label.id ? " active" : ""}"
                type="button"
                data-label-id="${label.id}"
              >
                <span class="task-side-option-dot" style="--task-label-color:${label.color}"></span>
                <span>${label.name}</span>
              </button>
              <button
                class="task-tag-delete"
                type="button"
                data-label-delete="${label.id}"
                aria-label="Borrar etiqueta ${label.name}"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M4 7h16"/>
                  <path d="M9 7V5h6v2"/>
                  <path d="M7 7l1 12h8l1-12"/>
                  <path d="M10 11v5"/>
                  <path d="M14 11v5"/>
                </svg>
              </button>
            </div>
          `).join("");

          const createButtonMarkup = `
            <button class="task-side-option task-tag-create-trigger" type="button" data-create-label="true">
              <span class="task-side-option-plus">+</span>
              <span>Crear etiqueta</span>
            </button>
          `;

        taskTagPanel.innerHTML = labelOptions
          ? `${labelOptions}${createButtonMarkup}`
          : createButtonMarkup;
        bindMobileTapToClick(taskTagPanel);

          taskTagPanel.querySelectorAll("[data-label-id]").forEach((option) => {
            option.addEventListener("click", async (e) => {
              e.preventDefault();
              e.stopPropagation();
              t.tagId = option.dataset.labelId || "";
              closeTaskActionMenu();
              await save();
              render();
              renderMiniCalendar();
            });
          });

          taskTagPanel.querySelectorAll("[data-label-delete]").forEach((button) => {
            button.addEventListener("click", async (e) => {
              e.preventDefault();
              e.stopPropagation();
              const labelId = button.dataset.labelDelete || "";
              if (!labelId) return;
              const label = getTaskLabelById(labelId);
              const labelName = label?.name || "esta etiqueta";
              const shouldDelete = confirm(`¿Borrar "${labelName}"? Esta etiqueta se quitará de todas las tareas.`);
              if (!shouldDelete) return;
              removeTaskLabelEverywhere(labelId);
              closeTaskActionMenu();
              await save();
              render();
              renderMiniCalendar();
            });
          });

          const createTrigger = taskTagPanel.querySelector("[data-create-label]");
          if (createTrigger) {
            createTrigger.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              renderCreateTagPanel();
              taskActionAnchor.classList.add("tag-open");
              taskActionAnchor.classList.add("tag-create-open");
              positionTaskActionMenu(taskActionAnchor);
              taskTagCreatePanel.querySelector(".task-tag-input")?.focus();
            });
          }
        };

        const renderCreateTagPanel = () => {
          const selectedColor = taskTagCreatePanel.dataset.selectedColor || TASK_LABEL_COLORS[0];
          const draftName = taskTagCreatePanel.dataset.draftName || "";

          taskTagCreatePanel.innerHTML = `
            <div class="task-tag-create-shell">
              <div class="task-tag-create-header">
                <input class="task-tag-input" type="text" maxlength="24" placeholder="Nombre de etiqueta">
                <button class="task-side-action" type="button" aria-label="Guardar etiqueta">✓</button>
              </div>
              <div class="task-color-grid">
                ${TASK_LABEL_COLORS.map((color) => `
                  <button
                    class="task-color-option${color === selectedColor ? " active" : ""}"
                    type="button"
                    data-color="${color}"
                    style="--task-label-color:${color}"
                    aria-label="Seleccionar color ${color}"
                  ></button>
                `).join("")}
          </div>
        </div>
      `;

          bindMobileTapToClick(taskTagCreatePanel);

          const input = taskTagCreatePanel.querySelector(".task-tag-input");
          const saveButton = taskTagCreatePanel.querySelector(".task-side-action");
          if (input) input.value = draftName;

          input?.addEventListener("input", () => {
            taskTagCreatePanel.dataset.draftName = input.value;
          });

          taskTagCreatePanel.querySelectorAll(".task-color-option").forEach((button) => {
            button.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              taskTagCreatePanel.dataset.draftName = input?.value || "";
              taskTagCreatePanel.dataset.selectedColor = button.dataset.color || TASK_LABEL_COLORS[0];
              renderCreateTagPanel();
            });
          });

          const submitNewLabel = async () => {
            const name = formatTaskLabelName(input?.value || "");
            const color = taskTagCreatePanel.dataset.selectedColor || TASK_LABEL_COLORS[0];

            if (!name) {
              input?.focus();
              return;
            }

            const createdLabel = createTaskLabel(name, color);
            taskTagCreatePanel.dataset.draftName = "";
            t.tagId = createdLabel.id;
            closeTaskActionMenu();
            await save();
            render();
            renderMiniCalendar();
          };

          saveButton?.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await submitNewLabel();
          });

          input?.addEventListener("keydown", async (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              await submitNewLabel();
            }
          });
        };

        renderTagPanel();

        taskTagButton.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          renderTagPanel();
          taskActionAnchor.classList.remove("schedule-open");
          taskActionAnchor.classList.remove("postpone-open");
          taskActionAnchor.classList.remove("tag-create-open");
          taskActionAnchor.classList.toggle("tag-open");
          positionTaskActionMenu(taskActionAnchor);
        };
      }

      if (taskPostponeButton && taskPostponePanel) {
        const postponeOptions = [
          { label: "Posponer para manana", days: 1 },
          { label: "Posponer por 2 dias", days: 2 },
          { label: "Posponer por una semana", days: 7 }
        ];

        taskPostponePanel.innerHTML = postponeOptions.map((option) => `
          <button
            class="task-side-option"
            type="button"
            data-postpone-days="${option.days}"
          >${option.label}</button>
        `).join("");
        bindMobileTapToClick(taskPostponePanel);

        taskPostponeButton.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          taskActionAnchor.classList.remove("tag-open");
          taskActionAnchor.classList.remove("tag-create-open");
          taskActionAnchor.classList.remove("schedule-open");
          taskActionAnchor.classList.toggle("postpone-open");
          positionTaskActionMenu(taskActionAnchor);
        };

        taskPostponePanel.querySelectorAll(".task-side-option").forEach((option) => {
          option.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const daysToMove = Number(option.dataset.postponeDays || 0);
            const targetIso = addDaysToIsoDate(iso, daysToMove);
            if (!targetIso) return;

            closeTaskActionMenu();
            const moved = moveTaskToTarget(
              {
                fromDate: iso,
                fromProject: null,
                index: i
              },
              targetIso,
              null
            );

            if (!moved) return;

            await save();
            init();
            renderMiniCalendar();
          });
        });
      }

      taskDeleteButton.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeTaskActionMenu();

        if (soundEnabled) {
          playDeleteTaskSound();
        }

        dayTasks.splice(i,1);

        await save();
        render();
        renderMiniCalendar();

        updateDayModalTaskCount(iso);
      };

      el.querySelector(".cb").onclick = async () => {
        const cb = el.querySelector(".cb");
        await persistTaskCompletion(!t.done, {
          cbElement: cb,
        });
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

  function addTaskFromInput() {
    if (!input.value.trim()) return false;

    let text = input.value.trim();

    if (/^[a-záéíóúñ]/.test(text)) {
      text = text.charAt(0).toUpperCase() + text.slice(1);
    }

    const newTask = { text, done:false, expGiven:false, timeSlot:null, timeCategory:"all-day", tagId:"" };
    const firstDoneIndex = dayTasks.findIndex(t => t.done);

    if(firstDoneIndex === -1){
      dayTasks.push(newTask);
    }else{
      dayTasks.splice(firstDoneIndex, 0, newTask);
    }

    sortTaskList(dayTasks);

    if (iso) {
      updateDayModalTaskCount(iso);
    }

    if (soundEnabled) {
      playAddTaskSound();
    }

    input.value = "";
    save();
    render();
    return true;
  }

  input.addEventListener("beforeinput", e => {
    if (e.inputType === "insertLineBreak") {
      e.preventDefault();
      addTaskFromInput();
    }
  });

  input.addEventListener("keydown", e => {

    if (e.key === "Enter") {
      e.preventDefault();
    }

    if (e.key === "Enter") {
      addTaskFromInput();
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

function clearProjectDragState() {
  projectDragActive = false;
  draggedProjectId = null;
  if (draggedProjectElement) {
    draggedProjectElement.classList.remove("project-dragging");
  }
  draggedProjectElement = null;
  document.querySelectorAll(".project-drop-target").forEach((el) => {
    el.classList.remove("project-drop-target");
  });
}

function swapProjectOrder(sourceId, targetId) {
  projectOrder = reconcileProjectOrder(projectOrder, projects);
  const sourceIndex = projectOrder.indexOf(sourceId);
  const targetIndex = projectOrder.indexOf(targetId);
  if (sourceIndex === -1 || targetIndex === -1) return;

  [projectOrder[sourceIndex], projectOrder[targetIndex]] = [
    projectOrder[targetIndex],
    projectOrder[sourceIndex]
  ];

  save();
  renderProjectsView();
}

function attachProjectDragHandlers(column, projectId) {
  if (isTouchDevice) return;

  column.draggable = true;
  column.dataset.projectId = projectId;

  column.addEventListener("dragstart", (e) => {
    if (e.target.closest(".task")) return;
    if (e.target.closest(".adder")) return;
    if (e.target.closest(".edit-input")) return;
    if (e.target.closest(".task-actions-anchor")) return;

    projectDragActive = true;
    draggedProjectId = projectId;
    draggedProjectElement = column;
    column.classList.add("project-dragging");

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({
      type: "project",
      id: projectId
    }));
  });

  column.addEventListener("dragend", () => {
    clearProjectDragState();
  });

  column.addEventListener("dragover", (e) => {
    if (!projectDragActive) return;
    if (draggedProjectId === projectId) return;
    e.preventDefault();
    column.classList.add("project-drop-target");
  });

  column.addEventListener("dragleave", (e) => {
    if (!column.contains(e.relatedTarget)) {
      column.classList.remove("project-drop-target");
    }
  });

  column.addEventListener("drop", (e) => {
    if (!projectDragActive) return;
    e.preventDefault();
    e.stopPropagation();

    if (draggedProjectId && draggedProjectId !== projectId) {
      swapProjectOrder(draggedProjectId, projectId);
    }

    clearProjectDragState();
  });
}

function renderProjectsView(){

  clearProjectDragState();
  board.innerHTML = "";

  projectOrder = reconcileProjectOrder(projectOrder, projects);

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

    const title = await openProjectNameDialog();

    if(!title) return;

    const id = "p_" + Date.now();

    projects[id] = {
      title,
      tasks: [],
      createdAt: Date.now()
    };

    projectOrder = reconcileProjectOrder(projectOrder, projects);

    await save();

    renderProjectsView();
    checkAchievements();

  };


  // RENDER PROYECTOS
  projectOrder.forEach((id) => {
    const project = projects[id];
    if (!project) return;

    const column = createProjectColumn(id);
    attachProjectDragHandlers(column, id);

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
    const topLine = column.querySelector(".col-topline");

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

    const deleteHost = topLine || titleRow;
    if (deleteHost) {
      deleteHost.appendChild(deleteBtn);
    }

    deleteBtn.onclick = async (e)=>{
      e.stopPropagation();

      draggedElement = null;
      previewInsertIndex = null;

      const confirmDelete = await openProjectDeleteDialog(project.title);

      if(!confirmDelete) return;

      delete projects[id];
      projectOrder = projectOrder.filter((projectId) => projectId !== id);

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
  checkAchievements();

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
    scheduleTaskNotifications();
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
  scheduleTaskNotifications();
}

function closeProjectDialogOverlay(){
  document.getElementById("projectDialogOverlay")?.remove();
}

function openProjectNameDialog(){
  closeProjectDialogOverlay();

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "overlay open";
    overlay.id = "projectDialogOverlay";
    overlay.innerHTML = `
      <div class="project-dialog-modal" role="dialog" aria-modal="true" aria-labelledby="projectDialogTitle">
        <div class="project-dialog-icon">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h3.2c.5 0 1 .2 1.3.6l1 1.1c.3.3.8.6 1.3.6H17.5A2.5 2.5 0 0 1 20 9.8v6.7a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M12 10.5v5M9.5 13h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </div>
        <h3 id="projectDialogTitle">Nuevo proyecto</h3>
        <p>Elige un nombre para organizar tus tareas dentro de una nueva columna.</p>

        <label class="project-dialog-field" for="projectDialogNameInput">
          Nombre del proyecto
        </label>
        <input id="projectDialogNameInput" class="project-dialog-input" type="text" maxlength="64" placeholder="Ejemplo: Trabajo, Universidad, Personal">
        <div id="projectDialogError" class="project-dialog-error"></div>

        <div class="project-dialog-actions">
          <button id="projectDialogCancel" class="btn-cancel" type="button">Cancelar</button>
          <button id="projectDialogConfirm" class="project-dialog-primary" type="button">Crear proyecto</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = overlay.querySelector("#projectDialogNameInput");
    const errorEl = overlay.querySelector("#projectDialogError");
    const cancelBtn = overlay.querySelector("#projectDialogCancel");
    const confirmBtn = overlay.querySelector("#projectDialogConfirm");
    let settled = false;
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        finish(null);
      }
    };

    const finish = (value = null) => {
      if (settled) return;
      settled = true;
      document.removeEventListener("keydown", handleEscape);
      overlay.remove();
      resolve(value);
    };

    const submit = () => {
      const value = input?.value.trim() || "";
      if (!value) {
        if (errorEl) errorEl.textContent = "Escribe un nombre para continuar.";
        input?.focus();
        return;
      }

      finish(value);
    };

    requestAnimationFrame(() => {
      input?.focus();
    });

    input?.addEventListener("input", () => {
      if (errorEl) errorEl.textContent = "";
    });

    cancelBtn?.addEventListener("click", () => finish(null));
    confirmBtn?.addEventListener("click", submit);

    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        finish(null);
      }
    });

    document.addEventListener("keydown", handleEscape);
  });
}

function openProjectDeleteDialog(projectTitle){
  closeProjectDialogOverlay();

  return new Promise((resolve) => {
    const safeTitle = (projectTitle || "este proyecto").trim();
    const overlay = document.createElement("div");
    overlay.className = "overlay open";
    overlay.id = "projectDialogOverlay";
    overlay.innerHTML = `
      <div class="project-dialog-modal project-dialog-modal-danger" role="dialog" aria-modal="true" aria-labelledby="projectDeleteDialogTitle">
        <div class="project-dialog-icon project-dialog-icon-danger">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M4 7h16M9 7V5h6v2M7 7l1 12h8l1-12M10 11v5M14 11v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h3 id="projectDeleteDialogTitle">Eliminar proyecto</h3>
        <p>Se eliminará <strong id="projectDeleteName"></strong> y todas sus tareas. Esta acción no se puede deshacer.</p>

        <div class="project-dialog-actions">
          <button id="projectDeleteCancel" class="btn-cancel" type="button">Cancelar</button>
          <button id="projectDeleteConfirm" class="project-dialog-danger" type="button">Eliminar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const cancelBtn = overlay.querySelector("#projectDeleteCancel");
    const confirmBtn = overlay.querySelector("#projectDeleteConfirm");
    const projectName = overlay.querySelector("#projectDeleteName");
    let settled = false;
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        finish(false);
      }
    };

    if (projectName) {
      projectName.textContent = safeTitle;
    }

    const finish = (confirmed = false) => {
      if (settled) return;
      settled = true;
      document.removeEventListener("keydown", handleEscape);
      overlay.remove();
      resolve(confirmed);
    };

    cancelBtn?.addEventListener("click", () => finish(false));
    confirmBtn?.addEventListener("click", () => finish(true));

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        finish(false);
      }
    });

    document.addEventListener("keydown", handleEscape);
  });
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

async function showTaskMobileMenu(taskElement, taskData, render){

  if (!isMobileTaskFocusEnabled()) return;

  closeTaskActionMenu();
  clearTaskMobileFocus();
  await closeMobileKeyboardIfNeeded();
  captureMobileScrollSnapshot();
  await scrollTaskIntoViewForMobile(taskElement);

  if (!isMobileTaskFocusEnabled()) return;

  const overlay = document.createElement("div");
  overlay.id = "taskMobileOverlay";

  const clone = taskElement.cloneNode(true);
  clone.id = "taskMobileFocusClone";
  clone.classList.add("task-mobile-focus");
  clone.classList.add("task-mobile-focus-clone");

  const menu = document.createElement("div");
  menu.id = "taskMobileMenu";
  const isProjectTask = !!taskElement.dataset.project;
  const mainMenuMarkup = `
    <button class="task-menu-btn" data-action="edit" type="button">
      <svg class="task-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
      </svg>
      <span>Editar</span>
    </button>
    <button class="task-menu-btn" data-action="reorder" type="button">
      <svg class="task-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M8 5h11"/>
        <path d="M8 12h11"/>
        <path d="M8 19h11"/>
        <path d="M5 4v16"/>
        <path d="m3 6 2-2 2 2"/>
        <path d="m3 18 2 2 2-2"/>
      </svg>
      <span>Reordenar</span>
    </button>
    ${!isProjectTask ? `
    <button class="task-menu-btn" data-action="schedule" type="button">
      <svg class="task-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="8"/>
        <path d="M12 8v4l3 2"/>
      </svg>
      <span>Definir horario</span>
      <svg class="task-menu-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m6 3 5 5-5 5"/>
      </svg>
    </button>
    ` : ""}
    <button class="task-menu-btn" data-action="tag" type="button">
      <svg class="task-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20 10 10 20l-7-7V4h9l8 6Z"/>
        <circle cx="7.5" cy="8.5" r="1"/>
      </svg>
      <span>Etiquetar tarea</span>
      <svg class="task-menu-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m6 3 5 5-5 5"/>
      </svg>
    </button>
    ${!isProjectTask ? `
    <button class="task-menu-btn" data-action="postpone" type="button">
      <svg class="task-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 9h4l-4 4h4"/>
        <path d="M11 13h4l-4 4h4"/>
        <path d="M17 9h2l-2 2h2"/>
      </svg>
      <span>Posponer tarea</span>
      <svg class="task-menu-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m6 3 5 5-5 5"/>
      </svg>
    </button>
    ` : ""}
    <button class="task-menu-btn danger" data-action="delete" type="button">
      <svg class="task-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 7h16"/>
        <path d="M9 7V5h6v2"/>
        <path d="M7 7l1 12h8l1-12"/>
        <path d="M10 11v5"/>
        <path d="M14 11v5"/>
      </svg>
      <span>Borrar tarea</span>
    </button>
  `;
  menu.innerHTML = mainMenuMarkup;

  document.body.appendChild(overlay);
  document.body.appendChild(clone);
  document.body.appendChild(menu);

  taskElement.classList.add("task-mobile-focus-source");

  const positionFocusElements = () => {
    const rect = taskElement.getBoundingClientRect();
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;

    const menuHeight = menu.offsetHeight;
    const baseMaxMenuSpace = Math.max(160, window.innerHeight - 48);
    let menuTop = rect.bottom + 12;

    if (menu.classList.contains("submenu-open")) {
      const padding = 16;
      const minPanelHeight = 200;
      const spaceBelow = window.innerHeight - menuTop - padding;
      const spaceAbove = rect.top - padding;

      if (spaceBelow < minPanelHeight && spaceAbove > spaceBelow) {
        menuTop = Math.max(padding, rect.top - menuHeight - 12);
      }

      const availableSpace = Math.max(minPanelHeight, window.innerHeight - menuTop - padding);
      menu.style.maxHeight = `${availableSpace}px`;
      menu.style.overflowY = "auto";
    } else {
      menu.style.maxHeight = `${baseMaxMenuSpace}px`;
      menu.style.overflowY = "auto";
      const maxTop = window.innerHeight - menuHeight - 24;
      if (menuTop > maxTop) {
        menuTop = Math.max(12, rect.top - menuHeight - 12);
      }
    }

    const menuLeft = menu.classList.contains("submenu-open")
      ? Math.min(Math.max(rect.left + rect.width / 2, 24), window.innerWidth - 24)
      : Math.min(
          Math.max(rect.left + rect.width / 2, 24),
          window.innerWidth - 24
        );

    menu.style.left = `${menuLeft}px`;
    menu.style.top = `${menuTop}px`;
  };

  const cleanup = ({ skipRefresh = false, keepScroll = false } = {}) => {
    clearTaskMobileFocus();
    window.removeEventListener("resize", handleViewportChange);
    window.removeEventListener("scroll", handleViewportChange, true);
    if (!keepScroll) {
      restoreMobileScrollSnapshot();
    }
    if (!skipRefresh) {
      forceMobileRenderRefresh(render);
      if (!keepScroll) {
        restoreMobileScrollSnapshot();
      }
    }
  };

  const handleViewportChange = () => {
    if (!activeTaskMobileFocus || activeTaskMobileFocus.taskElement !== taskElement) return;

    if (!isMobileTaskFocusEnabled()) {
      cleanup();
      return;
    }

    positionFocusElements();
  };

  activeTaskMobileFocus = {
    taskElement,
    menuElement: menu,
    overlayElement: overlay,
    cloneElement: clone
  };

  positionFocusElements();

  requestAnimationFrame(() => {
    overlay.classList.add("visible");
    clone.classList.add("visible");
    menu.classList.add("visible");
  });

  overlay.addEventListener("touchstart", cleanup);
  overlay.addEventListener("click", cleanup);
  clone.addEventListener("touchstart", e => e.stopPropagation());
  clone.addEventListener("click", e => e.stopPropagation());
  menu.addEventListener("touchstart", e => e.stopPropagation());
  menu.addEventListener("click", e => e.stopPropagation());

  const renderMenuView = (markup, onMount) => {
    menu.innerHTML = markup;
    bindMobileTapToClick(menu);
    menu.classList.toggle("submenu-open", !!menu.querySelector(".task-side-panel"));
    positionFocusElements();
    onMount?.();
  };

  const showMainMenu = () => {
    renderMenuView(mainMenuMarkup, bindMainMenuActions);
  };

  const showSubmenuHeader = (title) => `
    <button class="task-menu-btn" data-action="back" type="button">
      <svg class="task-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
      <span>${title}</span>
    </button>
  `;

  const removeMobileTaskFromSource = () => {
    const sourceProjectId = taskElement.dataset.project || null;
    const sourceDate = taskElement.dataset.date || null;
    const sourceList = sourceProjectId
      ? projects[sourceProjectId]?.tasks
      : tasks[sourceDate];

    if (!Array.isArray(sourceList)) return false;

    let taskIndex = sourceList.indexOf(taskData);

    if (taskIndex === -1) {
      const renderedIndex = Number(taskElement.dataset.index);
      if (
        Number.isInteger(renderedIndex) &&
        renderedIndex >= 0 &&
        renderedIndex < sourceList.length &&
        sourceList[renderedIndex] === taskData
      ) {
        taskIndex = renderedIndex;
      }
    }

    if (taskIndex === -1) {
      taskIndex = sourceList.findIndex((task) => {
        if (task === taskData) return true;
        if (!task || !taskData) return false;
        return (
          task.text === taskData.text &&
          !!task.done === !!taskData.done &&
          (task.timeSlot || null) === (taskData.timeSlot || null)
        );
      });
    }

    if (taskIndex === -1) return false;

    sourceList.splice(taskIndex, 1);

    if (!sourceProjectId && sourceDate && sourceList.length === 0) {
      delete tasks[sourceDate];
    }

    return true;
  };

  const openMobileSchedule = () => {
    const todayIso = formatLocalDate(new Date());
    const taskIso = taskElement.dataset.date || "";
    const isToday = taskIso && taskIso === todayIso;
    const visibleTimeOptions = TASK_TIME_OPTIONS.filter((slot) => {
      if (!isToday) return true;
      const [hours, minutes] = slot.split(":").map(Number);
      const slotMinutes = (hours * 60) + minutes;
      const now = new Date();
      const currentMinutes = (now.getHours() * 60) + now.getMinutes();
      return slotMinutes >= currentMinutes;
    });

    const scheduleOptions = taskData.timeSlot
      ? [{ label: "Todo el dia", value: "" }, ...visibleTimeOptions.map((slot) => ({ label: slot, value: slot }))]
      : visibleTimeOptions.map((slot) => ({ label: slot, value: slot }));

    const optionsMarkup = scheduleOptions.map((option) => `
      <button
        class="task-side-option${option.value === "" ? (!taskData.timeSlot ? " active" : "") : (taskData.timeSlot === option.value ? " active" : "")}"
        type="button"
        data-time-slot="${option.value}"
      >${option.label}</button>
    `).join("");

    renderMenuView(`
      ${showSubmenuHeader("Definir horario")}
      <div class="task-side-panel task-time-panel task-mobile-subpanel">
        ${optionsMarkup}
      </div>
    `, () => {
      menu.querySelector('[data-action="back"]')?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        showMainMenu();
      });

      menu.querySelectorAll("[data-time-slot]").forEach((option) => {
        option.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const selected = option.dataset.timeSlot || null;
          taskData.timeSlot = selected;
          taskData.timeCategory = selected ? "scheduled" : "all-day";
          cleanup();
          await save();
          render();
          renderMiniCalendar();
          checkAchievements();
        });
      });
    });
  };

  const openMobileTags = () => {
    const renderTagList = () => {
      const labelOptions = taskLabels.map((label) => `
        <div class="task-tag-row">
          <button
            class="task-side-option task-tag-option${taskData.tagId === label.id ? " active" : ""}"
            type="button"
            data-label-id="${label.id}"
          >
            <span class="task-side-option-dot" style="--task-label-color:${label.color}"></span>
            <span>${label.name}</span>
          </button>
          <button
            class="task-tag-delete"
            type="button"
            data-label-delete="${label.id}"
            aria-label="Borrar etiqueta ${label.name}"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 7h16"/>
              <path d="M9 7V5h6v2"/>
              <path d="M7 7l1 12h8l1-12"/>
              <path d="M10 11v5"/>
              <path d="M14 11v5"/>
            </svg>
          </button>
        </div>
      `).join("");

      const createButtonMarkup = `
        <button class="task-side-option task-tag-create-trigger" type="button" data-create-label="true">
          <span class="task-side-option-plus">+</span>
          <span>Crear etiqueta</span>
        </button>
      `;

      renderMenuView(`
        ${showSubmenuHeader("Etiquetar tarea")}
        <div class="task-side-panel task-tag-panel task-mobile-subpanel">
          ${labelOptions ? `${labelOptions}${createButtonMarkup}` : createButtonMarkup}
        </div>
      `, () => {
        menu.querySelector('[data-action="back"]')?.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          showMainMenu();
        });

        menu.querySelectorAll("[data-label-id]").forEach((option) => {
          option.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            taskData.tagId = option.dataset.labelId || "";
            cleanup();
            await save();
            render();
            renderMiniCalendar();
          });
        });

        menu.querySelectorAll("[data-label-delete]").forEach((button) => {
          button.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const labelId = button.dataset.labelDelete || "";
            if (!labelId) return;
            const label = getTaskLabelById(labelId);
            const labelName = label?.name || "esta etiqueta";
            const shouldDelete = confirm(`¿Borrar "${labelName}"? Esta etiqueta se quitará de todas las tareas.`);
            if (!shouldDelete) return;
            removeTaskLabelEverywhere(labelId);
            cleanup();
            await save();
            render();
            renderMiniCalendar();
          });
        });

        menu.querySelector("[data-create-label]")?.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          renderCreateTagPanel();
        });
      });
    };

    const renderCreateTagPanel = () => {
      renderMenuView(`
        ${showSubmenuHeader("Crear etiqueta")}
        <div class="task-side-panel task-tag-create-panel task-mobile-subpanel">
          <div class="task-tag-create-shell">
            <div class="task-tag-create-header">
              <input class="task-tag-input" type="text" maxlength="24" placeholder="Nombre de etiqueta">
              <button class="task-side-action" type="button" aria-label="Guardar etiqueta">✓</button>
            </div>
            <div class="task-color-grid">
              ${TASK_LABEL_COLORS.map((color, index) => `
                <button
                  class="task-color-option${index === 0 ? " active" : ""}"
                  type="button"
                  data-color="${color}"
                  style="--task-label-color:${color}"
                  aria-label="Seleccionar color ${color}"
                ></button>
              `).join("")}
            </div>
          </div>
        </div>
      `, () => {
        menu.querySelector('[data-action="back"]')?.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          renderTagList();
        });

        let selected = TASK_LABEL_COLORS[0];
        menu.querySelectorAll(".task-color-option").forEach((button) => {
          button.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            selected = button.dataset.color || TASK_LABEL_COLORS[0];
            menu.querySelectorAll(".task-color-option").forEach((btn) => btn.classList.remove("active"));
            button.classList.add("active");
          });
        });

        const input = menu.querySelector(".task-tag-input");
        const saveButton = menu.querySelector(".task-side-action");

        const submitNewLabel = async () => {
          const name = formatTaskLabelName(input?.value || "");
          if (!name) {
            input?.focus();
            return;
          }
          const createdLabel = createTaskLabel(name, selected);
          taskData.tagId = createdLabel.id;
          cleanup();
          await save();
          render();
          renderMiniCalendar();
        };

        saveButton?.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await submitNewLabel();
        });

        input?.addEventListener("keydown", async (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            await submitNewLabel();
          }
        });
      });
    };

    renderTagList();
  };

  const openMobilePostpone = () => {
    const postponeOptions = [
      { label: "Posponer para manana", days: 1 },
      { label: "Posponer por 2 dias", days: 2 },
      { label: "Posponer por una semana", days: 7 }
    ];

    renderMenuView(`
      ${showSubmenuHeader("Posponer tarea")}
      <div class="task-side-panel task-postpone-panel task-mobile-subpanel">
        ${postponeOptions.map((option) => `
          <button class="task-side-option" type="button" data-postpone-days="${option.days}">
            ${option.label}
          </button>
        `).join("")}
      </div>
    `, () => {
      menu.querySelector('[data-action="back"]')?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        showMainMenu();
      });

      menu.querySelectorAll("[data-postpone-days]").forEach((option) => {
        option.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const daysToMove = Number(option.dataset.postponeDays || 0);
          const taskIso = taskElement.dataset.date || null;
          if (!taskIso) return;
          const targetIso = addDaysToIsoDate(taskIso, daysToMove);
          if (!targetIso) return;
          const fromIndex = Number(taskElement.dataset.index || 0);
          moveTaskToTarget(
            { fromDate: taskIso, fromProject: null, index: fromIndex },
            targetIso,
            null
          );
          cleanup();
          await save();
          render();
          renderMiniCalendar();
        });
      });
    });
  };

  const bindMainMenuActions = () => {
    menu.querySelector('[data-action="edit"]').onclick = ()=>{

      cleanup({ skipRefresh: true, keepScroll: true });

      const textDiv = taskElement.querySelector(".ttext");
      if (!textDiv) return;

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
        renderMiniCalendar();
        forceMobileRenderRefresh(render);
        restoreMobileScrollSnapshot();
      }

      function cancelEdit() {
        render();
        renderMiniCalendar();
        forceMobileRenderRefresh(render);
        restoreMobileScrollSnapshot();
      }

      input.addEventListener("keydown", e=>{
        if(e.key === "Enter") saveEdit();
        if(e.key === "Escape") cancelEdit();
      });

      input.addEventListener("blur", saveEdit);

    };

    menu.querySelector('[data-action="reorder"]').onclick = (e) => {
      e.preventDefault();
      cleanup({ skipRefresh: true, keepScroll: true });
      setMobileTaskReorderMode(true);
    };

    const scheduleButton = menu.querySelector('[data-action="schedule"]');
    if (scheduleButton) {
      scheduleButton.onclick = (e) => {
        e.preventDefault();
        openMobileSchedule();
      };
    }

    const tagButton = menu.querySelector('[data-action="tag"]');
    if (tagButton) {
      tagButton.onclick = (e) => {
        e.preventDefault();
        openMobileTags();
      };
    }

    const postponeButton = menu.querySelector('[data-action="postpone"]');
    if (postponeButton) {
      postponeButton.onclick = (e) => {
        e.preventDefault();
        openMobilePostpone();
      };
    }

    menu.querySelector('[data-action="delete"]').onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const confirmDelete = confirm("¿Eliminar esta tarea?");
      if (!confirmDelete) return;
      cleanup({ skipRefresh: true });

      if (soundEnabled) {
        playDeleteTaskSound();
      }

      const removed = removeMobileTaskFromSource();
      if (!removed) {
        showToast("No se pudo eliminar la tarea.");
        render();
        renderMiniCalendar();
        return;
      }

      await save();
      render();
      renderMiniCalendar();

      const sourceDate = taskElement.dataset.date || "";
      if (sourceDate) {
        updateDayModalTaskCount(sourceDate);
      }
    };
  };

  bindMainMenuActions();
  bindMobileTapToClick(menu);

  window.addEventListener("resize", handleViewportChange);
  window.addEventListener("scroll", handleViewportChange, true);

}


const soundToggle = document.getElementById("soundToggleTop");
const soundIcon = document.getElementById("soundIcon");
const soundStateText = document.getElementById("soundStateText");

updateSoundIcon();

soundToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  const wasEnabled = soundEnabled;
  soundEnabled = !soundEnabled;
  localStorage.setItem("soundEnabled", soundEnabled);
  updateSoundIcon();

  if (!wasEnabled && soundEnabled) {
    playAddTaskSound();
  }
});

function updateSoundIcon() {
  if(soundStateText){
    soundStateText.textContent = soundEnabled ? "Activado" : "Desactivado";
  }

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
  let changed = false;

  Object.keys(tasks).forEach(dateKey => {

    if (dateKey < today) {
      delete tasks[dateKey];
      changed = true;
    }

  });

  if (changed) {
    save();
  }

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
      <button class="theme-close-btn" id="closeThemeModal" type="button" aria-label="Cerrar">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
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
  closeCornerMenu();
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
const desktopCollapsedHelp = document.getElementById("desktopCollapsedHelp");

if (desktopCollapsedCalendar && sidebar) {
  desktopCollapsedCalendar.addEventListener("click", (e) => {
    e.stopPropagation();
    sidebar.classList.remove("collapsed");
  });
}

if (desktopCollapsedHelp) {
  desktopCollapsedHelp.addEventListener("click", (e) => {
    e.stopPropagation();
    closeCornerMenu();
    openSettingsOverlay("help");
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
const modeToggleTopMobile = document.getElementById("modeToggleTopMobile");

const modeBtnMobile = document.getElementById("modeToggleMobile");
const settingsBtnMobile = document.getElementById("settingsToggleMobile");

if (modeToggleTopMobile && modeBtn) {
  modeToggleTopMobile.addEventListener("click", (e) => {
    e.stopPropagation();
    modeBtn.click();
  });
}

if(modeBtnMobile){
  modeBtnMobile.addEventListener("click", ()=>{
    modeBtn.click();
  });
}

if(settingsBtnMobile){
  settingsBtnMobile.addEventListener("click", (e)=>{
    e.stopPropagation();
    closeCornerMenu();
    if(sidebar && window.matchMedia("(max-width: 900px)").matches){
      sidebar.classList.add("collapsed");
    }
    openSettingsOverlay("security");
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

function getLevelProgressState(){
  const totalExp = Math.max(0, Number(player?.exp) || 0);
  let level = 0;
  let expRemaining = totalExp;

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
  const rawProgress = needed > 0 ? expRemaining / needed : 0;
  const progress = Math.max(0, Math.min(1, rawProgress));

  return { level, expRemaining, needed, progress };
}

function updateLevelButton(level, progress){
  const safeProgress = Math.max(0, Math.min(1, Number(progress) || 0));

  const number = document.getElementById("levelNumber");
  if(number) number.textContent = level;

  const triggerLevel = document.getElementById("profileTriggerLevel");
  if(triggerLevel) triggerLevel.textContent = String(level);

  const triggerProgress = document.getElementById("profileTriggerProgress");
  if(triggerProgress){
    triggerProgress.style.width = `${safeProgress * 100}%`;
  }

  const ringProgress = document.querySelector(".level-ring-progress");
  if(ringProgress){
    const cachedLength = Number(ringProgress.dataset.arcLength) || 0;
    const arcLength = cachedLength > 0 ? cachedLength : ringProgress.getTotalLength();

    if(Number.isFinite(arcLength) && arcLength > 0){
      ringProgress.dataset.arcLength = String(arcLength);
      ringProgress.style.strokeDasharray = `${arcLength}`;
      ringProgress.style.strokeDashoffset = `${arcLength * (1 - safeProgress)}`;
    }
  }
}

function updateLevel(){
  const { level, progress } = getLevelProgressState();

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

function closeLevelMenu() {
  if (!levelMenu) return;
  levelMenu.classList.remove("open");
}

if (levelMenu) {
  document.body.appendChild(levelMenu);
}

if (levelButton && levelMenu) {
  levelButton.addEventListener("click", (e)=>{

    e.stopPropagation();

    const rect = levelButton.getBoundingClientRect();

    levelMenu.style.top = rect.bottom + 12 + "px";
    levelMenu.style.left = rect.left - 170 + "px";

    levelMenu.classList.toggle("open");

    updateLevelMenu();

  });
}

document.addEventListener("pointerdown", (e) => {
  if (!levelMenu || !levelButton) return;
  if (!levelMenu.classList.contains("open")) return;
  if (levelMenu.contains(e.target)) return;
  if (levelButton.contains(e.target)) return;
  closeLevelMenu();
}, true);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeLevelMenu();
  }
});

function updateLevelMenu(){
  resetDailyExpIfNeeded();

  const { expRemaining, needed, progress } = getLevelProgressState();
  const percent = progress * 100;

  document.getElementById("levelProgressFill").style.width =
      percent + "%";

  document.getElementById("levelProgressText").textContent =
      `${expRemaining} / ${needed} EXP`;

  const dailyStatus = document.getElementById("levelDailyExpStatus");
  if (dailyStatus) {
    const dailyLimit = 5;
    const completed = Math.max(0, Number(player.todayExpTasks) || 0);
    const remaining = Math.max(0, dailyLimit - completed);
    dailyStatus.textContent = remaining === 0
      ? `Límite alcanzado: ${completed}/${dailyLimit}`
      : `Te quedan ${remaining} de ${dailyLimit} tareas con EXP hoy`;
  }

}

const leaderboardFromLevelBtn =
  document.getElementById("openLeaderboardFromLevel");

if(leaderboardFromLevelBtn){

  leaderboardFromLevelBtn.addEventListener("click",(e)=>{

    e.stopPropagation();

    closeLevelMenu();

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
  },
  logros(){
    openAchievementsMenu();
  },
  cerrarLogros(){
    closeAchievementsMenu();
  },
  testLogros(input){
    previewAchievementUnlocks(input);
  }

};

window.logros = openAchievementsMenu;
window.cerrarLogros = closeAchievementsMenu;
window.testLogros = previewAchievementUnlocks;

function updateViewButtons(){

  const tasksBtn = document.getElementById("tasksViewBtn");
  const projectsBtn = document.getElementById("projectsViewBtn");
  const bubble = document.getElementById("toggleBubble");

  if(!tasksBtn || !projectsBtn || !bubble) return;

  if(currentViewMode === "tasks"){
    tasksBtn.classList.add("active");
    projectsBtn.classList.remove("active");

    bubble.style.transform = "translateX(0)";
  }else{
    projectsBtn.classList.add("active");
    tasksBtn.classList.remove("active");

    bubble.style.transform = "translateX(100%)";
  }

}

async function syncLocalData(){

  if(!currentUser) return;

  const rawLocalData = JSON.parse(localStorage.getItem(storeKey));

  if(!rawLocalData){
    return;
  }

  const localData = parseStoredAppData(rawLocalData || {});
  const localTasks = localData.tasks || {};
  const localProjects = localData.projects || {};
  const localProjectOrder = Array.isArray(localData.projectOrder) ? localData.projectOrder : [];

  try{

    const userRef = doc(db,"users",currentUser.uid);
    const snap = await getDoc(userRef);

    const data = snap.data() || {};

    const cloudTasks = data.tasks || {};
    const cloudProjects = data.projects || {};
    const cloudProjectOrder = Array.isArray(data.projectOrder) ? data.projectOrder : [];

    // merge tareas
    const mergedTasks = { ...cloudTasks };

    Object.entries(localTasks).forEach(([date,list])=>{

      if(!mergedTasks[date]) mergedTasks[date] = [];

      const existing = new Set(mergedTasks[date].map(t=>t.text));

      list.forEach(t=>{
        if(!existing.has(t.text)){
          mergedTasks[date].push(t);
        }
      });

    });

    // merge proyectos
    const mergedProjects = { ...cloudProjects };

    Object.entries(localProjects).forEach(([id,proj])=>{
      if(!mergedProjects[id]){
        mergedProjects[id] = proj;
      }
    });

    const mergedProjectOrder = reconcileProjectOrder(
      cloudProjectOrder.length ? cloudProjectOrder : localProjectOrder,
      mergedProjects
    );

    await setDoc(
      userRef,
      {
        tasks: mergedTasks,
        projects: mergedProjects,
        projectOrder: mergedProjectOrder
      },
      { merge:true }
    );

    // limpiar localStorage
    localStorage.removeItem(storeKey);

    if(navigator.onLine){

      const localData = localStorage.getItem(storeKey);

      if(localData){
        setStatusPending();
      }else{
        setStatusSaved();
      }

    }else{
      setStatusPending();
    }

    console.log("Sincronización completada");

  }catch(err){

    console.log("Sincronización falló",err);

  }

}


if(!navigator.onLine){
  setStatusLocal();
}

window.addEventListener("online", () => {

  console.log("Internet restaurado, sincronizando...");

  setStatusSaving();   // 👈 mostrar SAVING

  syncLocalData();

});

window.addEventListener("offline", () => {

  console.log("Sin internet, usando almacenamiento local");

  setStatusLocal();

});

function resetInactivityTimer(){

  if(!officeModeEnabled) return;
  if(isLocked) return;

  clearTimeout(inactivityTimer);

  inactivityTimer = setTimeout(()=>{
    lockApp();
  },officeModeTimeoutSeconds * 1000);

}

function clearLockFeedback(){
  const pinInput = document.getElementById("pinInput");
  const pinError = document.getElementById("pinError");

  if(pinInput){
    pinInput.value = "";
  }

  if(pinError){
    pinError.textContent = "";
  }
}

function hideLockScreen(){
  const lockScreen = document.getElementById("lockScreen");
  lockScreen?.classList.remove("active");
}

async function finishUnlock(){
  hideLockScreen();
  clearLockFeedback();
  isLocked = false;
  setLocalOfficeLockState(false);
  resetInactivityTimer();
  if(currentUser){
    await saveOfficeModePreferences({
      officeModeLocked: false
    });
  }

  return true;
}

async function promptForNewSecurityPin(){
  const firstPin = window.prompt("Crea un PIN de seguridad de 4 a 6 números");

  if(firstPin === null) return null;

  const normalizedPin = firstPin.trim();

  if(!/^\d{4,6}$/.test(normalizedPin)){
    alert("El PIN debe tener entre 4 y 6 números.");
    return null;
  }

  const confirmPin = window.prompt("Confirma tu nuevo PIN de seguridad");

  if(confirmPin === null) return null;

  if(normalizedPin !== confirmPin.trim()){
    alert("Los PIN no coinciden.");
    return null;
  }

  return normalizedPin;
}

async function enableOfficeMode(){
  if(!currentUser){
    showToast("Inicia sesión para guardar esta configuración");
    syncOfficeModeControls();
    return false;
  }

  const userRef = doc(db,"users",currentUser.uid);
  const snap = await getDoc(userRef);
  const data = snap.data() || {};
  const updates = {};

  let nextSecurityPinHash = data.securityPinHash || "";
  const existingLegacyPin = data.securityPin || "";

  if(!nextSecurityPinHash && !existingLegacyPin){
    const securityPin = await promptForNewSecurityPin();

    if(!securityPin){
      syncOfficeModeControls();
      return false;
    }

    nextSecurityPinHash = await hashSecurityPin(securityPin);
    updates.securityPinHash = nextSecurityPinHash;
  }else if(!nextSecurityPinHash && existingLegacyPin){
    nextSecurityPinHash = await hashSecurityPin(existingLegacyPin);
    updates.securityPinHash = nextSecurityPinHash;
  }

  updates.officeModeEnabled = true;
  updates.securityPinEnabled = true;
  updates.officeModeTimeoutSeconds = officeModeTimeoutSeconds;
  updates.officeModeLocked = false;

  await saveOfficeModePreferences(updates);

  officeModeEnabled = true;
  securityPinHash = nextSecurityPinHash;
  legacySecurityPin = existingLegacyPin;
  isLocked = false;
  syncOfficeModeControls();
  resetInactivityTimer();
  return true;
}

async function disableOfficeMode(){
  if(!currentUser){
    syncOfficeModeControls();
    return false;
  }

  await saveOfficeModePreferences({
    officeModeEnabled: false,
    securityPinEnabled: false,
    officeModeTimeoutSeconds,
    officeModeLocked: false
  });

  officeModeEnabled = false;
  isLocked = false;
  setLocalOfficeLockState(false);
  clearTimeout(inactivityTimer);
  hideLockScreen();
  syncOfficeModeControls();
  return true;
}

async function lockApp(shouldPersist = true){

  if(isLocked && shouldPersist) return;

  const lock = document.getElementById("lockScreen");

  lock.classList.add("active");
  clearLockFeedback();
  requestAnimationFrame(() => {
    document.getElementById("pinInput")?.focus();
  });

  isLocked = true;
  setLocalOfficeLockState(true);
  clearTimeout(inactivityTimer);

  if(shouldPersist && currentUser){
    await saveOfficeModePreferences({
      officeModeLocked: true
    });
  }

}

const unlockBtn = document.getElementById("unlockBtn");
unlockBtn.addEventListener("click", async ()=>{
  if(!isLocked) return;

  const pinInput = document.getElementById("pinInput");
  const pinError = document.getElementById("pinError");
  const enteredPin = pinInput?.value.trim() || "";

  if(pinError){
    pinError.textContent = "";
  }

  if(!/^\d{4,6}$/.test(enteredPin)){
    if(pinError){
      pinError.textContent = "Ingresa tu PIN de 4 a 6 números.";
    }
    return;
  }

  const enteredPinHash = await hashSecurityPin(enteredPin);
  const matchesHashed = !!securityPinHash && enteredPinHash === securityPinHash;
  const matchesLegacy = !!legacySecurityPin && enteredPin === legacySecurityPin;

  if(!matchesHashed && !matchesLegacy){
    if(pinError){
      pinError.textContent = "PIN incorrecto. Intenta nuevamente.";
    }
    return;
  }

  if(matchesLegacy && !securityPinHash && currentUser){
    securityPinHash = enteredPinHash;
    legacySecurityPin = enteredPin;
    await saveOfficeModePreferences({
      securityPinHash
    });
  }

  await finishUnlock();
});

const pinInput = document.getElementById("pinInput");
pinInput?.addEventListener("keydown", (e)=>{
  if(e.key === "Enter"){
    e.preventDefault();
    unlockBtn.click();
  }
});

const forgotBtn = document.getElementById("forgotPinBtn");

forgotBtn.addEventListener("click", async ()=>{

  const confirmLogout = confirm(
    "La app cerrará tu sesión, pero la seguridad seguirá activa para esta cuenta.\n\n¿Continuar?"
  );

  if(!confirmLogout) return;

  try{
    await signOut(auth);

  }catch(err){

    console.error(err);
    alert("Error al cerrar sesión");

  }

});

if(localStorage.getItem(OFFICE_MODE_LOCK_STORAGE_KEY) === "true"){
  document.getElementById("lockScreen")?.classList.add("active");
  isLocked = true;
}

document.documentElement.classList.remove("pre-collapsed");

["mousemove","keydown","mousedown","touchstart"].forEach(event=>{
  document.addEventListener(event, resetInactivityTimer);
});
