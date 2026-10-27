# Rules: Always Apply Installed Skills

This repository is governed by two core developer principles installed in `.agents/skills/`:
1. **Ponytail** (`.agents/skills/ponytail/`): Lazy senior dev mode — the smallest change that fully solves the task, zero bloat, YAGNI, and direct communication.
2. **Antislop** (`.agents/skills/antislop/`): Anti-AI-slop filter — eliminate redundant comments, unnatural AI prose, generic styling, and unnecessary abstractions.

---

## Mandatory Execution Rules

### 1. Ponytail Principles (Code & Architecture)
* **Smallest Complete Change**: Solve the exact problem with the least new code. Never add speculative flexibility, unused wrappers, or premature abstractions.
* **Reuse Over Reinvent**: Always check existing game patterns in `src/game/` before adding new helpers. Use standard language/runtime features instead of adding new dependencies.
* **Test Discipline**: Non-trivial logic additions (such as Mahjong claim validation, win scoring, or turn timers) must be paired with unit tests in `tests/rules.test.mjs` and verified with `npm test`.
* **Debt Tracking**: If a shortcut or simplification is made for prototyping, annotate it explicitly: `shortcut: <the limit>, <when to upgrade>`.
* **What Never to Cut**: Security, authoritative server validation, error handling that prevents crashes/disconnects, and accurate game rules.

### 2. Antislop Principles (Code & Communication)
* **Code Comment Hygiene** (`antislop-code`): Never write obvious comments explaining *what* standard code does (e.g. `// increment turn`, `// return socket response`). Only comment the non-obvious *why* or business rules that cannot be understood from the code itself.
* **Tone & Output** (`antislop-copywriting`): Keep messages concise, natural, and directly actionable. Avoid corporate fluff, robotic enthusiasm, and generic AI preamble.
* **UI & Accessibility** (`antislop-ui`, `antislop-human`, `antislop-layoutmobile`): When touching frontend/UI code, maintain high contrast, clean typography, responsive mobile layouts, and designer-crafted aesthetics.

---

## Trigger Checklist for Every Task
- [ ] Is this the minimal working solution (Ponytail)?
- [ ] Are all redundant AI comments removed (Antislop)?
- [ ] Did you run `npm run build && npm test` before finishing?
