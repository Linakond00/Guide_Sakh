const H = [
    { id: 1, name: "Оха", d: "Северный маршрут: сопки, тундровые озёра и побережье Охотского моря.", cap: 6, price: 4800, x: 49.5, y: 16.6, side: "r", busy: false },
    { id: 2, name: "Пильтунский залив", d: "Наблюдение за серыми китами с берега в тёплый сезон.", cap: 4, price: 6400, x: 52.6, y: 25.4, side: "r", busy: true },
    { id: 3, name: "Ноглики", d: "Река, лагуна и рыбалка на горбушу в сезон хода рыбы.", cap: 5, price: 4300, x: 51.6, y: 36.7, side: "r", busy: false },
    { id: 4, name: "Поронайск", d: "Лесные тропы и берег залива Терпения.", cap: 5, price: 3800, x: 51.3, y: 64.1, side: "r", busy: false },
    { id: 5, name: "Томари", d: "Побережье Татарского пролива и закаты над морем.", cap: 4, price: 3900, x: 38.0, y: 79.2, side: "l", busy: false },
    { id: 6, name: "Невельск", d: "Морской порт, маяк и дегустация морепродуктов.", cap: 6, price: 5200, x: 35.4, y: 92.8, side: "l", busy: false },
    { id: 7, name: "Южно-Сахалинск", d: "Подъём на гору Большевик и прогулка в «Горном воздухе».", cap: 8, price: 3900, x: 46.9, y: 87.1, side: "r", busy: true },
    { id: 8, name: "Мыс Анива", d: "Маяк на скалах и обзорная прогулка по Анивскому заливу.", cap: 6, price: 5900, x: 55.2, y: 94.2, side: "r", busy: false }];
const KEY = "sakhalin.bookings.v2";
const S = { sel: null, fCap: 0, fPrice: 1e6, b: [] };
const $ = s => document.querySelector(s);
const fmt = n => n.toLocaleString("ru-RU") + " ₽";
const msg = $("#msg");
function say(t, e) { msg.textContent = t; msg.className = e ? "err" : "" }
const byId = id => H.find(h => h.id === id);
const mineOf = h => S.b.find(b => b.houseId === h.id);
const isBusy = h => h.busy || !!mineOf(h);
const vis = h => h.cap >= S.fCap && h.price <= S.fPrice;
const stateOf = h => S.sel === h.id ? "sel" : h.busy ? "busy" : mineOf(h) ? "mine" : "free";
const MARK = { free: "", sel: "✓", busy: "✕", mine: "★" }, WORD = { free: "свободен", sel: "выбран", busy: "занят", mine: "моя бронь" };
const plural = (n, a) => a[n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2];

/* ===== v3: утилиты дат ===== */
const DAY = 864e5;
const toISO = d => {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + dd;
};
const parseISO = s => {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return isNaN(dt) || dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d ? null : dt;
};
const todayISO = () => toISO(new Date());
const diffDays = (a, b) => {
    const A = parseISO(a), B = parseISO(b);
    if (!A || !B) return null;
    return Math.round((B - A) / DAY);
};
const fmtRange = (a, b) => {
    const A = parseISO(a), B = parseISO(b);
    if (!A || !B) return "";
    if (A.getFullYear() === B.getFullYear() && A.getMonth() === B.getMonth())
        return A.getDate() + "–" + B.getDate() + " " + B.toLocaleDateString("ru-RU", { month: "long" });
    return A.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) + " — " + B.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
};

function ok(a, i, arr) {
    const h = a && typeof a === "object" ? byId(a.houseId) : null;
    if (!h || h.busy) return false;
    if (typeof a.id !== "string") return false;
    if (!Number.isInteger(a.guests) || a.guests < 1 || a.guests > h.cap) return false;
    if (!Number.isInteger(a.nights) || a.nights < 1 || a.nights > 14) return false;
    // даты опциональны для обратной совместимости
    const hasDates = a.start !== undefined || a.end !== undefined;
    if (hasDates) {
        const N = diffDays(a.start, a.end);
        if (N === null || N !== a.nights) return false;
    }
    if (a.total !== h.price * a.guests * a.nights) return false;
    return arr.findIndex(x => x.houseId === a.houseId) === i;
}

function load() {
    try {
        const r = localStorage.getItem(KEY); if (r === null) return; const a = JSON.parse(r);
        if (!Array.isArray(a) || !a.every(ok)) throw new Error("bad"); S.b = a
    }
    catch (e) { S.b = []; say("Сохранённые брони повреждены или недоступны — список начат заново. Данные заменятся при следующей брони.", 1) }
}
function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S.b)); return true }
    catch (e) { say("Не удалось сохранить: хранилище браузера недоступно. Бронь есть на странице, но после обновления пропадёт.", 1); return false }
}

const map = $("#map"), list = $("#list");
H.forEach(h => {
    const p = document.createElement("button"); p.type = "button"; p.className = "pin"; p.dataset.id = h.id; p.title = h.name; p.style.setProperty("--i", h.id); if (h.side === "l") p.classList.add("l"); p.style.left = h.x + "%"; p.style.top = h.y + "%"; map.append(p);
    const li = document.createElement("li"); const r = document.createElement("button"); r.type = "button"; r.className = "row"; r.dataset.id = h.id; li.append(r); list.append(li);
    h.pin = p; h.row = r; h.li = li
});
function onPick(e) { const b = e.target.closest("[data-id]"); if (b) pick(+b.dataset.id) }
map.addEventListener("click", onPick); list.addEventListener("click", onPick);

function pick(id) {
    const h = byId(id);
    if (isBusy(h)) { say("Маршрут «" + h.name + "» занят — выберите другой.", 1); return }
    S.sel = id; render(); bump(h); focusPin(h); say("Выбран маршрут «" + h.name + "»."); clearErr()
}

function check() {
    const h = byId(S.sel);
    const g = $("#g").value.trim();
    const d1 = $("#d1").value, d2 = $("#d2").value;
    const G = Number(g);
    let eg = "", ed = "";

    if (g === "") eg = "Укажите число человек.";
    else if (!Number.isInteger(G) || G < 1) eg = "Человек — целое число, не меньше 1.";
    else if (h && G > h.cap) eg = "В этой группе максимум человек: " + h.cap + ".";

    let N = null;
    if (!d1 || !d2) ed = "Выберите даты заезда и выезда.";
    else {
        const D1 = parseISO(d1), D2 = parseISO(d2);
        if (!D1 || !D2) ed = "Некорректная дата.";
        else if (D1 < parseISO(todayISO())) ed = "Дата заезда не может быть в прошлом.";
        else {
            N = diffDays(d1, d2);
            if (N === null || N < 1) ed = "Выезд должен быть позже заезда — минимум 1 день.";
            else if (N > 14) ed = "Можно забронировать до 14 дней.";
        }
    }

    const total = h && !eg && !ed && N ? h.price * G * N : null;
    return { G, N, eg, ed, total, d1, d2 };
}

function clearErr() {
    ["g", "d1", "d2"].forEach(k => {
        const el = document.getElementById(k);
        if (el) el.removeAttribute("aria-invalid");
    });
    $("#eg").textContent = "";
    $("#ed").textContent = "";
}

function showErr(c) {
    $("#eg").textContent = c.eg;
    $("#ed").textContent = c.ed;
    $("#g").toggleAttribute("aria-invalid", !!c.eg);
    $("#d1").toggleAttribute("aria-invalid", !!c.ed);
    $("#d2").toggleAttribute("aria-invalid", !!c.ed);
}

let tv = 0, traf;

function total() {
    const c = check(), el = $("#tot");
    if (c.total === null) { el.textContent = "Итого: —"; tv = 0; return c }
    el.innerHTML = "Итого: <span class='sr'>" + fmt(c.total) + "</span><span id='tv' aria-hidden='true'></span><small>" + c.G + " " + plural(c.G, ["человек", "человека", "человек"]) + " × " + c.N + " " + plural(c.N, ["день", "дня", "дней"]) + " × " + fmt(byId(S.sel).price) + "</small>";
    countTo($("#tv"), c.total);
    return c;
}

function render() {
    let shown = 0;
    H.forEach(h => {
        const v = vis(h), s = stateOf(h); if (v) shown++;
        h.pin.hidden = !v; h.li.hidden = !v;
        h.pin.dataset.s = s; h.row.dataset.s = s;
        h.pin.setAttribute("aria-pressed", S.sel === h.id); h.row.setAttribute("aria-pressed", S.sel === h.id);
        h.pin.setAttribute("aria-disabled", isBusy(h)); h.row.setAttribute("aria-disabled", isBusy(h));
        const lbl = h.name + ", до " + h.cap + " человек, " + fmt(h.price) + " с человека в день, " + WORD[s];
        h.pin.setAttribute("aria-label", lbl);
        h.pin.innerHTML = "<i class='dot' aria-hidden='true'>" + (s === "free" ? h.id : MARK[s]) + "</i><span class='nm' aria-hidden='true'>" + h.name + "</span>";
        h.row.innerHTML = "<em class='st'>" + (MARK[s] ? MARK[s] + " " : "") + WORD[s] + "</em><b>" + h.name + "</b><span class='ds'>" + h.d + "</span><span class='mt'>до " + h.cap + " человек · " + fmt(h.price) + " с человека в день</span>"
    });
    $("#none").hidden = shown > 0;
    $("#cnt").textContent = "Показано: " + shown + " из " + H.length;
    const h = byId(S.sel), box = $("#cardInfo");
    if (h) { box.innerHTML = "<h3 class='cn'>" + h.name + "</h3><p class='cd'>" + h.d + "</p><p class='chips'><span>до " + h.cap + " человек</span><span>" + fmt(h.price) + " с человека в день</span></p>"; $("#g").max = h.cap }
    else box.innerHTML = "<p class='empty'>Выберите свободный маршрут на схеме или в списке.</p>";
    total(); renderBooks()
}

function renderBooks() {
    const w = $("#books"); w.textContent = "";
    if (!S.b.length) { w.innerHTML = "<p class='empty'>Пока нет броней. Выберите маршрут на карте — билет появится здесь.</p>" }
    S.b.forEach(b => {
        const h = byId(b.houseId), d = document.createElement("article"); d.className = "tk" + (b.id === S.fresh ? " new" : "");
        const dates = b.start && b.end ? fmtRange(b.start, b.end) : b.nights + " " + plural(b.nights, ["день", "дня", "дней"]);
        d.innerHTML = "<div class='tl'><small>Билет SAKH-" + h.id + "-" + b.id.slice(-4) + "</small><b>" + h.name + "</b><span>" + b.guests + " " + plural(b.guests, ["человек", "человека", "человек"]) + ", " + dates + "</span></div><div class='tr'><strong>" + fmt(b.total) + "</strong></div>";
        const x = document.createElement("button"); x.type = "button"; x.className = "btn alt"; x.textContent = "Отменить"; x.dataset.cancel = b.id; x.setAttribute("aria-label", "Отменить бронь: " + h.name);
        d.querySelector(".tr").append(x); w.append(d)
    });
    $("#clr").disabled = !S.b.length
}

function confirmBook() {
    const h = byId(S.sel);
    if (!h) { say("Сначала выберите свободный маршрут на схеме или в списке.", 1); return }
    if (isBusy(h)) { say("Маршрут уже занят.", 1); return }
    const c = check(); showErr(c);
    if (c.total === null) { say("Исправьте ошибки в форме.", 1); (c.eg ? $("#g") : $("#d1")).focus(); return }
    const nid = Date.now() + "-" + h.id; S.fresh = nid;
    S.b.push({ id: nid, houseId: h.id, guests: c.G, nights: c.N, start: c.d1, end: c.d2, total: c.total });
    S.sel = null; const saved = save(); render(); S.fresh = null; if (saved) burst();
    if (saved) say("Бронь оформлена: «" + h.name + "», " + fmt(c.total) + ", " + fmtRange(c.d1, c.d2) + ".");
    $("#bh").focus()
}

$("#ok").addEventListener("click", confirmBook);
["g", "d1", "d2"].forEach(k => $("#" + k).addEventListener("input", () => { showErr(total()); syncDates(); }));
$("#books").addEventListener("click", e => {
    const b = e.target.closest("[data-cancel]"); if (!b) return;
    const i = S.b.findIndex(x => x.id === b.dataset.cancel); if (i < 0) return;
    const h = byId(S.b[i].houseId); S.b.splice(i, 1);
    const saved = save(); render(); if (saved) say("Бронь маршрута «" + h.name + "» отменена, маршрут снова свободен."); $("#bh").focus()
});
$("#clr").addEventListener("click", () => { S.b = []; const s = save(); render(); if (s) say("Ваши брони удалены. Изначально занятые маршруты остались занятыми."); $("#bh").focus() });

function filt() {
    syncDD();
    S.fCap = +$("#fc").value; S.fPrice = +$("#fp").value;
    const h = byId(S.sel); let note = "";
    if (h && !vis(h)) { S.sel = null; note = " Выбранный маршрут не подходит под фильтры — выбор снят." }
    render();
    say((document.querySelectorAll("#list li:not([hidden])").length ? "Фильтры применены." : "Нет маршрутов под эти фильтры.") + note)
}
$("#fc").addEventListener("change", filt); $("#fp").addEventListener("change", filt);
$("#fr").addEventListener("click", () => { $("#fc").value = "0"; $("#fp").value = "1000000"; filt(); say("Фильтры сброшены. Брони не затронуты.") });

/* ===== v2: анимации и атмосфера ===== */
const RM = matchMedia("(prefers-reduced-motion:reduce)").matches, NS = "http://www.w3.org/2000/svg";
function countTo(el, to) {
    if (RM) { el.textContent = fmt(to); tv = to; return }
    const from = tv, t0 = performance.now(); tv = to; cancelAnimationFrame(traf);
    (function f(t) { const p = Math.min(1, (t - t0) / 450); el.textContent = fmt(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)))); if (p < 1) traf = requestAnimationFrame(f) })(t0)
}
function bump(h) { h.pin.classList.remove("bump"); void h.pin.offsetWidth; h.pin.classList.add("bump") }

// заголовок по буквам
(() => {
    const e = $("h1"), t = e.textContent; e.setAttribute("aria-label", t); e.textContent = "";
    [...t].forEach((c, i) => { const s = document.createElement("span"); s.className = "ch"; s.setAttribute("aria-hidden", "true"); s.style.setProperty("--k", i); s.textContent = c; e.append(s) })
})();
H.forEach(h => h.li.style.setProperty("--i", h.id));

// живая карта: маршрут, облака, кит, путешественник
(() => {
    if (RM) return;
    const svg = map.querySelector("svg"), route = svg.querySelector('path[stroke="#ff8a00"]');
    const add = (tag, at, par = svg) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); par.append(e); return e };
    route.id = "routePath"; route.classList.add("route");
    const f = add("filter", { id: "blur", x: "-50%", y: "-50%", width: "200%", height: "200%" }, svg.querySelector("defs")); add("feGaussianBlur", { stdDeviation: "1.4" }, f);
    const cl = add("g", { filter: "url(#blur)" });
    [[10, 40, 9, 2.4, 0], [30, 100, 11, 2.8, -14], [0, 160, 8, 2.2, -27]].forEach(([x, y, rx, ry, d]) => { add("ellipse", { cx: x, cy: y, rx, ry, fill: "#fff", opacity: .65, class: "cloud" }, cl).style.animationDelay = d + "s" });
    const w = add("g", { transform: "translate(80 48)" });
    const m = add("circle", { r: 1.3, fill: "#7c4dd8", stroke: "#fff", "stroke-width": .5 });
    add("mpath", { href: "#routePath" }, add("animateMotion", { dur: "30s", repeatCount: "indefinite" }, m))
})();

// связь «пин ↔ строка» и подсветка под курсором
function link(e, on) { const b = e.target.closest("[data-id]"); if (!b) return; const h = byId(+b.dataset.id); h.pin.classList.toggle("hl", on); h.row.classList.toggle("hl", on) }
[map, list].forEach(c => { c.addEventListener("mouseover", e => link(e, 1)); c.addEventListener("mouseout", e => link(e, 0)); c.addEventListener("focusin", e => link(e, 1)); c.addEventListener("focusout", e => link(e, 0)) });
list.addEventListener("pointermove", e => { const r = e.target.closest(".row"); if (!r) return; const b = r.getBoundingClientRect(); r.style.setProperty("--mx", e.clientX - b.left + "px"); r.style.setProperty("--my", e.clientY - b.top + "px") });
const _say = say; say = function (t, e) { _say(t, e); msg.classList.remove("pop"); void msg.offsetWidth; msg.classList.add("pop") };
document.addEventListener("keydown", e => { if (e.key === "Escape" && S.sel !== null) { S.sel = null; clearErr(); render(); say("Выбор снят.") } });

// фон: пыльца и брызги + конфетти при брони
const cv = $("#fx"), cx = cv.getContext("2d"), COL = ["255,138,0", "124,77,216", "47,138,108", "79,138,163"];
let W, HH, K = 1, P = [], mx = 0, my = 0;
function size() { K = Math.min(devicePixelRatio || 1, 2); W = cv.width = innerWidth * K; HH = cv.height = innerHeight * K }
function mk(x, y, burst) {
    return {
        x: x ?? Math.random() * W, y: y ?? Math.random() * HH, z: .3 + Math.random(), c: COL[Math.random() * 4 | 0], rot: 0, vr: (Math.random() - .5) * .4,
        r: (burst ? 3 + Math.random() * 4 : 1.5 + Math.random() * 3.5) * K,
        vx: burst ? (Math.random() - .5) * 16 * K : (.12 + Math.random() * .3) * K, vy: burst ? (-5 - Math.random() * 11) * K : -(.1 + Math.random() * .35) * K,
        a: burst ? 1 : .22 + Math.random() * .3, life: burst ? 1 : null
    }
}
function burst() {
    if (RM) return; const r = $("#ok").getBoundingClientRect();
    for (let i = 0; i < 80; i++) P.push(mk((r.left + r.width / 2) * K, (r.top + r.height / 2) * K, true))
}
function tick() {
    cx.clearRect(0, 0, W, HH);
    P.forEach(p => {
        const b = p.life !== null; if (b) { p.vy += .35 * K; p.life -= .012; p.rot += p.vr }
        else { p.x += Math.sin((p.y + p.z * 500) / 90) * .25 * K; if (p.y < -10) { p.y = HH + 10; p.x = Math.random() * W } if (p.x > W + 10) p.x = -10 }
        p.x += p.vx; p.y += p.vy;
        cx.globalAlpha = b ? Math.max(p.life, 0) : p.a; cx.fillStyle = "rgb(" + p.c + ")";
        const px = p.x + (b ? 0 : mx * p.z * 40 * K), py = p.y + (b ? 0 : my * p.z * 40 * K);
        if (b) { cx.save(); cx.translate(px, py); cx.rotate(p.rot); cx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); cx.restore() }
        else { cx.beginPath(); cx.arc(px, py, p.r, 0, 6.283); cx.fill() }
    });
    P = P.filter(p => p.life === null || p.life > 0); requestAnimationFrame(tick)
}
if (!RM) { size(); for (let i = 0; i < 46; i++) P.push(mk()); addEventListener("resize", size); addEventListener("pointermove", e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5 }); tick() }

// карта в прокручиваемом окне: центрируем выбранную точку
function focusPin(h) { const mv = $("#mv"); if (mv.scrollHeight <= mv.clientHeight + 2) return; mv.scrollTo({ top: h.pin.offsetTop - mv.clientHeight / 2, behavior: RM ? "auto" : "smooth" }) }

$("#rnd").addEventListener("click", () => {
    const free = H.filter(h => vis(h) && !isBusy(h)), btn = $("#rnd");
    if (!free.length) { say("Нет свободных маршрутов под эти фильтры.", 1); return }
    let n = 0, prev; const tot = 14 + (Math.random() * free.length | 0); btn.disabled = true;
    (function step() {
        if (prev) { prev.pin.classList.remove("hl"); prev.row.classList.remove("hl") }
        const h = free[n % free.length];
        if (n === tot || RM) { btn.disabled = false; pick(h.id); return }
        h.pin.classList.add("hl"); h.row.classList.add("hl"); focusPin(h); prev = h; n++; setTimeout(step, 50 + n * n * .7)
    })()
});

// своё выпадающее меню вместо системного select
const DD = [];
function syncDD() { DD.forEach(f => f()) }
["fc", "fp"].forEach(id => {
    const sel = $("#" + id), lab = document.querySelector('label[for="' + id + '"]'), opts = [...sel.options];
    const w = document.createElement("div"), b = document.createElement("button"), ul = document.createElement("ul");
    w.className = "dd"; b.type = "button"; b.className = "dd-btn"; b.id = id + "-dd"; ul.className = "dd-list"; ul.id = id + "-lb"; ul.hidden = true;
    b.setAttribute("role", "combobox"); b.setAttribute("aria-haspopup", "listbox"); b.setAttribute("aria-expanded", "false"); b.setAttribute("aria-controls", ul.id);
    ul.setAttribute("role", "listbox"); lab.setAttribute("for", b.id);
    b.innerHTML = "<span></span><i class='chev' aria-hidden='true'></i>";
    opts.forEach((o, i) => { const li = document.createElement("li"); li.id = id + "-o" + i; li.setAttribute("role", "option"); li.dataset.i = i; li.textContent = o.textContent; ul.append(li) });
    const items = [...ul.children]; let act = 0, open = false, eat = false;
    function paint() {
        b.firstChild.textContent = opts[sel.selectedIndex].textContent;
        items.forEach((li, i) => { li.setAttribute("aria-selected", i === sel.selectedIndex); li.classList.toggle("act", open && i === act) });
        open ? b.setAttribute("aria-activedescendant", items[act].id) : b.removeAttribute("aria-activedescendant")
    }
    function set(o) { open = o; ul.hidden = !o; w.classList.toggle("open", o); b.setAttribute("aria-expanded", o); if (o) act = sel.selectedIndex; paint() }
    function choose(i) { sel.selectedIndex = i; sel.dispatchEvent(new Event("change")); set(false) }
    b.addEventListener("click", () => { if (eat) { eat = false; return } set(!open) });
    b.addEventListener("keyup", e => { if (e.key === " ") setTimeout(() => eat = false) });
    b.addEventListener("keydown", e => {
        const k = e.key;
        if (k === "ArrowDown" || k === "ArrowUp") { e.preventDefault(); if (!open) { set(true); return } act = (act + (k === "ArrowDown" ? 1 : -1) + opts.length) % opts.length; paint() }
        else if ((k === "Home" || k === "End") && open) { e.preventDefault(); act = k === "Home" ? 0 : opts.length - 1; paint() }
        else if ((k === "Enter" || k === " ") && open) { e.preventDefault(); if (k === " ") eat = true; choose(act) }
        else if (k === "Escape" && open) { e.preventDefault(); e.stopPropagation(); set(false) }
        else if (k === "Tab" && open) set(false)
    });
    ul.addEventListener("mousedown", e => e.preventDefault());
    ul.addEventListener("click", e => { const li = e.target.closest("li"); if (li) choose(+li.dataset.i) });
    ul.addEventListener("mousemove", e => { const li = e.target.closest("li"); if (li && act !== +li.dataset.i) { act = +li.dataset.i; paint() } });
    document.addEventListener("pointerdown", e => { if (open && !w.contains(e.target)) set(false) });
    sel.hidden = true; sel.before(w); w.append(b, ul, sel); DD.push(paint); paint()
});

/* ===== v3: синхронизация дат ===== */
function syncDates() {
    const d1 = $("#d1"), d2 = $("#d2");
    const t = todayISO();
    d1.min = t;
    if (d1.value && parseISO(d1.value)) {
        const next = new Date(parseISO(d1.value).getTime() + DAY);
        d2.min = toISO(next);
        if (d2.value && parseISO(d2.value) && parseISO(d2.value) <= parseISO(d1.value)) {
            d2.value = toISO(next);
        }
    } else {
        d2.removeAttribute("min");
    }
}

(function initDates() {
    const d1 = $("#d1"), d2 = $("#d2");
    const t = new Date();
    d1.value = toISO(t);
    d2.value = toISO(new Date(t.getTime() + 2 * DAY));
    syncDates();
})();

load(); render();
setTimeout(() => document.body.classList.add("ready"), 2800);