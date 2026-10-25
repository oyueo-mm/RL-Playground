# RL Playground V2: only maps 19–30 replacement patch

Branch: feat/home-redesign

This patch targets the current 30-preset repository layout.
It does NOT alter presets 1–18. Contains updated catalog.json and the 12 replacement maps,
12 replacement solutions, 12 replacement PNG previews.

BEFORE applying: verify current repository branch, uncommitted changes, and the expected
30-preset structure under src/data/presets/. Do not blindly overwrite local changes.

AFTER applying:
1. Reconcile EN descriptive strings in src/data/presets/manifest.ts (revisedDescriptions):
   19–30 entries must describe new logical dependencies and return-to-start vault puzzle.
   Avoid changing the 1–18 records.
2. Run 30 tests against real TypeScript GridWorldEnv.step(), especially solutions 19–30.
3. Verify Gallery, DemoPlayback, Switch/Fragile/Portal render states, and 64x64 support.
4. Document limitations: full dynamic softlock freedom and convergence NOT proven.
5. Commit/push feat/home-redesign only. Never merge to main or deploy.

DO NOT apply by ZIP extraction to a project with a different path layout without inspection.
