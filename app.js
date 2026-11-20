import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";
import { collection, doc, getDoc, addDoc, updateDoc, onSnapshot, runTransaction }
  from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const S = { role: null, rooms: [], guests: [], regs: [], unsubs: [], editId: null };

function toast(msg, bad) {
  const t = $("#toast");
  t.textContent = msg; t.className = "show " + (bad ? "bad" : "ok");
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = ""), 3500);
}
const fail = (e, what) => toast(e.code === "permission-denied" ? "You don't have permission to " + what : e.message || "Something went wrong", true);

/* ---------- Auth (FR-01) ---------- */
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  try { await signInWithEmailAndPassword(auth, $("#email").value.trim(), $("#password").value); }
  catch { toast("Email or password is incorrect", true); }
});
$("#logout").onclick = () => signOut(auth);

onAuthStateChanged(auth, async user => {
  S.unsubs.forEach(u => u()); S.unsubs = [];
  if (!user) { S.role = null; $("#app").hidden = true; $("#login").hidden = false; return; }
  try { const s = await getDoc(doc(db, "users", user.uid)); S.role = s.exists() ? s.data().role : null; }
  catch { S.role = null; }
  if (!["receptionist", "manager"].includes(S.role)) { toast("This account has no role assigned", true); signOut(auth); return; }
  document.body.dataset.role = S.role;
  $("#who").textContent = `${user.email} (${S.role})`;
  $("#login").hidden = true; $("#app").hidden = false;
  for (const [name, key] of [["rooms", "rooms"], ["guests", "guests"], ["registrations", "regs"]])
    S.unsubs.push(onSnapshot(collection(db, name),
      snap => { S[key] = snap.docs.map(d => ({ id: d.id, ...d.data() })); render(); },
      e => fail(e, "view " + name)));
});

/* ---------- Tabs ---------- */
document.querySelectorAll("nav button").forEach(b => b.onclick = () => {
  document.querySelectorAll("nav button").forEach(x => x.classList.toggle("on", x === b));
  for (const t of ["rooms", "guests", "regs"]) $("#tab-" + t).hidden = t !== b.dataset.tab;
});

/* ---------- Rendering ---------- */
const byNumber = (a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true });
const fmt = iso => iso ? new Date(iso).toLocaleString() : "-";

function render() {
  const rooms = [...S.rooms].sort(byNumber);
  const count = s => rooms.filter(r => r.status === s).length;
  $("#roomSummary").textContent = rooms.length
    ? `${count("available")} available, ${count("allocated")} allocated, ${count("occupied")} occupied, ${count("maintenance")} under maintenance`
    : "No rooms yet. A manager can add rooms below.";
  $("#roomGrid").innerHTML = rooms.map(r => `<div class="room ${r.status}"><b>${esc(r.number)}</b><span>${esc(r.type)}</span><em>${esc(r.status)}</em>
    <div class="mgr-only">${r.status === "available" ? `<button class="ghost" data-act="maint" data-id="${r.id}">Maintenance</button>`
      : r.status === "maintenance" ? `<button class="ghost" data-act="avail" data-id="${r.id}">Set available</button>` : ""}</div></div>`).join("");

  const q = $("#g-search").value.trim().toLowerCase();
  const guests = [...S.guests].sort((a, b) => a.fullName.localeCompare(b.fullName))
    .filter(g => !q || [g.fullName, g.phone, g.idNumber].some(v => String(v || "").toLowerCase().includes(q)));
  $("#guestRows").innerHTML = guests.map(g => `<tr><td>${esc(g.fullName)}</td><td>${esc(g.phone)}</td><td>${esc(g.email)}</td><td>${esc(g.idNumber)}</td>
    <td class="recep-only"><button class="ghost" data-act="edit" data-id="${g.id}">Edit</button></td></tr>`).join("")
    || `<tr><td colspan="5" class="muted">No guests found.</td></tr>`;

  keepSelect("#a-guest", [...S.guests].sort((a, b) => a.fullName.localeCompare(b.fullName)).map(g => [g.id, `${g.fullName} (${g.idNumber})`]), "Choose a guest");
  keepSelect("#a-room", rooms.filter(r => r.status === "available").map(r => [r.id, `${r.number} - ${r.type}`]), "Choose a room");

  const rank = { "checked-in": 0, allocated: 1, "checked-out": 2 };
  const regs = [...S.regs].sort((a, b) => rank[a.status] - rank[b.status] || (b.createdAt || "").localeCompare(a.createdAt || ""));
  $("#regRows").innerHTML = regs.map(r => `<tr><td>${esc(r.guestName)}</td><td>${esc(r.roomNumber)}</td><td>${esc(r.status)}</td>
    <td>${fmt(r.checkIn)}</td><td>${esc(r.expectedCheckout)}</td><td class="recep-only">
    ${r.status === "allocated" ? `<button data-act="in" data-id="${r.id}">Check in</button>` : ""}
    ${r.status === "checked-in" ? `<button data-act="out" data-id="${r.id}">Check out</button>` : ""}</td></tr>`).join("")
    || `<tr><td colspan="6" class="muted">No registrations yet.</td></tr>`;
}
function keepSelect(sel, items, placeholder) {
  const el = $(sel), prev = el.value;
  el.innerHTML = `<option value="">${placeholder}</option>` + items.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join("");
  if (items.some(([v]) => v === prev)) el.value = prev;
}
$("#g-search").addEventListener("input", render);

/* ---------- Rooms (FR-04, FR-05) ---------- */
$("#roomForm").addEventListener("submit", async e => {
  e.preventDefault();
  const number = $("#r-number").value.trim();
  if (!number) return ($("#roomErr").textContent = "Enter a room number.");
  if (S.rooms.some(r => String(r.number).toLowerCase() === number.toLowerCase()))
    return ($("#roomErr").textContent = `Room ${number} already exists.`);
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

/* ---------- Guests (FR-02, FR-03, FR-10) ---------- */
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

/* ---------- Allocation, check-in, checkout (FR-06, FR-07, FR-08) ---------- */
$("#regForm").addEventListener("submit", async e => {
  e.preventDefault();
  const guest = S.guests.find(g => g.id === $("#a-guest").value);
  const roomId = $("#a-room").value, date = $("#a-date").value;
  const today = new Date().toISOString().slice(0, 10);
  const err = !guest ? "Choose a guest." : !roomId ? "Choose an available room." : !date || date < today ? "Expected checkout must be today or later." : "";
  $("#regErr").textContent = err;
  if (err) return;
  try {
    // One transaction: re-check the room, create the registration, mark the room allocated.
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
    if (!reg.exists() || reg.data().status !== from) throw new Error("This registration is not in the right state for that action.");
    tx.update(regRef, { status: to, [stamp]: new Date().toISOString() });
    tx.update(doc(db, "rooms", reg.data().roomId), { status: roomStatus });
  });
}

/* ---------- Button actions ---------- */
document.addEventListener("click", async e => {
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
