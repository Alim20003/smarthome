import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  set,
  update
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBCwn8dr4f-PVrAc5cBCWpSScUEmhqItnY",
  authDomain: "my-home-control-b16ec.firebaseapp.com",
  databaseURL: "https://my-home-control-b16ec-default-rtdb.firebaseio.com",
  projectId: "my-home-control-b16ec",
  storageBucket: "my-home-control-b16ec.firebasestorage.app",
  messagingSenderId: "689783472316",
  appId: "1:689783472316:web:8df35dd46b5489233f90b9",
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

let espIp     = localStorage.getItem("esp_ip") || "";
let localMode = false;
let boardsData = {};

// ── بناء كارت اللوحة ──────────────────────────
function buildBoardCard(boardId, board) {
  const devices = board.devices || {};
  const names   = board.names   || {};
  const icons   = board.switchIcons || {};
  const onCount = Object.values(devices).filter(v => !!v).length;
  const anyOn   = onCount > 0;

  return `
    <div class="board-card ${anyOn ? 'board-on' : ''}" id="board-${boardId}">
      <div class="board-header">
        <div class="board-icon-wrap ${anyOn ? 'active' : ''}">
          <span class="board-icon">${board.icon || '🔌'}</span>
        </div>
        <div class="board-info">
          <h2 class="board-name">${board.name || boardId}</h2>
          <div class="board-meta">
            <span class="badge ${anyOn ? 'badge-on' : 'badge-off'}">
              ${onCount}/4 شغّال
            </span>
            ${board.ip ? `<span class="badge badge-ip">📡 ${board.ip}</span>` : ''}
          </div>
        </div>
        <div class="board-dots">
          ${[1,2,3,4].map(i => `
            <div class="dot ${devices[`switch${i}`] ? 'dot-on' : ''}"></div>
          `).join('')}
        </div>
      </div>

      <div class="board-controls">
        <button class="btn-all-on" onclick="toggleAll('${boardId}', true)">
          ⚡ تشغيل الكل
        </button>
        <button class="btn-all-off" onclick="toggleAll('${boardId}', false)">
          🔴 إيقاف الكل
        </button>
      </div>

      <div class="switches-grid">
        ${[1,2,3,4].map(i => {
          const isOn  = !!devices[`switch${i}`];
          const name  = names[`switch${i}`]   || `المفتاح ${i}`;
          const icon  = icons[`switch${i}`]   || '💡';
          return `
            <div class="switch-card ${isOn ? 'switch-on' : ''}" id="${boardId}-card${i}">
              <div class="switch-lamp ${isOn ? 'lamp-on' : ''}" id="${boardId}-lamp${i}">
                ${icon}
              </div>
              <div class="switch-info">
                <span class="switch-name" id="${boardId}-name${i}">${name}</span>
                <span class="switch-state ${isOn ? 'state-on' : ''}" id="${boardId}-state${i}">
                  ${isOn ? 'شغّال' : 'مطفي'}
                </span>
              </div>
              <label class="toggle">
                <input type="checkbox" id="${boardId}-switch${i}"
                  ${isOn ? 'checked' : ''}
                  onchange="toggleSwitch('${boardId}', ${i}, this.checked)">
                <span class="toggle-slider"></span>
              </label>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ── تحديث UI لوحة موجودة ──────────────────────
function updateBoardUI(boardId, board) {
  const devices = board.devices     || {};
  const names   = board.names       || {};
  const icons   = board.switchIcons || {};
  const onCount = Object.values(devices).filter(v => !!v).length;
  const anyOn   = onCount > 0;

  const card = document.getElementById(`board-${boardId}`);
  if (!card) return;

  card.className = `board-card ${anyOn ? 'board-on' : ''}`;

  const iconWrap = card.querySelector('.board-icon-wrap');
  if (iconWrap) iconWrap.className = `board-icon-wrap ${anyOn ? 'active' : ''}`;

  const iconEl = card.querySelector('.board-icon');
  if (iconEl) iconEl.textContent = board.icon || '🔌';

  const nameEl = card.querySelector('.board-name');
  if (nameEl) nameEl.textContent = board.name || boardId;

  const badge = card.querySelector('.badge:first-child');
  if (badge) {
    badge.textContent = `${onCount}/4 شغّال`;
    badge.className = `badge ${anyOn ? 'badge-on' : 'badge-off'}`;
  }

  const dots = card.querySelectorAll('.dot');
  [1,2,3,4].forEach((i, idx) => {
    if (dots[idx]) {
      dots[idx].className = `dot ${devices[`switch${i}`] ? 'dot-on' : ''}`;
    }
  });

  [1,2,3,4].forEach(i => {
    const isOn = !!devices[`switch${i}`];
    const name = names[`switch${i}`]  || `المفتاح ${i}`;
    const icon = icons[`switch${i}`]  || '💡';

    const sw    = document.getElementById(`${boardId}-switch${i}`);
    const lamp  = document.getElementById(`${boardId}-lamp${i}`);
    const state = document.getElementById(`${boardId}-state${i}`);
    const nameEl2 = document.getElementById(`${boardId}-name${i}`);
    const swCard  = document.getElementById(`${boardId}-card${i}`);

    if (sw)      sw.checked = isOn;
    if (lamp) {
      lamp.textContent = icon;
      lamp.className   = `switch-lamp ${isOn ? 'lamp-on' : ''}`;
    }
    if (state) {
      state.textContent = isOn ? 'شغّال' : 'مطفي';
      state.className   = `switch-state ${isOn ? 'state-on' : ''}`;
    }
    if (nameEl2) nameEl2.textContent = name;
    if (swCard)  swCard.className = `switch-card ${isOn ? 'switch-on' : ''}`;
  });
}

// ── الاستماع للوحات ───────────────────────────
onValue(ref(db, "boards"), (snap) => {
  const data = snap.val() || {};
  const container = document.getElementById("boardsContainer");

  // فلتر اللوحات النشطة فقط
  const activeBoards = Object.entries(data)
    .filter(([, board]) => board.isActive === true)
    .sort(([a], [b]) => a.localeCompare(b));

  if (activeBoards.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🏠</span>
        <h3>لا توجد لوحات مضافة</h3>
        <p>أضف لوحات من تطبيق الموبايل</p>
      </div>
    `;
    updateGlobalSummary({});
    return;
  }

  // تحديث أو إنشاء كارت لكل لوحة
  const existingIds = new Set(
    [...container.querySelectorAll('.board-card')]
      .map(el => el.id.replace('board-', ''))
  );

  activeBoards.forEach(([boardId, board]) => {
    if (existingIds.has(boardId)) {
      updateBoardUI(boardId, board);
      existingIds.delete(boardId);
    } else {
      const div = document.createElement('div');
      div.innerHTML = buildBoardCard(boardId, board);
      container.appendChild(div.firstElementChild);
    }
  });

  // حذف اللوحات غير النشطة
  existingIds.forEach(id => {
    const el = document.getElementById(`board-${id}`);
    if (el) el.remove();
  });

  boardsData = data;
  updateGlobalSummary(data);

  document.getElementById("lastUpdate").textContent =
    "آخر تحديث: " + new Date().toLocaleTimeString("ar-SA");
});

// ── ملخص عام ──────────────────────────────────
function updateGlobalSummary(data) {
  let totalOn = 0, totalBoards = 0;
  Object.values(data).forEach(board => {
    if (!board.isActive) return;
    totalBoards++;
    const devices = board.devices || {};
    totalOn += Object.values(devices).filter(v => !!v).length;
  });
  const totalSwitches = totalBoards * 4;
  document.getElementById("totalOn").textContent     = totalOn;
  document.getElementById("totalOff").textContent    = totalSwitches - totalOn;
  document.getElementById("totalBoards").textContent = totalBoards;
}

// ── Toggle مفتاح ──────────────────────────────
window.toggleSwitch = async function(boardId, number, value) {
  if (localMode && espIp) {
    try {
      await fetch(`http://${espIp}/api/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `switch=${number}&state=${value}`,
        signal: AbortSignal.timeout(2000),
      });
      return;
    } catch { console.warn("ESP offline, using Firebase"); }
  }
  set(ref(db, `boards/${boardId}/devices/switch${number}`), value);
};

// ── Toggle الكل ───────────────────────────────
window.toggleAll = async function(boardId, value) {
  if (localMode && espIp) {
    for (let i = 1; i <= 4; i++) {
      await window.toggleSwitch(boardId, i, value);
    }
    return;
  }
  const updates = {};
  for (let i = 1; i <= 4; i++) updates[`switch${i}`] = value;
  update(ref(db, `boards/${boardId}/devices`), updates);
};

// ── حالة الاتصال ──────────────────────────────
onValue(ref(db, ".info/connected"), (snap) => {
  const connected = snap.val() === true;
  const el = document.getElementById("connection");
  el.textContent = connected ? "● متصل" : "● غير متصل";
  el.className   = connected ? "status online" : "status offline";
});

// ── وضع أونلاين/محلي ─────────────────────────
document.getElementById("btnOnline").addEventListener("click", () => {
  localMode = false;
  document.getElementById("btnOnline").classList.add("active-mode");
  document.getElementById("btnLocal").classList.remove("active-mode");
  document.getElementById("modeStatus").textContent = "🌐 وضع أونلاين - Firebase";
});

document.getElementById("btnLocal").addEventListener("click", async () => {
  localMode = true;
  document.getElementById("btnLocal").classList.add("active-mode");
  document.getElementById("btnOnline").classList.remove("active-mode");
  try {
    const res  = await fetch(`http://${espIp}/api/info`,
      { signal: AbortSignal.timeout(2000) });
    const info = await res.json();
    document.getElementById("modeStatus").textContent =
      `📡 وضع محلي - ESP: ${info.ip} ✅`;
  } catch {
    document.getElementById("modeStatus").textContent =
      "📡 وضع محلي - ESP غير متصل ❌";
  }
});

// ── إعدادات ESP ───────────────────────────────
document.getElementById("btnSaveIp").addEventListener("click", () => {
  espIp = document.getElementById("espIpInput").value.trim();
  localStorage.setItem("esp_ip", espIp);
  document.getElementById("modeStatus").textContent = `✅ تم حفظ IP: ${espIp}`;
});

document.getElementById("btnTestEsp").addEventListener("click", async () => {
  try {
    const res  = await fetch(`http://${espIp}/api/info`,
      { signal: AbortSignal.timeout(2000) });
    const info = await res.json();
    alert(`✅ ESP متصل!\nالبورد: ${info.boardId}\nIP: ${info.ip}\nWiFi: ${info.ssid}\nقوة الإشارة: ${info.rssi} dBm`);
  } catch {
    alert("❌ تعذر الاتصال بالـ ESP\nتأكد من IP والاتصال بنفس الشبكة");
  }
});

if (espIp) document.getElementById("espIpInput").value = espIp;
