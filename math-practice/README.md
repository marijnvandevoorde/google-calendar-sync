# Math Adventure 🧮🚀

A colorful, kid-friendly web app for practicing arithmetic, designed for
children aged **6–9**.

![screen](https://img.shields.io/badge/ages-6--9-ff6bcb) ![no build](https://img.shields.io/badge/build-none-2ecc71)

## How to play

Open **`index.html`** in any browser — no server, no build step, nothing to
install.

- An equation appears at the top (it starts simple, like `3 + 4`).
- Tap the big **numpad** at the bottom to enter the answer.
- Tap **✓** to check (or press `Enter` on a keyboard).
- **Wrong?** The mascot gives a gentle shake and you can try again — no penalty.
- **Right?** Confetti bursts 🎉, you earn a ⭐, and — the fun part — **the
  answer flies up to become the first number of the next exercise.**
  So `3 + 4 = 7` is followed by `7 − 2 = …`, chaining forever.

## Settings ⚙️

Tap the gear in the top-right:

| Setting | Default | Notes |
| --- | --- | --- |
| **How high do we go?** | `20` | Slider from 5 to 100. No answer ever goes above this. |
| **Which math?** | ➕ ➖ | Toggle any of Plus, Minus, Times, Divide. Pick one or more. |

Settings are remembered between visits (saved in the browser).

## Design choices for young kids

- **Big, bright, tappable** buttons with chunky "pressable" shadows.
- **Friendly mascot** that cheers when you're right and reacts (never scolds)
  when you're not — the mascot changes each round for variety.
- **Playful rounded font** and a rainbow palette.
- **Star + streak** rewards for gentle motivation.
- **Physical keyboard** works too (digits, `Enter`, `Backspace`) for desktop.

## Guaranteed-valid maths

The exercise generator only ever produces problems whose answer is a **whole
number within `[0, max]`**:

- **Plus:** `a + b ≤ max`
- **Minus:** `a − b ≥ 0` (never negative)
- **Times:** `a × b ≤ max` (with `a, b ≥ 2`)
- **Divide:** only when `b` divides `a` evenly → a whole answer

Because the answer chains into the next problem, the generator picks a valid
move for the current number; if a number ever has no valid move (e.g. stuck at
the max with only Plus enabled), it restarts the chain from a fresh small
number.

## Files

- `index.html` — markup
- `styles.css` — kid-friendly styling & animations
- `app.js` — game logic (generation, chaining, numpad, confetti)
