# ThermoLab

A heat-exchanger sizing calculator for **parallel-flow** and **counterflow** heat
exchangers. React + TypeScript + Vite + Recharts. Every calculation runs
locally in the browser — no API keys, no accounts, no database, no server-side
computation, no paid services.

---

## Quick start

```bash
cd /root/projects/thermolab
npm install          # if node_modules is not present
npm run dev          # http://127.0.0.1:5173/
```

The dev server is bound to `127.0.0.1:5173` (localhost only — it is not exposed
to the network).

| Command            | What it does                                              |
| ------------------ | --------------------------------------------------------- |
| `npm run dev`      | Vite dev server on `127.0.0.1:5173`                        |
| `npm run build`    | Typecheck (`tsc -b`) then production build into `dist/`    |
| `npm run preview`  | Serve the production build on `127.0.0.1:4173`             |
| `npm test`         | Run the full test suite once (Vitest)                      |
| `npm run test:watch` | Vitest in watch mode                                     |
| `npm run test:coverage` | Vitest with a V8 coverage report                      |
| `npm run lint`     | ESLint (flat config), zero warnings allowed                |
| `npm run typecheck` | TypeScript project build, no emit                        |
| `npm run check`    | lint → typecheck → test → build (what CI runs)             |
| `npm run smoke`    | Headless-browser smoke test against the running dev server |
| `npm run verify:dist` | Headless-browser checks against the production build    |

`scripts/start-dev.sh` starts the dev server fully detached from the calling
shell, which is handy over SSH or in a container where the process would
otherwise be killed when the parent shell exits.

> **Note on `npm install` in this environment:** the default npm cache at
> `/root/.npm/_cacache` fails with `ENOENT … rename` on this Android/PRoot
> filesystem. If you hit that, install with a cache on a different mount:
> `npm install --cache /tmp/opencode/npm-cache --maxsockets 1`.

---

## The model

### Governing equations

**Hot-side heat duty**

```
Q_hot = m_hot · cp_hot · (Th,in − Th,out)            [W]
```

**Cold-side heat duty** (only when cold-side data is supplied)

```
Q_cold = m_cold · cp_cold · (Tc,out − Tc,in)          [W]
```

**Terminal temperature differences**

```
counterflow:   dT1 = Th,in − Tc,out      dT2 = Th,out − Tc,in
parallelflow:  dT1 = Th,in − Tc,in       dT2 = Th,out − Tc,out
```

**Log-mean temperature difference**

```
LMTD = (dT1 − dT2) / ln(dT1 / dT2)
```

When `dT1` and `dT2` are equal or nearly equal, the direct ratio form becomes
0/0 and loses precision. The implementation switches to the stable continuous
limiting value

```
lim(dT1→dT2) (dT1 − dT2) / ln(dT1/dT2) = (dT1 + dT2) / 2
```

whenever the relative gap `|dT1 − dT2| / max(|dT1|, |dT2|)` is `≤ 1e-9`. No
division by zero is ever performed, and the result is flagged in the UI
("Equal terminal differences — limiting value used").

**Required heat-transfer area**

```
A = Q_hot / (U · F · LMTD)                             [m²]
```

The area is **always** sized from the hot-stream duty `Q_hot`. The cold-side
duty is reported for comparison only and is **never** averaged into the sizing
basis.

### Energy balance reporting

When cold-side data is supplied, both duties are reported side by side together
with their percentage mismatch:

```
mismatch % = |Q_hot − Q_cold| / max(|Q_hot|, |Q_cold|) × 100
```

Using `max(|Q_hot|, |Q_cold|)` as the denominator keeps the mismatch in the
0–100 % range. A mismatch above **5 %** is flagged as a warning; the two
inconsistent duties are never silently reconciled or averaged.

### Assumptions

* Steady state
* Constant physical properties (no variation with temperature or phase)
* Negligible heat loss to the surroundings
* No phase change — sensible heat only
* The required area is sized from the hot-stream duty `Q_hot`

### About the correction factor F

`F` is **user-supplied** and must satisfy `0 < F ≤ 1`. ThermoLab deliberately
does **not** derive a shell-and-tube LMTD correction factor (the R, P, Z
method) because the geometry and arrangement data required to do so — shell
and tube counts, passes, baffle spacing, and so on — are not part of this
model. Inventing one would produce a number with no physical basis.

---

## Validation rules

Inputs are validated on every keystroke. While any rule is violated, **all
results and charts are suppressed** and the offending field is marked in red
with an inline message.

| Rule | Message shown |
| --- | --- |
| Every required numeric input must be finite | *“… must be a finite number.”* |
| `U` must be > 0 | *“U must be greater than 0 W/(m²·K).”* |
| Hot mass flow must be > 0 | *“Hot stream mass flow rate must be greater than 0 kg/s.”* |
| Hot specific heat must be > 0 | *“Hot stream specific heat must be greater than 0 J/(kg·K).”* |
| Cold mass flow must be > 0 (when supplied) | *“Cold stream mass flow rate must be greater than 0 kg/s.”* |
| Cold specific heat must be > 0 (when supplied) | *“Cold stream specific heat must be greater than 0 J/(kg·K).”* |
| The hot stream must cool (`Th,in ≥ Th,out`) | *“The hot stream must cool: …”* |
| The cold stream must heat (`Tc,out ≥ Tc,in`) | *“The cold stream must heat: …”* |
| `0 < F ≤ 1` | *“Correction factor F must satisfy 0 < F ≤ 1.”* |
| Both terminal differences must be > 0 | *“Terminal difference dT1/dT2 = … K must be greater than 0 …”* |

Notes:

* A **valid counterflow** case whose cold outlet exceeds the hot outlet is
  **accepted** — that is the classic counterflow advantage, not an error.
* A **parallel-flow temperature crossing** (`Tc,out ≥ Th,out`) is correctly
  **rejected**, because `dT2` would be zero or negative.
* Equality at the cooling/heating boundary (`Th,in = Th,out`) is accepted so the
  degenerate **zero-duty** case is reachable and reported explicitly rather
  than being hidden behind a validation error.

---

## Features

* **Instant recalculation** on every input change.
* **Worked calculation panel** with the current numbers substituted into every
  step, including the LMTD limiting-value branch when it applies.
* **Load example** and **Reset** buttons.
* **localStorage persistence** — inputs are saved automatically and restored on
  reload (key `thermolab.inputs.v1`).
* **CSV export** of the inputs, results, and assumptions.
* **Print-friendly** output — a dedicated print stylesheet hides the chrome and
  reflows the layout onto A4.
* **Responsive, mobile-first layout** with large touch-friendly inputs
  (50 px tall, 17 px text) and no horizontal overflow at 390 px or 1440 px.

### Charts

1. **Hot/cold endpoint temperature diagram.** The horizontal axis is labelled
   *“Position along hot-flow direction”*. The cold endpoints are **reversed for
   counter flow** because the cold stream travels in the opposite direction.
   The connecting straight lines are explicitly marked as **schematic** — they
   join the known endpoint temperatures and are *not* a calculated internal
   temperature profile.
2. **Required area vs U**, with an adjustable U sweep range (slider) and the
   current operating point highlighted.
3. **Required area vs F**, restricted to `0 < F ≤ 1`, with the current operating
   point highlighted.

All three charts include tooltips, units, legends, and the current operating
point. Hot is orange (`#E8590C`), cold is blue (`#1B6EC2`), text is navy
(`#0B2545`) on a light background (`#F4F7FB`).

---

## Default example

Counterflow: `Th,in = 150`, `Th,out = 90`, `Tc,in = 20`, `Tc,out = 60` °C,
`U = 500` W/(m²·K), `m_hot = 1` kg/s, `cp_hot = 4180` J/(kg·K), `F = 1`.

| Quantity | Value |
| --- | --- |
| `Q_hot` | 250 800 W |
| `dT1`, `dT2` | 90 K, 70 K |
| `LMTD` | 79.58158 K |
| Required area | 6.30297 m² |

> **Note on the LMTD figure.** The original brief quoted `LMTD ≈ 79.5829 K`.
> That figure is a typo: the exact value of `(90 − 70) / ln(90/70)` is
> **79.58158 K**. The brief's own area figure of `6.3029 m²` is only
> reproducible with `79.58158 K` (`250800 / (500 × 79.58158) = 6.30297`), so
> the area figure in the brief and the LMTD figure in the brief are mutually
> inconsistent. The app uses the exact formula, which satisfies the area
> figure.

---

## Project layout

```
thermolab/
├── index.html
├── opencode.json            # copied from ../minimax-test
├── package.json
├── tsconfig.json
├── vite.config.ts           # dev/build/test config
├── vitest.config.ts         # (removed - test config now lives in vite.config.ts)
├── eslint.config.js
├── LICENSE
├── CONTRIBUTING.md
├── .github/
│   ├── workflows/
│   │   ├── ci.yml           # lint + typecheck + test + build
│   │   └── deploy.yml       # GitHub Pages deployment
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml
│   │   └── feature_request.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── scripts/
│   ├── start-dev.sh         # detached dev-server launcher
│   ├── smoke.mjs            # headless browser smoke test
│   └── verify-dist.mjs      # headless browser checks on the production build
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── App.test.tsx
    ├── styles.css
    ├── components/
    │   ├── InputPanel.tsx
    │   ├── NumberField.tsx
    │   ├── ResultsPanel.tsx
    │   ├── WorkedCalculation.tsx
    │   ├── TemperatureDiagram.tsx
    │   ├── AreaVsUChart.tsx
    │   ├── AreaVsFChart.tsx
    │   └── ui.tsx
    ├── lib/
    │   ├── heatExchanger.ts       # the calculation engine (pure functions)
    │   ├── heatExchanger.test.ts
    │   ├── csv.ts / csv.test.ts
    │   ├── storage.ts / storage.test.ts
    │   └── theme.ts
    └── test/
        └── setup.ts
```

---

## Testing

```bash
npm test                     # 65 unit + component tests
npm run smoke                # 16 browser checks (dev server on :5173)
npm run verify:dist          # 12 browser checks (needs `vite preview` on :4173)
npm run build                # typecheck + production build
```

The suite covers the default example, equal terminal differences, nearly equal
differences, invalid inputs of every kind, parallel-flow temperature crossing,
valid counterflow temperature crossing, and the cold-side energy balance.

`scripts/smoke.mjs` drives a real headless browser and checks that the app
mounts, computes the documented default example, renders all three charts with
the required axis label, produces no console errors, and has no horizontal
overflow at mobile or desktop widths. It uses **Firefox** because Chromium's
renderer processes crash on startup inside this Android/PRoot environment.

`scripts/verify-dist.mjs` does the same against the **production build** served
by `vite preview`, and additionally verifies that the CSV download contains the
expected results and that the print stylesheet hides the app chrome while
keeping the results visible.

---

## Limitations

* **Sensible heat only.** No latent heat, condensation, evaporation, or
  two-phase behaviour. The model is not valid across a phase change.
* **Constant properties.** `cp` and `U` are treated as constants; there is no
  temperature-corrected property evaluation.
* **No pressure drop.** There is no friction, pumping-work, or pressure-drop
  calculation, and no constraint tying the chosen U to a geometry.
* **No fouling factor.** `U` is taken as the overall coefficient, already
  including any fouling allowance the user cares about.
* **Straight-line temperature diagram.** The endpoint diagram is schematic. A
  real exchanger has curved internal profiles, and in parallel flow the
  temperature curves approach each other asymptotically.
* **F is user-supplied.** No shell-and-tube correction factor is derived.
* **Single exchanger, single pass.** No multi-pass or multi-exchanger
  arrangements, and no effectiveness-NTU formulation.
* **No LMTD correction for non-counter/parallel arrangements** such as
  cross-flow.
* **Printing** uses the browser's own print dialog; there is no PDF generator
  and no server-side rendering.
* **localStorage** is per-browser and per-origin. It is not synchronised, and
  clearing site data removes the saved inputs. Private-browsing modes that
  block storage degrade gracefully to no-persistence.
