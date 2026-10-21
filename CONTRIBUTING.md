# Contributing to ThermoLab

Thanks for taking the time to contribute.

## Getting set up

```bash
git clone https://github.com/dukemawex/ThermoLab.git
cd ThermoLab
npm install
npm run dev
```

The dev server runs on <http://127.0.0.1:5173>.

## Before you open a pull request

```bash
npm run check
```

That runs, in order:

| Step | Command |
| --- | --- |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Unit + component tests | `npm test` |
| Production build | `npm run build` |

All four must pass. CI runs exactly the same commands, so a green local run
means a green pipeline.

## Project layout

```
src/lib/heatExchanger.ts   the calculation engine — pure functions, no React
src/components/            presentation components
src/lib/csv.ts             CSV export
src/lib/storage.ts         localStorage persistence
scripts/smoke.mjs          headless-browser checks against the dev server
```

The calculation engine is deliberately free of React and of side effects so it
can be tested directly. If you change the maths, change it there and add
tests to `src/lib/heatExchanger.test.ts`.

## Changing the model

The model has explicit assumptions, listed in the README and in the app's
"Model assumptions" panel:

* steady state
* constant physical properties
* negligible heat loss
* no phase change (sensible heat only)
* the required area is sized from the hot-stream duty `Q_hot`

If a change invalidates one of these, update the README, the assumptions
panel in `src/App.tsx`, and the CSV export in a single change so they cannot
drift apart.

Two rules that are easy to break by accident:

* **The LMTD must never divide by zero.** Use the limiting value
  `(dT1 + dT2) / 2` when the terminal differences are equal or nearly equal.
* **Inconsistent duties must never be averaged.** Report `Q_hot` and `Q_cold`
  separately with the mismatch percentage, and size the area from `Q_hot`.

## Testing guidance

* Calculation changes belong in `src/lib/heatExchanger.test.ts`.
* User-visible behaviour belongs in `src/App.test.tsx`.
* Anything that touches layout or rendering end-to-end can be checked with
  `npm run smoke` (requires the dev server to be running).

Please include the numeric case in the PR description when the change affects
the calculation, so reviewers can verify the result independently.
