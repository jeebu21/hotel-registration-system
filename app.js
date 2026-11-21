import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, sendPasswordResetEmail, setPersistence, browserLocalPersistence, browserSessionPersistence }
  from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";
import { collection, doc, getDoc, setDoc, addDoc, updateDoc, onSnapshot, runTransaction }
  from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const S = { role: null, name: "", email: "", rooms: [], guests: [], regs: [], unsubs: [], editId: null, signingUp: false, pending: null };

/* ---------- Icons ---------- */
const P = {
  home: "M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  bed: "M3 5v15M3 16h18v4M21 16v-3a3 3 0 0 0-3-3H10v6M5 12a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 1 0-3.2 0",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  clip: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8",
  chart: "M12 20V10M18 20V4M6 20v-4",
  sliders: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0",
  menu: "M4 6h16M4 12h16M4 18h16",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 7l-10 6L2 7",
  lock: "M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 10 0v4",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  eyeoff: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22",
  arrow: "M5 12h14M12 5l7 7-7 7",
  door: "M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h7M14 3v18M14 3l4 1.5V19.5L14 21M11 12h.01",
  checkc: "M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4L12 14l-3-3",
  plusc: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 8v8M8 12h8"
};
const svg = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${P[n]}"/></svg>`;
const ic = n => `<i data-i="${n}">${svg(n)}</i>`;
const paintIcons = () => document.querySelectorAll("i[data-i]:empty").forEach(e => (e.innerHTML = svg(e.dataset.i)));
paintIcons();

function toast(msg, bad) {
  const t = $("#toast");
  t.textContent = msg; t.className = "show " + (bad ? "bad" : "ok");
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = ""), 4500);
}
const fail = (e, what) => toast(e.code === "permission-denied" ? "You don't have permission to " + what : e.message || "Something went wrong", true);

/* ---------- Sign in / sign up / Google ---------- */
const mode = m => { for (const [id, k] of [["loginForm", "login"], ["signupForm", "signup"], ["roleForm", "role"]]) $("#" + id).hidden = m !== k; };
$("#toSignup").onclick = () => mode("signup");
$("#toLogin").onclick = () => mode("login");
const HINT = { receptionist: "Register guests, allocate rooms, check guests in and out.", manager: "Add and manage rooms, view bookings and see reports." };
for (const [sel, hint] of [["#s-role", "#roleHint"], ["#p-role", "#pHint"]]) $(sel).onchange = () => ($(hint).textContent = HINT[$(sel).value]);

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await setPersistence(auth, $("#remember").checked ? browserLocalPersistence : browserSessionPersistence);
    await signInWithEmailAndPassword(auth, $("#email").value.trim(), $("#password").value);
  } catch { toast("Email or password is incorrect", true); }
});

$("#google").onclick = async () => {
  try {
    await setPersistence(auth, $("#remember").checked ? browserLocalPersistence : browserSessionPersistence);
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (er) {
    if (["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(er.code)) return;
    toast(er.code === "auth/operation-not-allowed" ? "Google sign-in is not turned on in Firebase yet"
      : er.code === "auth/unauthorized-domain" ? "Open the app at http://localhost:5500 so Google sign-in is allowed"
      : "Google sign-in failed. " + (er.message || ""), true);
  }
};

$("#signupForm").addEventListener("submit", async e => {
  e.preventDefault();
  const name = $("#s-name").value.trim(), email = $("#s-email").value.trim(), pw = $("#s-pass").value, role = $("#s-role").value;
  const err = name.length < 2 ? "Enter your full name." : pw.length < 6 ? "Password must be at least 6 characters."
    : pw !== $("#s-pass2").value ? "The two passwords do not match." : "";
  $("#signupErr").textContent = err;
  if (err) return;
  S.signingUp = true; // stops the auth listener from reading the profile before we have saved it
  try {
    await setPersistence(auth, browserLocalPersistence);
    const cred = await createUserWithEmailAndPassword(auth, email, pw);
    await setDoc(doc(db, "users", cred.user.uid), { name, email, role, createdAt: new Date().toISOString() });
    S.signingUp = false;
    await boot(cred.user);
    toast("Account created. Welcome, " + name);
  } catch (er) {
    S.signingUp = false;
    $("#signupErr").textContent = er.code === "auth/email-already-in-use" ? "An account with this email already exists. Sign in instead."
      : er.code === "auth/invalid-email" ? "Enter a valid email address."
      : er.code === "permission-denied" ? "Your role could not be saved. Publish the latest Firestore rules, then try again."
      : er.message;
    if (auth.currentUser) signOut(auth);
  }
});

// Shown when someone is signed in but has no role yet (first Google sign-in).
$("#roleForm").addEventListener("submit", async e => {
  e.preventDefault();
  const user = S.pending, name = $("#p-name").value.trim(), role = $("#p-role").value;
  if (!user) return;
  if (name.length < 2) return ($("#roleErr").textContent = "Enter your full name.");
  try {
    await setDoc(doc(db, "users", user.uid), { name, email: user.email, role, createdAt: new Date().toISOString() });
    S.pending = null; $("#roleErr").textContent = "";
    await boot(user);
  } catch (er) {
    $("#roleErr").textContent = er.code === "permission-denied" ? "Your role could not be saved. Publish the latest Firestore rules, then try again." : er.message;
  }
});
$("#roleOut").onclick = () => signOut(auth);

$("#eye").onclick = () => {
  const p = $("#password"), show = p.type === "password";
  p.type = show ? "text" : "password";
  $("#eye").innerHTML = ic(show ? "eye" : "eyeoff");
};
$("#forgot").onclick = async () => {
  const email = $("#email").value.trim();
  if (!email) return toast("Enter your email first, then click Forgot password", true);
  try { await sendPasswordResetEmail(auth, email); toast("Password reset email sent"); }
  catch { toast("Could not send a reset email to that address", true); }
};
$("#resetPw").onclick = async () => {
  try { await sendPasswordResetEmail(auth, S.email); toast("Password reset email sent to " + S.email); }
  catch { toast("Could not send the reset email", true); }
};
$("#logout").onclick = () => signOut(auth);
$("#menu").onclick = () => $("#app").classList.toggle("closed");
$("#bell").onclick = () => showTab("checkio");

onAuthStateChanged(auth, user => { if (!S.signingUp) boot(user); });

async function boot(user) {
  S.unsubs.forEach(u => u()); S.unsubs = [];
  if (!user) { S.role = null; S.pending = null; $("#app").hidden = true; $("#login").hidden = false; mode("login"); return; }
  let snap;
  try { snap = await getDoc(doc(db, "users", user.uid)); }
  catch (er) { fail(er, "load your profile"); signOut(auth); return; }
  if (!snap.exists()) {
    S.pending = user;
    $("#p-name").value = user.displayName || "";
    $("#app").hidden = true; $("#login").hidden = false; mode("role");
    return;
  }
  S.role = snap.data().role;
  S.name = snap.data().name || user.displayName || user.email.split("@")[0];
  if (!["receptionist", "manager"].includes(S.role)) { toast("This account has no valid role", true); signOut(auth); return; }
  S.email = user.email;
  document.body.dataset.role = S.role; // decides which modules this person sees
  const role = S.role[0].toUpperCase() + S.role.slice(1);
  $("#uName").textContent = S.name; $("#hName").textContent = S.name; $("#uRole").textContent = role;
  $("#ava").textContent = S.name.split(/[\s._-]+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  $("#setRows").innerHTML = [["Name", S.name], ["Email", S.email], ["Role", role]].map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join("");
  $("#login").hidden = true; $("#app").hidden = false;
  showTab("dash");
  for (const [name, key] of [["rooms", "rooms"], ["guests", "guests"], ["registrations", "regs"]])
    S.unsubs.push(onSnapshot(collection(db, name),
      s => { S[key] = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); },
      e => fail(e, "view " + name)));
}

/* ---------- Tabs ---------- */
const TABS = ["dash", "guests", "rooms", "regs", "checkio", "status", "reports", "settings"];
function showTab(tab) {
  document.querySelectorAll("aside nav button").forEach(x => x.classList.toggle("on", x.dataset.tab === tab));
  for (const t of TABS) $("#tab-" + t).hidden = t !== tab;
}
document.querySelectorAll("aside nav button").forEach(b => b.onclick = () => showTab(b.dataset.tab));

/* ---------- Rendering (all numbers come from live Firestore data) ---------- */
const byNumber = (a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true });
const fmt = iso => iso ? new Date(iso).toLocaleString() : "-";
const clock = iso => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const sameDay = (iso, d) => iso && new Date(iso).toDateString() === d.toDateString();
const cap = s => s[0].toUpperCase() + s.slice(1);
const nRooms = s => S.rooms.filter(r => r.status === s).length;

function render() { renderDash(); renderRooms(); renderGuests(); renderRegs(); renderReports(); }

function renderDash() {
  const now = new Date(), total = S.rooms.length, occ = nRooms("occupied");
  const newToday = S.guests.filter(g => sameDay(g.createdAt, now)).length;
  const cards = [
    ["navy", "users", "Total Guests", S.guests.length, `${newToday} registered today`],
    ["light", "bed", "Total Rooms", total, `${nRooms("maintenance")} under maintenance`],
    ["coral", "calendar", "Occupied Rooms", occ, total ? Math.round(occ / total * 100) + "% occupancy" : "No rooms yet"],
    ["navy", "checkc", "Available Rooms", nRooms("available"), `${nRooms("allocated")} allocated`]];
  $("#stats").innerHTML = cards.map(([c, i, l, v, s]) => `<div class="stat ${c}">${ic(i)}<span>${l}</span><b>${v}</b><small>${s}</small><span class="wm">${ic(i)}</span></div>`).join("");

  $("#todayDate").textContent = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  $("#tIn").textContent = S.regs.filter(r => sameDay(r.checkIn, now)).length;
  $("#tOut").textContent = S.regs.filter(r => sameDay(r.checkOut, now)).length;
  const pending = S.regs.filter(r => r.status === "allocated").length;
  $("#badge").textContent = pending; $("#badge").hidden = !pending;

  const parts = [["occupied", "Occupied", "#FF6B58"], ["allocated", "Allocated", "#F2B84B"], ["available", "Available", "#2e9d5b"], ["maintenance", "Maintenance", "#14213D"]];
  let acc = 0;
  const stops = total ? parts.map(([k, , c]) => { const a = acc; acc += nRooms(k) / total * 100; return `${c} ${a}% ${acc}%`; }).join(",") : "#e6dccb 0 100%";
  $("#donut").style.background = `conic-gradient(${stops})`;
  $("#dTotal").innerHTML = `<b>${total}</b>Total Rooms`;
  $("#legend").innerHTML = parts.map(([k, l, c]) => `<li><i style="background:${c}"></i>${l}<b>${nRooms(k)}</b></li>`).join("");

  const ev = [
    ...S.guests.filter(g => g.createdAt).map(g => [g.createdAt, "New Registration", "plusc", "var(--blue)", g.fullName, "-"]),
    ...S.regs.flatMap(r => [[r.createdAt, "Room Allocated", "bed", "var(--navy)"], [r.checkIn, "Check-in", "checkc", "var(--green)"], [r.checkOut, "Check-out", "logout", "var(--coral)"]]
      .filter(e => e[0]).map(e => [...e, r.guestName, "Room " + r.roomNumber]))
  ].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  $("#actRows").innerHTML = ev.map(([t, a, i, c, g, r]) => `<tr><td>${clock(t)}</td><td><span class="act"><span style="color:${c}">${ic(i)}</span>${a}</span></td><td>${esc(g)}</td><td>${esc(r)}</td></tr>`).join("")
    || `<tr><td colspan="4" class="muted">No activity yet.</td></tr>`;
  paintIcons();
}

function renderRooms() {
  const rooms = [...S.rooms].sort(byNumber);
  $("#roomSummary").textContent = rooms.length
    ? `${nRooms("available")} available, ${nRooms("allocated")} allocated, ${nRooms("occupied")} occupied, ${nRooms("maintenance")} under maintenance`
    : "No rooms yet.";
  const btn = r => r.status === "available" ? `<button class="ghost" data-act="maint" data-id="${r.id}">Maintenance</button>`
    : r.status === "maintenance" ? `<button class="ghost" data-act="avail" data-id="${r.id}">Set available</button>` : "";
  $("#roomRows").innerHTML = rooms.map(r => `<tr><td>${esc(r.number)}</td><td>${esc(r.type)}</td><td><span class="st ${r.status}" style="color:var(--c,var(--mut))">${cap(r.status)}</span></td><td>${btn(r)}</td></tr>`).join("")
    || `<tr><td colspan="4" class="muted">No rooms yet.</td></tr>`;
  $("#roomGrid").innerHTML = rooms.map(r => `<div class="room ${r.status}"><b>${esc(r.number)}</b><span>${esc(r.type)}</span><em>${cap(r.status)}</em></div>`).join("")
    || `<p class="muted">No rooms yet.</p>`;
  keepSelect("#a-room", rooms.filter(r => r.status === "available").map(r => [r.id, `${r.number} - ${r.type}`]), "Choose a room");
}

function renderGuests() {
  const q = $("#g-search").value.trim().toLowerCase();
  const guests = [...S.guests].sort((a, b) => a.fullName.localeCompare(b.fullName));
  $("#guestRows").innerHTML = guests
    .filter(g => !q || [g.fullName, g.phone, g.idNumber].some(v => String(v || "").toLowerCase().includes(q)))
    .map(g => `<tr><td>${esc(g.fullName)}</td><td>${esc(g.phone)}</td><td>${esc(g.email)}</td><td>${esc(g.idNumber)}</td>
    <td><button class="ghost" data-act="edit" data-id="${g.id}">Edit</button></td></tr>`).join("")
    || `<tr><td colspan="5" class="muted">No guests found.</td></tr>`;
  keepSelect("#a-guest", guests.map(g => [g.id, `${g.fullName} (${g.idNumber})`]), "Choose a guest");
}

const regRow = r => `<tr><td>${esc(r.guestName)}</td><td>${esc(r.roomNumber)}</td><td>${esc(r.status)}</td>
  <td>${fmt(r.checkIn)}</td><td>${esc(r.expectedCheckout)}</td><td class="recep-only">
  ${r.status === "allocated" ? `<button data-act="in" data-id="${r.id}">Check in</button>` : ""}
  ${r.status === "checked-in" ? `<button data-act="out" data-id="${r.id}">Check out</button>` : ""}</td></tr>`;
function renderRegs() {
  const rank = { "checked-in": 0, allocated: 1, "checked-out": 2 };
  const regs = [...S.regs].sort((a, b) => rank[a.status] - rank[b.status] || (b.createdAt || "").localeCompare(a.createdAt || ""));
  $("#regRows").innerHTML = regs.map(regRow).join("") || `<tr><td colspan="6" class="muted">No bookings yet.</td></tr>`;
  $("#checkRows").innerHTML = regs.filter(r => r.status !== "checked-out").map(regRow).join("") || `<tr><td colspan="6" class="muted">Nobody is waiting to check in or out.</td></tr>`;
}

function renderReports() {
  const total = S.rooms.length, occ = nRooms("occupied");
  const done = S.regs.filter(r => r.status === "checked-out" && r.checkIn && r.checkOut);
  const hrs = done.length ? (done.reduce((s, r) => s + (new Date(r.checkOut) - new Date(r.checkIn)), 0) / done.length / 36e5).toFixed(1) + " hours" : "No completed stays yet";
  const rows = [["Rooms in the hotel", total], ["Current occupancy", total ? Math.round(occ / total * 100) + "%" : "-"], ["Guests registered", S.guests.length],
    ["Total bookings", S.regs.length], ["Awaiting check-in", S.regs.filter(r => r.status === "allocated").length],
    ["Currently checked in", S.regs.filter(r => r.status === "checked-in").length], ["Completed stays", done.length], ["Average length of stay", hrs]];
  $("#repRows").innerHTML = rows.map(([k, v]) => `<tr><th>${k}</th><td><b>${v}</b></td></tr>`).join("");
}

function keepSelect(sel, items, placeholder) {
  const el = $(sel), prev = el.value;
  el.innerHTML = `<option value="">${placeholder}</option>` + items.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join("");
  if (items.some(([v]) => v === prev)) el.value = prev;
}
$("#g-search").addEventListener("input", renderGuests);

/* ---------- Rooms (manager) ---------- */
$("#roomForm").addEventListener("submit", async e => {
  e.preventDefault();
  const number = $("#r-number").value.trim();
  if (!number) return ($("#roomErr").textContent = "Enter a room number.");
  if (S.rooms.some(r => String(r.number).toLowerCase() === number.toLowerCase())) return ($("#roomErr").textContent = `Room ${number} already exists.`);
  $("#roomErr").textContent = "";
  try { await addDoc(collection(db, "rooms"), { number, type: $("#r-type").value, status: "available" }); $("#r-number").value = ""; toast("Room added"); }
  catch (er) { fail(er, "add rooms"); }
});
$("#seed").onclick = async () => {
  const types = ["Single", "Single", "Double", "Suite"];
  try {
    for (const floor of [1, 2]) for (let i = 1; i <= 4; i++) {
      const number = String(floor * 100 + i);
      if (!S.rooms.some(r => r.number === number)) await addDoc(collection(db, "rooms"), { number, type: types[i - 1], status: "available" });
    }
    toast("Sample rooms added");
  } catch (er) { fail(er, "add rooms"); }
};

/* ---------- Guests (receptionist) ---------- */
function readGuest() {
  const g = { fullName: $("#g-name").value.trim(), phone: $("#g-phone").value.trim(), email: $("#g-email").value.trim(), idNumber: $("#g-id").value.trim() };
  let err = "";
  if (g.fullName.length < 2) err = "Enter the guest's full name.";
  else if (!/^\+?[0-9 ]{9,15}$/.test(g.phone)) err = "Enter a phone number with 9 to 15 digits.";
  else if (g.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(g.email)) err = "Enter a valid email address or leave it blank.";
  else if (!g.idNumber) err = "Enter the ID or passport number.";
  else if (S.guests.some(x => x.idNumber === g.idNumber && x.id !== S.editId)) err = "A guest with this ID number is already registered.";
  return { g, err };
}
$("#guestForm").addEventListener("submit", async e => {
  e.preventDefault();
  const { g, err } = readGuest();
  $("#guestErr").textContent = err;
  if (err) return;
  try {
    if (S.editId) await updateDoc(doc(db, "guests", S.editId), g);
    else await addDoc(collection(db, "guests"), { ...g, createdAt: new Date().toISOString() });
    toast(S.editId ? "Guest updated" : "Guest registered");
    resetGuestForm();
  } catch (er) { fail(er, "save guests"); }
});
function resetGuestForm() {
  S.editId = null; $("#guestForm").reset(); $("#guestErr").textContent = "";
  $("#guestTitle").textContent = "Register a guest"; $("#guestCancel").hidden = true;
}
$("#guestCancel").onclick = resetGuestForm;

/* ---------- Allocation, check-in, checkout (receptionist) ---------- */
$("#regForm").addEventListener("submit", async e => {
  e.preventDefault();
  const guest = S.guests.find(g => g.id === $("#a-guest").value);
  const roomId = $("#a-room").value, date = $("#a-date").value;
  const today = new Date().toISOString().slice(0, 10);
  const err = !guest ? "Choose a guest." : !roomId ? "Choose an available room." : !date || date < today ? "Expected checkout must be today or later." : "";
  $("#regErr").textContent = err;
  if (err) return;
  try {
    await runTransaction(db, async tx => {
      const roomRef = doc(db, "rooms", roomId), room = await tx.get(roomRef);
      if (!room.exists() || room.data().status !== "available") throw new Error("That room is no longer available. Choose another room.");
      tx.set(doc(collection(db, "registrations")), {
        guestId: guest.id, guestName: guest.fullName, roomId, roomNumber: room.data().number,
        status: "allocated", expectedCheckout: date, checkIn: null, checkOut: null, createdAt: new Date().toISOString()
      });
      tx.update(roomRef, { status: "allocated" });
    });
    toast("Room allocated"); $("#regForm").reset();
  } catch (er) { $("#regErr").textContent = er.message; fail(er, "allocate rooms"); }
});

async function moveStay(regId, from, to, roomStatus, stamp) {
  await runTransaction(db, async tx => {
    const regRef = doc(db, "registrations", regId), reg = await tx.get(regRef);
    if (!reg.exists() || reg.data().status !== from) throw new Error("This booking is not in the right state for that action.");
    tx.update(regRef, { status: to, [stamp]: new Date().toISOString() });
    tx.update(doc(db, "rooms", reg.data().roomId), { status: roomStatus });
  });
}

/* ---------- Button actions ---------- */
document.addEventListener("click", async e => {
  const go = e.target.closest("[data-go]");
  if (go) return showTab(go.dataset.go);
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const id = b.dataset.id;
  try {
    if (b.dataset.act === "maint") await updateDoc(doc(db, "rooms", id), { status: "maintenance" });
    else if (b.dataset.act === "avail") await updateDoc(doc(db, "rooms", id), { status: "available" });
    else if (b.dataset.act === "in") { await moveStay(id, "allocated", "checked-in", "occupied", "checkIn"); toast("Checked in"); }
    else if (b.dataset.act === "out") {
      if (!confirm("Check this guest out and free the room?")) return;
      await moveStay(id, "checked-in", "checked-out", "available", "checkOut"); toast("Checked out");
    } else if (b.dataset.act === "edit") {
      const g = S.guests.find(x => x.id === id);
      S.editId = id; $("#g-name").value = g.fullName; $("#g-phone").value = g.phone; $("#g-email").value = g.email || ""; $("#g-id").value = g.idNumber;
      $("#guestTitle").textContent = "Edit guest"; $("#guestCancel").hidden = false; $("#g-name").focus();
    }
  } catch (er) { fail(er, "do that"); }
});