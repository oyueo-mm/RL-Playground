# V3 Very Hard presets (25–30) — integration report

Branch: `feat/v3-very-hard-presets` (from `main` @ `9d5e257f4711dc90d2eee5c59b0c361057ac5156`). **Not merged, not deployed.**

## 1. Setup on the new laptop

Empty VS Code folder → Git 2.55, Node 24.22.1, npm 11.19.1, Python 3.12.9 present. Cloned `oyueo-mm/RL-Playground` into the folder, created the feature branch, extracted `RL_Playground_V3_Official_Patch_NewLaptop.zip` (read from `Downloads`; five identical copies, same SHA-256) into a scratch folder, read `README_NEW_LAPTOP.md` and `apply_v3.py` before running, then `npm ci`.

## 2. Patch application

`python -I apply_v3.py` verified every payload against `v3-source-inventory.json` (SHA-256) and wrote:

- maps / solutions / previews for 25–30, `catalog.json`, English descriptions in `manifest.ts`;
- `validateSolutions.test.ts` (1–18 original hashes, 19–24 V2 hashes, 25–30 V3 hashes), `scripts/v2Source.test.ts` (V2 raw-asset check skips 25–30);
- `scripts/audit30.test.ts` now writes `docs/v3-audit.json` under `UPDATE_V3_AUDIT` (the historic `docs/v2-audit.json` is untouched);
- old audit summaries of 25–30 reset to `incomplete`, then regenerated from the real engine.

No incompatibility with the current repository was found.

## 3. Final maps

| # | Map | Size | Goals | Switches | Toggle walls | Portal pairs | Fragiles | One-ways | Steps |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| 25 | Obsidian Citadel | 24×24 | 6 | 5 | 5 | 1 | 5 | 2 | 211 |
| 26 | Abyssal Fortress | 28×24 | 8 | 5 | 5 | 1 | 4 | 4 | 234 |
| 27 | Fractured Metropolis (V3R) | 32×32 | 9 | 5 | 7 | 2 | 4 | 5 | 190 |
| 28 | Nemesis Complex | 31×25 | 6 | 5 | 10 | 1 | 2 | 1 | 202 |
| 29 | Empire of Oblivion | 40×40 | 10 | 7 | 10 | 2 | 6 | 4 | 324 |
| 30 | The Endless Labyrinth | 48×40 | 12 | 7 | 10 | 3 | 8 | 7 | 419 |

Three one-way tiles pointing into walls in the original sample (maps 29 and 30) were already removed by the package; see the package notes in git history. Map data was not otherwise changed.

## 4. Real TypeScript engine verification

`GridWorldEnv.step()` replay of every shipped solution (existing `validateSolutions.test.ts`, plus new `scripts/v3Presets.test.ts`):

- JSON parse + `validateDraft`, import/export round-trip;
- all coordinates in range, no two elements share a cell;
- every toggle-wall group has a switch group;
- all goals collected exactly once, goal bitmask matches, no bomb entered;
- `done` is true only on the final action, exact step counts 211/234/190/202/324/419.

All pass. The Python model and the TS engine agree.

**Finding:** on map 25's reference route, no Fragile tile is ever stepped on (maps 26–30 use at least one). The five fragile tiles of #25 are therefore optional for the shipped solution. The approved design was not altered; this is reported rather than hidden.

## 5. Dynamic safety audit (`docs/v3-audit.json`)

Static (`auditStatic`): no blocked arrows and no unreturnable cells on all six maps.

Dynamic (`auditStateGraph`, budget 5,000 states): **all six `incomplete`, `losingStates: null`. No soft-lock freedom is claimed.** Gimmick necessity:

| Map | Switch | Portal | Fragile |
|---|---|---|---|
| 25 | required-proven | incomplete | incomplete |
| 26 | required-proven | incomplete | incomplete |
| 27 | required-proven | incomplete | incomplete |
| 28 | required-proven | incomplete | incomplete |
| 29 | required-proven | incomplete | required-proven |
| 30 | required-proven | incomplete | incomplete |

`required-proven` means the search that avoids that gimmick finished (30–1,700 states) with no success reachable. An ad-hoc probe with a 300,000-state budget was also `incomplete` for all six (the BFS never even reached a win), so exhaustive proof is infeasible with the current state encoding and was not attempted further. Results are computed, not hard-coded.

## 6. Provenance and preservation of 1–24

- Maps/solutions/previews: only files 25–30 differ from `main` (verified with `git diff --name-only`).
- `docs/v2-audit.json`, `docs/v2-source-inventory.json`, other V2 docs: unchanged.
- `auditSummary.json`: only the 25–30 entries changed.
- Catalog still has 30 presets, six per tier; ids/stems unchanged.

## 7. Gallery, home demos, UI (Playwright, `e2e/v3.spec.ts`)

Desktop (1366×768, 1440×900, 1920×1080, 768×1024) and mobile (iPhone 13, 390×844) projects:

- 'Very Hard' filter shows exactly six maps; every thumbnail image loads;
- each of 25–30 shows correct size, goal count, difficulty, step count and audit text; Apply works and the grid fits the viewport; default episodes remain 2,000;
- Load-into-editor works;
- manual play starts and moves on 25, 29, 30.

Home demos use the same solution data; the existing home E2E (map 30 steps on its mini demo) passes. Screenshots: `docs/screenshots/v3/`.

Not separately verified in a browser: a full, uninterrupted 419-step home demo run to its end and replacement; per-map hands-on play of every switch/portal on all six maps (covered by engine replay, not UI play-through); 48×40 zoom/follow beyond the existing follow/zoom E2E.

## 8. Turbo / training regression

No algorithm code changed. Browser E2E: Q-Learning and SARSA turbo start → stop → greedy run on maps 25, 29, 30 pass. Headless 500,100-step engine samples (seed 42, α .1 γ .9 ε .3, Q-table budget 1M):

| Map | Q-Learning steps/s | Q states | SARSA steps/s | Q states |
|---|---:|---:|---:|---:|
| 25 | 240k | 2,340 | 241k | 712 |
| 26 | 212k | 2,734 | 235k | 1,146 |
| 27 | 222k | 7,756 | 218k | 8,142 |
| 28 | 220k | 18,842 | 224k | 17,166 |
| 29 | 198k | 2,808 | 195k | 1,345 |
| 30 | 213k | 5,130 | 240k | 548 |

No budget pause occurred, Q rows stay well below the limit (≤ ~3 MB estimated), recorded steps below 500k. Existing benchmark suite passes. Training convergence on these maps is not claimed; the 2,000-episode default and the non-convergence notice are unchanged.

## 9. Test results

- `npm test`: 80 files, 1,421 tests passed (before adding the E2E spec; includes `scripts/v3Presets.test.ts`).
- `npm run lint`: clean. `npm run build`: success (chunk-size warning pre-existing).
- `npm run test:e2e`: 52 passed (existing suite), then the new V3 spec: 4 passed.
- `npm run benchmark`: 4 passed.

## 10. Known limitations

- Dynamic soft-lock freedom is unproven (see §5); the gallery says 'verification incomplete' for these maps.
- E2E uses the installed Microsoft Edge (`channel: 'msedge'`) per the repository config.
- Windows line-ending warnings (LF→CRLF) appear from git autocrlf; no content impact.

## 11. Changed files

Presets: 18 files under `src/data/presets/{maps,solutions,previews}` for 25–30, `catalog.json`, `manifest.ts`, `auditSummary.json`, `validateSolutions.test.ts`. Tests/scripts: `scripts/audit30.test.ts`, `scripts/v2Source.test.ts`, `scripts/v3Presets.test.ts`, `e2e/v3.spec.ts`. Docs: `docs/V3_VERY_HARD_UPGRADE.md`, `docs/v3-audit.json`, `docs/v3-source-inventory.json`, `docs/v3-validation-preliminary.json`, `docs/screenshots/v3/`.

## 12. Commit

See the final commit on the branch (SHA reported with the push; recorded in the follow-up note commit).
