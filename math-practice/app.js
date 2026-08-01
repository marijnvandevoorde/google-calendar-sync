"use strict";
/* ===== Math Adventure — game logic (ages 6-9), TypeScript =====
 * Chained arithmetic practice: the answer to each exercise becomes the
 * first number of the next one. Results always stay within [0, max].
 */
(() => {
    "use strict";
    // ---------- Config (persisted) ----------
    const DEFAULTS = { max: 20, ops: ["+", "-"] };
    let config = loadConfig();
    function isOp(o) {
        return o === "+" || o === "-" || o === "*" || o === "/";
    }
    function clampMax(m) {
        let n = parseInt(String(m), 10);
        if (isNaN(n))
            n = DEFAULTS.max;
        return Math.max(5, Math.min(100, n));
    }
    function loadConfig() {
        try {
            const raw = localStorage.getItem("mathAdventureConfig");
            if (raw) {
                const c = JSON.parse(raw);
                const ops = Array.isArray(c.ops) ? c.ops.filter(isOp) : DEFAULTS.ops;
                return {
                    max: clampMax(c.max),
                    ops: ops.length ? ops : DEFAULTS.ops.slice(),
                };
            }
        }
        catch (e) {
            /* ignore corrupt storage */
        }
        return { max: DEFAULTS.max, ops: DEFAULTS.ops.slice() };
    }
    function saveConfig() {
        try {
            localStorage.setItem("mathAdventureConfig", JSON.stringify(config));
        }
        catch (e) {
            /* storage may be unavailable */
        }
    }
    // ---------- State ----------
    let current;
    let typed = "";
    let locked = false;
    let score = 0;
    let streak = 0;
    const mascots = ["🦄", "🐢", "🐰", "🦊", "🐼", "🐸", "🐥", "🐙", "🦖", "🐳"];
    const opSymbol = { "+": "+", "-": "−", "*": "×", "/": "÷" };
    // ---------- DOM ----------
    function byId(id) {
        const node = document.getElementById(id);
        if (!node)
            throw new Error("Missing element #" + id);
        return node;
    }
    const el = {
        opA: byId("opA"),
        operator: byId("operator"),
        opB: byId("opB"),
        answerBox: byId("answerBox"),
        equation: byId("equation"),
        feedback: byId("feedback"),
        mascot: byId("mascot"),
        scoreValue: byId("scoreValue"),
        streakValue: byId("streakValue"),
        streakBox: byId("streakBox"),
        numpad: byId("numpad"),
        settingsBtn: byId("settingsBtn"),
        settingsModal: byId("settingsModal"),
        closeSettings: byId("closeSettings"),
        maxRange: byId("maxRange"),
        maxValue: byId("maxValue"),
        opToggles: byId("opToggles"),
        opHint: byId("opHint"),
    };
    // ---------- Exercise generation ----------
    // Returns array of valid moves given a starting value `a`.
    function validMoves(a, max, ops) {
        const moves = [];
        ops.forEach((op) => {
            if (op === "+") {
                for (let b = 1; a + b <= max; b++)
                    moves.push({ op, b, answer: a + b });
            }
            else if (op === "-") {
                for (let b = 1; b <= a; b++)
                    moves.push({ op, b, answer: a - b });
            }
            else if (op === "*") {
                // Keep it meaningful: a,b >= 2, result within max. (×0 / ×1 are trivial,
                // and a=0 would loop forever since 0*b is always <= max.)
                if (a >= 2) {
                    for (let b = 2; a * b <= max; b++)
                        moves.push({ op, b, answer: a * b });
                }
            }
            else {
                // division: b divides a evenly, b >= 2  →  whole answer < a
                for (let b = 2; b <= a; b++) {
                    if (a % b === 0)
                        moves.push({ op, b, answer: a / b });
                }
            }
        });
        return moves;
    }
    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }
    // Build the next exercise starting from `startValue`. If no chained move is
    // possible (e.g. stuck at max with only +), begin a fresh small number.
    function makeExercise(startValue) {
        const max = config.max;
        const ops = config.ops.length ? config.ops : DEFAULTS.ops;
        let a = startValue;
        let moves = validMoves(a, max, ops);
        if (!moves.length) {
            a = freshStart(max, ops);
            moves = validMoves(a, max, ops);
        }
        const m = pick(moves);
        return { a, op: m.op, b: m.b, answer: m.answer };
    }
    // Pick a small starting number that has at least one valid move.
    function freshStart(max, ops) {
        const cap = Math.min(9, max);
        const candidates = [];
        for (let v = 0; v <= cap; v++) {
            if (validMoves(v, max, ops).length)
                candidates.push(v);
        }
        if (!candidates.length) {
            for (let v = 0; v <= max; v++) {
                if (validMoves(v, max, ops).length)
                    candidates.push(v);
            }
        }
        return candidates.length ? pick(candidates) : 1;
    }
    // ---------- Render ----------
    function render() {
        el.opA.textContent = String(current.a);
        el.operator.textContent = opSymbol[current.op];
        el.opB.textContent = String(current.b);
        updateAnswerBox();
    }
    function updateAnswerBox() {
        if (typed === "") {
            el.answerBox.textContent = "?";
            el.answerBox.className = "answer-box";
        }
        else {
            el.answerBox.textContent = typed;
            el.answerBox.className = "answer-box filled";
        }
    }
    // ---------- Input ----------
    function onKey(key) {
        if (locked)
            return;
        if (key === "clear") {
            typed = typed.slice(0, -1);
            updateAnswerBox();
            clearFeedback();
        }
        else if (key === "check") {
            check();
        }
        else {
            if (typed.length >= 3)
                return;
            if (typed === "" && key === "0")
                return; // no leading zero
            typed += key;
            updateAnswerBox();
            clearFeedback();
        }
    }
    function clearFeedback() {
        el.feedback.textContent = "";
        el.feedback.className = "feedback";
    }
    function check() {
        if (typed === "")
            return;
        const val = parseInt(typed, 10);
        if (val === current.answer)
            onCorrect();
        else
            onWrong();
    }
    const CHEERS = ["Awesome! 🎉", "Perfect! ⭐", "You rock! 🤩", "Yes! 🚀", "Super! 🌈", "Brilliant! 💎", "Woohoo! 🎊"];
    const TRIES = ["Try again! 💪", "Almost! 🙂", "Not quite — you got this!", "Keep going! ✨"];
    function onCorrect() {
        locked = true;
        score += 1;
        streak += 1;
        el.scoreValue.textContent = String(score);
        el.streakValue.textContent = String(streak);
        el.streakBox.classList.toggle("dim", streak === 0);
        el.answerBox.className = "answer-box filled correct";
        el.feedback.textContent = pick(CHEERS);
        el.feedback.className = "feedback good";
        el.mascot.className = "mascot happy";
        burstConfetti();
        const answerValue = current.answer;
        flyAnswerToOperand(() => {
            el.mascot.textContent = pick(mascots);
            el.mascot.className = "mascot";
            current = makeExercise(answerValue);
            typed = "";
            render();
            locked = false;
        });
    }
    function onWrong() {
        streak = 0;
        el.streakValue.textContent = String(streak);
        el.streakBox.classList.add("dim");
        el.answerBox.className = "answer-box filled wrong";
        el.feedback.textContent = pick(TRIES);
        el.feedback.className = "feedback bad";
        el.mascot.className = "mascot sad";
        window.setTimeout(() => {
            el.mascot.className = "mascot";
            typed = "";
            updateAnswerBox();
        }, 700);
    }
    // ---------- Fly animation ----------
    function flyAnswerToOperand(done) {
        const from = el.answerBox.getBoundingClientRect();
        const to = el.opA.getBoundingClientRect();
        const ghost = document.createElement("div");
        ghost.className = "fly-answer";
        ghost.textContent = String(current.answer);
        ghost.style.left = from.left + "px";
        ghost.style.top = from.top + "px";
        ghost.style.fontSize = window.getComputedStyle(el.answerBox).fontSize;
        document.body.appendChild(ghost);
        requestAnimationFrame(() => {
            const dx = to.left + to.width / 2 - (from.left + from.width / 2);
            const dy = to.top + to.height / 2 - (from.top + from.height / 2);
            ghost.style.transform = "translate(" + dx + "px," + dy + "px) scale(1.15)";
            ghost.style.opacity = "0.2";
        });
        window.setTimeout(() => {
            if (ghost.parentNode)
                ghost.parentNode.removeChild(ghost);
            done();
        }, 560);
    }
    const canvas = byId("confetti");
    const ctx = canvas.getContext("2d");
    const pieces = [];
    let rafId = null;
    const confColors = ["#ff6bcb", "#ffd23f", "#2ecc71", "#4d9dff", "#ff9f43", "#9b5de5"];
    function sizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    sizeCanvas();
    window.addEventListener("resize", sizeCanvas);
    function burstConfetti() {
        const cx = window.innerWidth / 2;
        for (let i = 0; i < 90; i++) {
            pieces.push({
                x: cx + (Math.random() - 0.5) * 120,
                y: window.innerHeight * 0.35,
                vx: (Math.random() - 0.5) * 9,
                vy: Math.random() * -9 - 3,
                size: Math.random() * 9 + 5,
                color: confColors[Math.floor(Math.random() * confColors.length)],
                rot: Math.random() * Math.PI,
                vr: (Math.random() - 0.5) * 0.35,
                life: 90 + Math.random() * 40,
            });
        }
        if (rafId === null)
            rafId = requestAnimationFrame(drawConfetti);
    }
    function drawConfetti() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = pieces.length - 1; i >= 0; i--) {
            const p = pieces[i];
            p.vy += 0.32; // gravity
            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.vr;
            p.life--;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
            ctx.restore();
            if (p.life <= 0 || p.y > canvas.height + 30)
                pieces.splice(i, 1);
        }
        if (pieces.length) {
            rafId = requestAnimationFrame(drawConfetti);
        }
        else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            rafId = null;
        }
    }
    // ---------- Settings ----------
    function openSettings() {
        el.maxRange.value = String(config.max);
        el.maxValue.textContent = String(config.max);
        el.opToggles.querySelectorAll(".op-toggle").forEach((btn) => {
            const op = btn.dataset.op;
            btn.classList.toggle("on", config.ops.indexOf(op) !== -1);
        });
        el.opHint.textContent = "";
        el.settingsModal.hidden = false;
    }
    function closeSettings() {
        const chosen = [];
        el.opToggles.querySelectorAll(".op-toggle.on").forEach((btn) => {
            const op = btn.dataset.op;
            if (isOp(op))
                chosen.push(op);
        });
        if (!chosen.length) {
            el.opHint.textContent = "Pick at least one kind of math! 🙂";
            return;
        }
        config.ops = chosen;
        config.max = clampMax(el.maxRange.value);
        saveConfig();
        el.settingsModal.hidden = true;
        current = makeExercise(freshStart(config.max, config.ops));
        typed = "";
        clearFeedback();
        render();
    }
    // ---------- Events ----------
    el.numpad.addEventListener("click", (e) => {
        const btn = e.target.closest(".key");
        if (btn && btn.dataset.key)
            onKey(btn.dataset.key);
    });
    window.addEventListener("keydown", (e) => {
        if (!el.settingsModal.hidden)
            return;
        if (e.key >= "0" && e.key <= "9")
            onKey(e.key);
        else if (e.key === "Enter" || e.key === "=")
            onKey("check");
        else if (e.key === "Backspace") {
            e.preventDefault();
            onKey("clear");
        }
    });
    el.settingsBtn.addEventListener("click", openSettings);
    el.closeSettings.addEventListener("click", closeSettings);
    el.maxRange.addEventListener("input", () => {
        el.maxValue.textContent = el.maxRange.value;
    });
    el.opToggles.addEventListener("click", (e) => {
        const btn = e.target.closest(".op-toggle");
        if (!btn)
            return;
        btn.classList.toggle("on");
        el.opHint.textContent = "";
    });
    // ---------- Service worker (offline / PWA) ----------
    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("sw.js").catch(() => {
                /* offline support is a progressive enhancement */
            });
        });
    }
    // ---------- Boot ----------
    el.streakBox.classList.add("dim");
    current = makeExercise(freshStart(config.max, config.ops));
    render();
})();
