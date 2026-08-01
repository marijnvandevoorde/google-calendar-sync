/* ===== Math Adventure — game logic (ages 6–9) =====
 * Chained arithmetic practice: the answer to each exercise becomes the
 * first number of the next one. Results always stay within [0, max].
 */

(function () {
  "use strict";

  // ---------- Config (persisted) ----------
  var DEFAULTS = { max: 20, ops: ["+", "-"] };
  var config = loadConfig();

  function loadConfig() {
    try {
      var raw = localStorage.getItem("mathAdventureConfig");
      if (raw) {
        var c = JSON.parse(raw);
        var ops = Array.isArray(c.ops) ? c.ops.filter(isOp) : DEFAULTS.ops;
        return {
          max: clampMax(c.max),
          ops: ops.length ? ops : DEFAULTS.ops.slice(),
        };
      }
    } catch (e) {}
    return { max: DEFAULTS.max, ops: DEFAULTS.ops.slice() };
  }
  function saveConfig() {
    try { localStorage.setItem("mathAdventureConfig", JSON.stringify(config)); } catch (e) {}
  }
  function isOp(o) { return o === "+" || o === "-" || o === "*" || o === "/"; }
  function clampMax(m) {
    m = parseInt(m, 10);
    if (isNaN(m)) m = DEFAULTS.max;
    return Math.max(5, Math.min(100, m));
  }

  // ---------- State ----------
  var current = null;   // { a, op, b, answer }
  var typed = "";       // current numpad entry
  var locked = false;   // block input during animation
  var score = 0;
  var streak = 0;

  var mascots = ["🦄", "🐢", "🐰", "🦊", "🐼", "🐸", "🐥", "🐙", "🦖", "🐳"];
  var opSymbol = { "+": "+", "-": "−", "*": "×", "/": "÷" };

  // ---------- DOM ----------
  var el = {
    opA: document.getElementById("opA"),
    operator: document.getElementById("operator"),
    opB: document.getElementById("opB"),
    answerBox: document.getElementById("answerBox"),
    equation: document.getElementById("equation"),
    feedback: document.getElementById("feedback"),
    mascot: document.getElementById("mascot"),
    scoreValue: document.getElementById("scoreValue"),
    streakValue: document.getElementById("streakValue"),
    streakBox: document.getElementById("streakBox"),
    numpad: document.getElementById("numpad"),
    settingsBtn: document.getElementById("settingsBtn"),
    settingsModal: document.getElementById("settingsModal"),
    closeSettings: document.getElementById("closeSettings"),
    maxRange: document.getElementById("maxRange"),
    maxValue: document.getElementById("maxValue"),
    opToggles: document.getElementById("opToggles"),
    opHint: document.getElementById("opHint"),
  };

  // ---------- Exercise generation ----------
  // Returns array of valid { op, b, answer } given a starting value `a`.
  function validMoves(a, max, ops) {
    var moves = [];
    ops.forEach(function (op) {
      if (op === "+") {
        for (var b = 1; a + b <= max; b++) moves.push({ op: op, b: b, answer: a + b });
      } else if (op === "-") {
        for (var b = 1; b <= a; b++) moves.push({ op: op, b: b, answer: a - b });
      } else if (op === "*") {
        // Keep it meaningful: a,b >= 2, result within max. (×0 / ×1 are trivial,
        // and a=0 would loop forever since 0*b is always <= max.)
        if (a >= 2) {
          for (var b = 2; a * b <= max; b++) moves.push({ op: op, b: b, answer: a * b });
        }
      } else if (op === "/") {
        // b divides a, b >= 2, quotient >= 1  →  answer stays whole and < a.
        for (var b = 2; b <= a; b++) {
          if (a % b === 0) moves.push({ op: op, b: b, answer: a / b });
        }
      }
    });
    return moves;
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // Build the next exercise starting from `startValue`. If no chained move is
  // possible (e.g. we're stuck at max with only +), begin a fresh small number.
  function makeExercise(startValue) {
    var max = config.max;
    var ops = config.ops.length ? config.ops : DEFAULTS.ops;

    var a = startValue;
    var moves = validMoves(a, max, ops);

    if (!moves.length) {
      // Restart chain from a friendly small starting operand.
      a = freshStart(max, ops);
      moves = validMoves(a, max, ops);
    }
    var m = pick(moves);
    return { a: a, op: m.op, b: m.b, answer: m.answer };
  }

  // Pick a small starting number that has at least one valid move.
  function freshStart(max, ops) {
    var cap = Math.min(9, max);
    var candidates = [];
    for (var v = 0; v <= cap; v++) {
      if (validMoves(v, max, ops).length) candidates.push(v);
    }
    if (!candidates.length) {
      for (var v2 = 0; v2 <= max; v2++) {
        if (validMoves(v2, max, ops).length) candidates.push(v2);
      }
    }
    return candidates.length ? pick(candidates) : 1;
  }

  // ---------- Render ----------
  function render() {
    el.opA.textContent = current.a;
    el.operator.textContent = opSymbol[current.op];
    el.opB.textContent = current.b;
    updateAnswerBox();
  }

  function updateAnswerBox() {
    if (typed === "") {
      el.answerBox.textContent = "?";
      el.answerBox.className = "answer-box";
    } else {
      el.answerBox.textContent = typed;
      el.answerBox.className = "answer-box filled";
    }
  }

  // ---------- Input ----------
  function onKey(key) {
    if (locked) return;
    if (key === "clear") {
      typed = typed.slice(0, -1);
      updateAnswerBox();
      clearFeedback();
    } else if (key === "check") {
      check();
    } else {
      // digit
      if (typed.length >= 3) return;
      if (typed === "" && key === "0") return; // no leading zero
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
    if (typed === "") return;
    var val = parseInt(typed, 10);
    if (val === current.answer) {
      onCorrect();
    } else {
      onWrong();
    }
  }

  var CHEERS = ["Awesome! 🎉", "Perfect! ⭐", "You rock! 🤩", "Yes! 🚀", "Super! 🌈", "Brilliant! 💎", "Woohoo! 🎊"];
  var TRIES = ["Try again! 💪", "Almost! 🙂", "Not quite — you got this!", "Keep going! ✨"];

  function onCorrect() {
    locked = true;
    score += 1;
    streak += 1;
    el.scoreValue.textContent = score;
    el.streakValue.textContent = streak;
    el.streakBox.classList.toggle("dim", streak === 0);

    el.answerBox.className = "answer-box filled correct";
    el.feedback.textContent = pick(CHEERS);
    el.feedback.className = "feedback good";
    el.mascot.className = "mascot happy";
    burstConfetti();

    var answerValue = current.answer;

    // Fly the answer up to become the next first operand, then load next.
    flyAnswerToOperand(function () {
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
    el.streakValue.textContent = streak;
    el.streakBox.classList.add("dim");
    el.answerBox.className = "answer-box filled wrong";
    el.feedback.textContent = pick(TRIES);
    el.feedback.className = "feedback bad";
    el.mascot.className = "mascot sad";
    // Let the child fix their answer: clear entry after a short beat.
    setTimeout(function () {
      el.mascot.className = "mascot";
      typed = "";
      updateAnswerBox();
    }, 700);
  }

  // ---------- Fly animation ----------
  function flyAnswerToOperand(done) {
    var from = el.answerBox.getBoundingClientRect();
    var to = el.opA.getBoundingClientRect();

    var ghost = document.createElement("div");
    ghost.className = "fly-answer";
    ghost.textContent = current.answer;
    ghost.style.left = from.left + "px";
    ghost.style.top = from.top + "px";
    ghost.style.fontSize = window.getComputedStyle(el.answerBox).fontSize;
    document.body.appendChild(ghost);

    // Force layout then animate toward opA.
    requestAnimationFrame(function () {
      var dx = (to.left + to.width / 2) - (from.left + from.width / 2);
      var dy = (to.top + to.height / 2) - (from.top + from.height / 2);
      ghost.style.transform = "translate(" + dx + "px," + dy + "px) scale(1.15)";
      ghost.style.opacity = "0.2";
    });

    setTimeout(function () {
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
      done();
    }, 560);
  }

  // ---------- Confetti ----------
  var canvas = document.getElementById("confetti");
  var ctx = canvas.getContext("2d");
  var pieces = [];
  var rafId = null;
  var confColors = ["#ff6bcb", "#ffd23f", "#2ecc71", "#4d9dff", "#ff9f43", "#9b5de5"];

  function sizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  sizeCanvas();
  window.addEventListener("resize", sizeCanvas);

  function burstConfetti() {
    var cx = window.innerWidth / 2;
    for (var i = 0; i < 90; i++) {
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
    if (!rafId) rafId = requestAnimationFrame(drawConfetti);
  }

  function drawConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = pieces.length - 1; i >= 0; i--) {
      var p = pieces[i];
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
      if (p.life <= 0 || p.y > canvas.height + 30) pieces.splice(i, 1);
    }
    if (pieces.length) {
      rafId = requestAnimationFrame(drawConfetti);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      rafId = null;
    }
  }

  // ---------- Settings ----------
  function openSettings() {
    el.maxRange.value = config.max;
    el.maxValue.textContent = config.max;
    Array.prototype.forEach.call(el.opToggles.querySelectorAll(".op-toggle"), function (btn) {
      btn.classList.toggle("on", config.ops.indexOf(btn.dataset.op) !== -1);
    });
    el.opHint.textContent = "";
    el.settingsModal.hidden = false;
  }

  function closeSettings() {
    // Ensure at least one operation is selected.
    var chosen = [];
    Array.prototype.forEach.call(el.opToggles.querySelectorAll(".op-toggle.on"), function (btn) {
      chosen.push(btn.dataset.op);
    });
    if (!chosen.length) {
      el.opHint.textContent = "Pick at least one kind of math! 🙂";
      return;
    }
    config.ops = chosen;
    config.max = clampMax(el.maxRange.value);
    saveConfig();
    el.settingsModal.hidden = true;

    // Restart with a fresh, valid exercise under the new settings.
    current = makeExercise(freshStart(config.max, config.ops));
    typed = "";
    clearFeedback();
    render();
  }

  // ---------- Wire up events ----------
  el.numpad.addEventListener("click", function (e) {
    var btn = e.target.closest(".key");
    if (btn) onKey(btn.dataset.key);
  });

  // Physical keyboard support (nice for older kids / desktop).
  window.addEventListener("keydown", function (e) {
    if (!el.settingsModal.hidden) return;
    if (e.key >= "0" && e.key <= "9") onKey(e.key);
    else if (e.key === "Enter" || e.key === "=") onKey("check");
    else if (e.key === "Backspace") { e.preventDefault(); onKey("clear"); }
  });

  el.settingsBtn.addEventListener("click", openSettings);
  el.closeSettings.addEventListener("click", closeSettings);

  el.maxRange.addEventListener("input", function () {
    el.maxValue.textContent = el.maxRange.value;
  });

  el.opToggles.addEventListener("click", function (e) {
    var btn = e.target.closest(".op-toggle");
    if (!btn) return;
    btn.classList.toggle("on");
    el.opHint.textContent = "";
  });

  // ---------- Boot ----------
  el.streakBox.classList.add("dim");
  // First exercise: start simple (small first operand). 3+4 style opener.
  current = makeExercise(freshStart(config.max, config.ops));
  render();
})();
