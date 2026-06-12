'use strict';

const $ = (id) => document.getElementById(id);

// ---------- State ----------
const state = {
    type: 'type1',
    mv: 50,
    testValve: 'A',
    theme: localStorage.getItem('srv-theme') || 'light',
    applyMV: null, // ค่า MV ที่ปุ่ม "ใช้ค่านี้" จะส่งไปหน้าจำลอง
};

const MODE_LABEL = {
    type1: 'ตรงข้ามกัน (M Type)',
    type2: 'ตามลำดับ (N Type)',
    type3: 'แบบผสม (M+N Type)',
};

const VALVES = ['A', 'B', 'C'];
const prevOut = { A: null, B: null, C: null };

// ---------- Core math ----------
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function forward(type, mv) {
    mv = clamp(mv, 0, 100);
    let A = 0, B = 0, C = 0;
    if (type === 'type1') {
        if (mv < 50) B = (50 - mv) * 2;
        else if (mv > 50) A = (mv - 50) * 2;
    } else if (type === 'type2') {
        if (mv <= 50) {
            A = mv * 2;
        } else {
            A = 100;
            B = (mv - 50) * 2;
        }
    } else {
        if (mv <= 33) {
            A = 100 - (mv / 33) * 100;
        } else if (mv <= 66) {
            B = ((mv - 33) / 33) * 100;
        } else {
            B = 100;
            C = ((mv - 66) / 34) * 100;
        }
    }
    return { A: clamp(A, 0, 100), B: clamp(B, 0, 100), C: clamp(C, 0, 100) };
}

// คำนวณย้อนกลับ: ต้องป้อน MV เท่าไหร่ให้วาล์วเปิดตาม % ที่ต้องการ
// คืนค่า { mv, mvMax (ถ้าคำตอบเป็นช่วง), info }
function reverse(type, valve, d) {
    if (type === 'type1') {
        if (valve === 'A') {
            return d === 0
                ? { mv: 0, mvMax: 50, info: 'MV ค่าใดก็ได้ในช่วงนี้ วาล์ว A จะปิดสนิท' }
                : { mv: 50 + d / 2, info: 'วาล์ว B ปิดสนิท' };
        }
        return d === 0
            ? { mv: 50, mvMax: 100, info: 'MV ค่าใดก็ได้ในช่วงนี้ วาล์ว B จะปิดสนิท' }
            : { mv: 50 - d / 2, info: 'วาล์ว A ปิดสนิท' };
    }
    if (type === 'type2') {
        if (valve === 'A') {
            return d === 100
                ? { mv: 50, mvMax: 100, info: 'วาล์ว A เปิดเต็มตลอดช่วงนี้ ส่วน B เปิด 0–100% ตาม MV' }
                : { mv: d / 2, info: 'วาล์ว B ปิดสนิท' };
        }
        return d === 0
            ? { mv: 0, mvMax: 50, info: 'วาล์ว B ปิดตลอดช่วงนี้ ส่วน A เปิด 0–100% ตาม MV' }
            : { mv: 50 + d / 2, info: 'วาล์ว A จะเปิดเต็ม 100% ด้วย' };
    }
    // type3
    if (valve === 'A') {
        return d === 0
            ? { mv: 33, mvMax: 100, info: 'วาล์ว A ปิดตลอดช่วงนี้ ส่วน B/C ขึ้นกับค่า MV' }
            : { mv: ((100 - d) / 100) * 33, info: 'วาล์ว B กับ C ปิดสนิท' };
    }
    if (valve === 'B') {
        if (d === 0) return { mv: 0, mvMax: 33, info: 'วาล์ว B ปิดตลอดช่วงนี้ ส่วน A เปิดตาม MV' };
        if (d === 100) return { mv: 66, mvMax: 100, info: 'วาล์ว B เปิดเต็มตลอดช่วงนี้ ส่วน C เปิดตาม MV' };
        return { mv: (d / 100) * 33 + 33, info: 'วาล์ว A กับ C ปิดสนิท' };
    }
    return d === 0
        ? { mv: 0, mvMax: 66, info: 'วาล์ว C ปิดตลอดช่วงนี้' }
        : { mv: (d / 100) * 34 + 66, info: 'วาล์ว A ปิด, วาล์ว B เปิดเต็ม 100%' };
}

// ---------- Helpers ----------
function sanitizeDecimal(input) {
    const cleaned = input.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    if (cleaned !== input.value) input.value = cleaned;
    return cleaned;
}

function vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
}

// ---------- Render: simulator ----------
const chipState = (v) => (v <= 0 ? ['close', 'ปิดสนิท'] : v >= 100 ? ['open', 'เปิดเต็มที่'] : ['mid', 'กำลังเปิด']);

function render() {
    const out = forward(state.type, state.mv);

    for (const v of VALVES) {
        $(`fill${v}`).style.width = `${out[v]}%`;
        $(`pct${v}`).textContent = `${out[v].toFixed(1)}%`;
        const [cls, label] = chipState(out[v]);
        const chip = $(`chip${v}`);
        chip.className = `chip ${cls}`;
        chip.textContent = label;

        // Haptic: สั่นเบาๆ เมื่อวาล์วแตะ 0% หรือ 100% (ข้ามครั้งแรกตอนโหลด)
        const prev = prevOut[v];
        if (prev !== null) {
            const atEdge = out[v] <= 0 || out[v] >= 100;
            const wasEdge = prev <= 0 || prev >= 100;
            if (atEdge && !wasEdge) vibrate(20);
        }
        prevOut[v] = out[v];
    }

    drawChart();
    updateSliderTrack();
}

function updateSliderTrack() {
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const track = getComputedStyle(document.documentElement).getPropertyValue('--track').trim();
    $('mvSlider').style.background = `linear-gradient(to right, ${accent} ${state.mv}%, ${track} ${state.mv}%)`;
}

// ---------- Chart ----------
const CHART = { x0: 34, x1: 306, y0: 126, y1: 12 }; // viewBox 320x170

const cx = (mv) => CHART.x0 + (mv / 100) * (CHART.x1 - CHART.x0);
const cy = (open) => CHART.y0 - (open / 100) * (CHART.y0 - CHART.y1);

function drawChart() {
    const colors = {
        A: getComputedStyle(document.documentElement).getPropertyValue('--valve-a').trim(),
        B: getComputedStyle(document.documentElement).getPropertyValue('--valve-b').trim(),
        C: getComputedStyle(document.documentElement).getPropertyValue('--valve-c').trim(),
    };
    const marker = getComputedStyle(document.documentElement).getPropertyValue('--marker').trim();
    const axis = getComputedStyle(document.documentElement).getPropertyValue('--axis').trim();
    const text3 = getComputedStyle(document.documentElement).getPropertyValue('--text3').trim();
    const cardBg = getComputedStyle(document.documentElement).getPropertyValue('--card').trim();

    const valves = state.type === 'type3' ? VALVES : ['A', 'B'];
    const ticks = state.type === 'type3' ? [0, 33, 66, 100] : [0, 50, 100];

    let svg = '';
    // axes
    svg += `<line x1="${CHART.x0}" y1="${CHART.y1}" x2="${CHART.x0}" y2="${CHART.y0}" stroke="${axis}" stroke-width="1.5"/>`;
    svg += `<line x1="${CHART.x0}" y1="${CHART.y0}" x2="${CHART.x1}" y2="${CHART.y0}" stroke="${axis}" stroke-width="1.5"/>`;
    svg += `<text x="6" y="${CHART.y1 + 4}" font-size="9" fill="${text3}">100%</text>`;
    svg += `<text x="14" y="${CHART.y0 + 3}" font-size="9" fill="${text3}">0%</text>`;
    for (const t of ticks) {
        const x = cx(t);
        if (t > 0 && t < 100) {
            svg += `<line x1="${x}" y1="${CHART.y1}" x2="${x}" y2="${CHART.y0}" stroke="${axis}" stroke-width="1" stroke-dasharray="3 3"/>`;
        }
        svg += `<text x="${x}" y="${CHART.y0 + 16}" font-size="9" fill="${text3}" text-anchor="middle">${t === 50 ? 'MV 50' : t}</text>`;
    }

    // valve curves (sample ทุก 0.5% ให้ตรงกับสูตร forward เสมอ)
    for (const v of valves) {
        const pts = [];
        for (let mv = 0; mv <= 100; mv += 0.5) {
            pts.push(`${cx(mv).toFixed(1)},${cy(forward(state.type, mv)[v]).toFixed(1)}`);
        }
        svg += `<polyline points="${pts.join(' ')}" fill="none" stroke="${colors[v]}" stroke-width="2.5" stroke-linejoin="round"/>`;
    }

    // current MV marker
    const out = forward(state.type, state.mv);
    const mx = cx(state.mv);
    svg += `<line x1="${mx}" y1="${CHART.y1}" x2="${mx}" y2="${CHART.y0}" stroke="${marker}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    for (const v of valves) {
        svg += `<circle cx="${mx}" cy="${cy(out[v])}" r="5" fill="${marker}" stroke="${cardBg}" stroke-width="2"/>`;
    }
    svg += `<text x="${clamp(mx + 7, CHART.x0, CHART.x1 - 58)}" y="${CHART.y1 + 10}" font-size="10" fill="${marker}" font-weight="600">MV ${state.mv.toFixed(1)}</text>`;

    // legend
    let lx = CHART.x0 + 6;
    for (const v of valves) {
        svg += `<circle cx="${lx}" cy="160" r="4" fill="${colors[v]}"/>`;
        svg += `<text x="${lx + 8}" y="163" font-size="10" fill="${text3}">วาล์ว ${v}</text>`;
        lx += 70;
    }

    $('chart').innerHTML = svg;
}

// ---------- MV input handling ----------
function setMV(value, { syncInput = true } = {}) {
    state.mv = clamp(Math.round(value * 10) / 10, 0, 100);
    $('mvSlider').value = state.mv;
    if (syncInput) $('mvInput').value = state.mv.toFixed(1);
    render();
}

$('mvInput').addEventListener('input', () => {
    const raw = sanitizeDecimal($('mvInput'));
    if (raw === '' || raw === '.') return;
    let value = parseFloat(raw);
    if (isNaN(value)) return;
    // เกิน 100 → ดึงกลับมาที่ 100 ทันที ไม่ปล่อยให้ตัวเลขค้างเกินจริง
    if (value > 100) {
        value = 100;
        $('mvInput').value = '100';
    }
    setMV(value, { syncInput: false });
});

$('mvInput').addEventListener('blur', () => {
    const value = parseFloat($('mvInput').value);
    setMV(isNaN(value) ? 0 : value);
});

$('mvInput').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') $('mvInput').blur();
});

$('mvSlider').addEventListener('input', () => {
    setMV(parseFloat($('mvSlider').value));
});

document.querySelectorAll('.step').forEach((btn) => {
    btn.addEventListener('click', () => {
        setMV(state.mv + parseFloat(btn.dataset.delta));
        vibrate(8);
    });
});

// ---------- Mode selection ----------
function selectType(type) {
    state.type = type;
    document.querySelectorAll('#modeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.type === type));
    $('modeSub').textContent = MODE_LABEL[type];

    const hasC = type === 'type3';
    $('rowC').classList.toggle('hidden', !hasC);
    document.querySelector('#valvePills [data-valve="C"]').classList.toggle('hidden', !hasC);
    if (!hasC && state.testValve === 'C') selectTestValve('A');

    prevOut.A = prevOut.B = prevOut.C = null; // ไม่ต้องสั่นตอนสลับโหมด
    render();
    renderReverse();
}

document.querySelectorAll('#modeSeg button').forEach((btn) => {
    btn.addEventListener('click', () => selectType(btn.dataset.type));
});

// ---------- Theme ----------
function applyTheme(theme) {
    state.theme = theme;
    localStorage.setItem('srv-theme', theme);
    document.documentElement.dataset.theme = theme;
    $('themeBtn').textContent = theme === 'light' ? '🌙' : '☀️';
    document.querySelector('meta[name="theme-color"]').content = theme === 'light' ? '#f8fafc' : '#0b1220';
    render();
}

$('themeBtn').addEventListener('click', () => {
    applyTheme(state.theme === 'light' ? 'dark' : 'light');
});

// ---------- Bottom sheets & nav ----------
function openSheet(id) {
    closeSheets();
    $('overlay').classList.add('show');
    $(id).classList.add('show');
    $('navTest').classList.toggle('on', id === 'testSheet');
    $('navHelp').classList.toggle('on', id === 'helpSheet');
    $('navSim').classList.remove('on');
}

function closeSheets() {
    $('overlay').classList.remove('show');
    document.querySelectorAll('.sheet').forEach((s) => s.classList.remove('show'));
    $('navTest').classList.remove('on');
    $('navHelp').classList.remove('on');
    $('navSim').classList.add('on');
}

$('navSim').addEventListener('click', closeSheets);
$('navTest').addEventListener('click', () => openSheet('testSheet'));
$('navHelp').addEventListener('click', () => openSheet('helpSheet'));
$('overlay').addEventListener('click', closeSheets);
document.querySelectorAll('.sheet-grab').forEach((g) => g.addEventListener('click', closeSheets));

// ---------- Reverse calculator (live) ----------
function selectTestValve(valve) {
    state.testValve = valve;
    document.querySelectorAll('#valvePills button').forEach((b) => b.classList.toggle('on', b.dataset.valve === valve));
    renderReverse();
}

document.querySelectorAll('#valvePills button').forEach((btn) => {
    btn.addEventListener('click', () => selectTestValve(btn.dataset.valve));
});

function renderReverse() {
    const raw = sanitizeDecimal($('desiredOpening'));
    const d = parseFloat(raw);

    if (raw === '' || isNaN(d)) {
        $('resultMV').textContent = '–';
        $('resultInfo').textContent = '';
        $('applyBtn').disabled = true;
        state.applyMV = null;
        return;
    }
    if (d < 0 || d > 100) {
        $('resultMV').textContent = 'N/A';
        $('resultInfo').textContent = 'ป้อนค่าระหว่าง 0–100 เท่านั้น';
        $('applyBtn').disabled = true;
        state.applyMV = null;
        return;
    }

    const r = reverse(state.type, state.testValve, d);
    if (r.mvMax !== undefined) {
        $('resultMV').textContent = `${r.mv.toFixed(1)} – ${r.mvMax.toFixed(1)} %`;
    } else {
        $('resultMV').textContent = `${r.mv.toFixed(1)} %`;
    }
    $('resultInfo').textContent = r.info || '';
    $('applyBtn').disabled = false;
    state.applyMV = r.mv;
}

$('desiredOpening').addEventListener('input', renderReverse);
$('desiredOpening').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') $('desiredOpening').blur();
});

$('applyBtn').addEventListener('click', () => {
    if (state.applyMV === null) return;
    setMV(state.applyMV);
    vibrate(12);
    closeSheets();
});

// ---------- PWA service worker ----------
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    });
}

// ---------- Init ----------
applyTheme(state.theme);
selectType('type1');
selectTestValve('A');
setMV(50);
