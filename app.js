import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  set,
  update
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

// ── Firebase Config ───────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBCwn8dr4f-PVrAc5cBCWpSScUEmhqItnY",
  authDomain: "my-home-control-b16ec.firebaseapp.com",
  databaseURL: "https://my-home-control-b16ec-default-rtdb.firebaseio.com",
  projectId: "my-home-control-b16ec",
  storageBucket: "my-home-control-b16ec.firebasestorage.app",
  messagingSenderId: "689783472316",
  appId: "1:689783472316:web:8df35dd46b5489233f90b9",
  measurementId: "G-1X50MYZDZS"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

const switches = [1, 2, 3, 4];
let espIp    = localStorage.getItem("esp_ip") || "";
let localMode = false;

// ── UI ────────────────────────────────────────
function updateUI(number, value) {
  const input = document.getElementById(`switch${number}`);
  const lamp  = document.getElementById(`lamp${number}`);
  const card  = document.getElementById(`card${number}`);
  const state = document.getElementById(`state${number}`);

  input.checked = !!value;
  lamp.classList.toggle("on",  !!value);
  lamp.classList.toggle("off", !value);
  card.classList.toggle("on",  !!value);
  state.textContent = value ? "شغّال" : "مطفي";
}

function updateSummary(data) {
  const on = switches.filter(n => !!data[`switch${n}`]).length;
  document.getElementById("countOn").textContent  = on;
  document.getElementById("countOff").textContent = 4 - on;
}

// ── Firebase Listeners ────────────────────────
onValue(ref(db, "devices"), (snap) => {
  const data = snap.val() || {};
  switches.forEach(n => updateUI(n, !!data[`switch${n}`]));
  updateSummary(data);
  document.getElementById("lastUpdate").textContent =
    "آخر تحديث: " + new Date().toLocaleTimeString("ar-SA");
}, (error) => {
  console.error(error);
  document.getElementById("lastUpdate").textContent =
    "حدث خطأ في قراءة قاعدة البيانات";
});

// مزامنة الأسماء من Firebase
onValue(ref(db, "names"), (snap) => {
  const data = snap.val() || {};
  switches.forEach(n => {
    const nameEl = document.getElementById(`name${n}`);
    if (nameEl && data[`switch${n}`]) {
      nameEl.textContent = data[`switch${n}`];
    }
  });
});

// حالة الاتصال
onValue(ref(db, ".info/connected"), (snap) => {
  const connected = snap.val() === true;
  const el = document.getElementById("connection");
  el.textContent = connected ? "● متصل" : "● غير متصل";
  el.className   = connected ? "status online" : "status offline";
});

// ── Toggle ────────────────────────────────────
async function toggleSwitch(number, value) {
  if (localMode && espIp) {
    try {
      await fetch(`http://${espIp}/api/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `switch=${number}&state=${value}`,
        signal: AbortSignal.timeout(2000),
      });
      return;
    } catch {
      console.warn("ESP offline, using Firebase");
    }
  }
  set(ref(db, `devices/switch${number}`), value).catch(err => {
    alert("تعذر تحديث المفتاح: " + err.message);
  });
}

// ربط المفاتيح
switches.forEach(n => {
  document.getElementById(`switch${n}`)
    .addEventListener("change", e => toggleSwitch(n, e.target.checked));
});

// ── تشغيل/إيقاف الكل ─────────────────────────
document.getElementById("btnAllOn").addEventListener("click", () => {
  if (localMode && espIp) {
    switches.forEach(n => toggleSwitch(n, true));
  } else {
    const updates = {};
    switches.forEach(n => updates[`switch${n}`] = true);
    update(ref(db, "devices"), updates);
  }
});

document.getElementById("btnAllOff").addEventListener("click", () => {
  if (localMode && espIp) {
    switches.forEach(n => toggleSwitch(n, false));
  } else {
    const updates = {};
    switches.forEach(n => updates[`switch${n}`] = false);
    update(ref(db, "devices"), updates);
  }
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
  const el = document.getElementById("modeStatus");
  el.textContent = `✅ تم حفظ IP: ${espIp}`;
});

document.getElementById("btnTestEsp").addEventListener("click", async () => {
  try {
    const res  = await fetch(`http://${espIp}/api/info`,
      { signal: AbortSignal.timeout(2000) });
    const info = await res.json();
    alert(`✅ ESP متصل!\nIP: ${info.ip}\nWiFi: ${info.ssid}\nقوة الإشارة: ${info.rssi} dBm`);
  } catch {
    alert("❌ تعذر الاتصال بالـ ESP\nتأكد من IP والاتصال بنفس الشبكة");
  }
});

// تحميل IP المحفوظ
if (espIp) document.getElementById("espIpInput").value = espIp;
