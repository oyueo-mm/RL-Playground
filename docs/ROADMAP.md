# ROADMAP.md — RL Playground

이 문서는 `PRODUCT_SPEC.md`(무엇을), `ARCHITECTURE.md`(어떻게 구조화할지)를 바탕으로
한 **단계별 개발 순서**를 정의한다. 각 단계는 이전 단계가 동작하는 상태에서 시작하며,
단계 끝에서 "이 시점에 무엇이 동작해야 하는가"를 명시한다.

> Phase별 세부 구현 항목은 `ARCHITECTURE.md`(특히 §4~§5 타입/Engine 설계, §11 MVP 범위)를
> 따른다. `ARCHITECTURE.md`가 갱신되면(예: `DESIGN_REVIEW.md` 반영) 이 문서의 Phase 1/2도
> 함께 갱신한다 — 이번 개정에서 Phase 1/2/7/8/9와 하단 확장 목록을
> `ARCHITECTURE.md` §11의 MVP/Post-MVP/Future 분류에 맞춰 재정렬했다.
>
> **용어 구분**: `ARCHITECTURE.md` §11이 말하는 "MVP"는 **기능 범위**(GridWorld 1종 +
> Q-Learning만으로 완결된 관찰/편집/제어 경험, Phase 0~7 완료 시점)를 가리킨다. 이 문서의
> "**v1**"은 거기에 확장성 검증(Phase 8 SARSA)과 마감 작업(Phase 9)까지 더해 실제로
> 배포/공유 가능한 상태(Phase 0~9 완료 시점)를 가리킨다 — 둘을 같은 뜻으로 섞어 쓰지 않는다.

## 전체 그림

```
Phase 0  프로젝트 부트스트랩                                    [완료]
Phase 1  Core 도메인 — GridWorld + Q-Learning
Phase 2  Simulation Engine — Step/Episode/Run/Pause/Resume/Reset/Scheduler
Phase 3  기본 Grid UI
Phase 4  Inspector + Q-value 관찰
Phase 5  Run/Speed/Policy/Value 시각화
Phase 6  Statistics
Phase 7  Environment Editor (MVP 범위: Grid/Wall/Start/Goal)
         └─ 여기까지 완료되면 "GridWorld + Q-Learning 완결 경험"(MVP 기능 범위)이 갖춰진다
Phase 8  SARSA (Registry 확장성 검증)
Phase 9  마감 — 전체 회귀 검증 / Core-UI 경계 재확인 / 브라우저 & production build smoke test
         └─ Phase 0~9 전체 완료 시점이 v1

이후 (Phase 번호 없음, 별도 착수 시점에 재계획)
Post-MVP  JSON export/import · Custom Reward · Terminal 편집 ·
          Q-value history 스파크라인 · Cliff Walking/Frozen Lake 고도화
Future    TD(0) · Softmax/UCB · λ(eligibility trace) 계열 ·
          Web Worker 오프로딩 · 비-GridWorld 환경 · Deep RL
```

---

## Phase 0 — 프로젝트 부트스트랩 [완료]

**목표**: 개발 환경과 아키텍처 경계를 코드로 강제하는 기반을 마련한다.

- Vite + React + TypeScript 프로젝트 생성.
- Tailwind CSS 설정.
- Vitest 설정 (core 모듈 단위 테스트 실행 가능하도록).
- ESLint 규칙 추가: `src/core/**`에서 `react`/`react-dom`/DOM 전역 사용 금지
  (아키텍처 원칙을 린트로 강제).
- 디렉터리 스캐폴딩: `src/core`, `src/viz`, `src/ui` (ARCHITECTURE.md §3 구조).
- 최소한의 빈 `App.tsx`가 "RL Playground" 타이틀만 렌더링하는 상태로 빌드/실행 확인.

**완료 기준**: `npm run dev`로 빈 페이지가 뜨고, `npm run test`가 통과(테스트 0개라도)하고,
core 폴더에 React import 시 lint 에러가 난다.

---

## Phase 1 — Core 도메인 모델 (RL 로직, UI 없음)

**목표**: React 없이 Node/Vitest 환경에서 GridWorld + Q-Learning 한 스텝이
정확히 동작함을 테스트로 증명한다. 아래 항목은 `ARCHITECTURE.md` §4의 확정 타입을
그대로 따른다.

1. `core/types/rl.ts` — `StateKey`, `StepResult`, `Transition`(`StepResult` 합성),
   `TDInfo`(`algorithm: string`, `target`, `targetFormula`, `previousEstimate`,
   `updatedEstimate`, `error`), `ActionSelection` 정의 (§4.4).
2. `core/types/render.ts` — `EnvRenderModel`, `AgentSnapshot` 판별 유니온 (§4.4).
3. `core/types/hyperparams.ts` — `HyperparamField`/`HyperparamSchema`/`Hyperparams` (§4.5).
4. `core/environments/Environment.ts` — `Environment` 인터페이스(`reset`, `step`,
   `getState`, `getActionSpace`, `isTerminal`, `getRenderModel`, `getConfig`/`setConfig`)와
   `EnvironmentDefinition` 타입 정의 (§4.1).
5. `core/environments/gridworld/GridWorldEnv.ts` — 레퍼런스 저장소의 `Env.py` 로직을
   참고해 TS로 재구현:
   - Config: width, height, start, goal, walls(Set), stepReward, goalReward,
     boundary 처리(경계 이탈 시 페널티 + 위치 clamp). 셀별 커스텀 reward/임의 terminal
     지정은 Post-MVP(§11)이므로 Config 필드는 만들되 편집 UI는 Phase 7에서 제공하지 않는다.
   - `isTerminal(state)`가 `step()`의 `done`과 항상 일치하도록 구현(§4.1 불변식 —
     `LEGACY_ANALYSIS.md` §3에서 지적한 "터미널인데 부트스트랩" 함정 방지).
   - `getActionSpace()`는 항상 4(고정)를 반환.
6. `core/environments/registry.ts` — GridWorld를 `EnvironmentDefinition`으로 등록.
7. `core/agents/Agent.ts` — `ValueAgent`/`ActionValueAgent` 인터페이스 + `Agent` 유니온 (§4.2).
8. `core/agents/TabularQAgent.ts` — `ActionValueAgent` 구현체, `Map<StateKey, number[]>`
   기반 Q-table. MVP에서 실제로 쓰이는 유일한 Agent 구현체.
9. `core/agents/TabularValueAgent.ts` — `ValueAgent` 구현체, `Map<StateKey, number>` 기반
   V-table. **TD(0)는 Future이므로 이 구현체를 사용하는 Algorithm은 아직 없다** — 타입
   정합성 확인용 최소 구현 + 단위 테스트만 두고, registry에는 등록하지 않는다.
10. `core/agents/policies/epsilonGreedy.ts` — ε-greedy 순수 함수(상태, Q-table, ε →
    `ActionSelection`). Algorithm 구현체가 내부에서 호출.
11. `core/algorithms/Algorithm.ts` — `Algorithm` 인터페이스(`id`, `requiredAgentKind`,
    `hyperparamSchema`, `selectAction`, `pickNextAction?`, `computeUpdate`) 정의 (§4.3).
12. `core/algorithms/qLearning.ts` — 레퍼런스의 Q-Learning 업데이트 규칙을 이식.
    `requiredAgentKind: "Q"`, `pickNextAction` 미구현(off-policy). `computeUpdate`가
    `TDInfo`(target, targetFormula, **previousEstimate, updatedEstimate**, error)를 반환.
    `α=0.1, γ=0.9, ε 1.0→0.01 decay 0.995`를 GridWorld 프리셋 기본 하이퍼파라미터로 채택
    (`LEGACY_ANALYSIS.md` §5).
13. `core/algorithms/registry.ts` — Q-Learning만 등록(SARSA는 Phase 8, TD(0)는 Future).
14. Vitest 단위 테스트:
    - GridWorld: 경계 이탈, Wall 통과 시도, Goal 도달, `isTerminal`/`step().done` 일치.
    - Q-Learning: 알려진 Q-table 입력에 대해 TD Target/Error/`previousEstimate`/
      `updatedEstimate`가 손으로 계산한 값과 일치. Terminal 상태에서는 부트스트랩 항이
      0으로 처리되는지 별도 테스트.
    - ε-greedy: ε=0/ε=1 극단값에서 결정적으로 동작(시드 가능한 RNG 사용 고려).

**완료 기준**: `npm run test`에서 위 테스트가 모두 통과. 이 시점까지 UI는 없어도 된다.

---

## Phase 2 — Simulation Engine (여전히 UI 없음)

**목표**: Step/Episode/Run/Pause/Resume/Reset 상태 머신과 속도 제어를 UI 없이 검증한다.
아래 항목은 `ARCHITECTURE.md` §5의 확정 설계를 그대로 따른다.

1. `core/engine/EventEmitter.ts` — 경량 pub/sub.
2. `core/engine/snapshot.ts` — `EngineSnapshot` 생성 로직(`envRenderModel`/`agentSnapshot`은
   §4.4 판별 유니온 타입 그대로, `unknown` 아님).
3. `core/engine/SimulationEngine.ts`:
   - 내부 `performStep()` 프리미티브 구현: `pendingAction ?? algorithm.selectAction(...)`
     → `env.step` → `algorithm.pickNextAction?.(...)` → `algorithm.computeUpdate(...,
     nextAction?)` → `agent.applyUpdate(...)` → `pendingAction = nextAction ?? null` (§5.1).
     SARSA가 아직 없는 이 시점에도 `pickNextAction`이 `undefined`인 Q-Learning 경로가
     정상 동작하는지로 먼저 검증한다.
   - `step()`, `runEpisode()`, `run({episodes})`, `pause()`, `resume()`,
     `reset(overrides?: { envId?; envConfig?; algorithmId?; hyperparams? })` — reset은
     항상 Agent 재생성 + 통계 전체 초기화 + `pendingAction = null` (§5.5).
   - 상태 머신(IDLE/RUNNING/PAUSED) 구현 (§5.2).
   - **불변식**: 렌더링/emit 빈도와 무관하게 `performStep()`(실제 RL 계산)은 매 스텝 실행
     되어야 한다 — 이 불변식을 어기는 최적화(계산 스킵)는 금지 (§5.3).
4. `core/engine/Scheduler.ts`:
   - `TimerSource`(`now`/`setTimeout`/`clearTimeout`/`requestAnimationFrame`/
     `cancelAnimationFrame`)를 생성자에서 주입받는다. 기본값은 전역 API, 테스트에서는
     fake timer 주입 (§5.4).
   - 저속: `setTimeout` 기반 인터벌 스텝. 고속: 프레임당 N스텝 동기 실행 +
     `requestAnimationFrame` 양보, M 스텝마다 한 번만 emit.
   - **generation token**: Speed 전환 시 세대를 증가시키고, 예약된 콜백은 실행 시점에
     자신의 세대가 유효한지 검사 후 무효면 반환 — 저속↔고속 전환 시 스텝 중복/누락 방지 (§5.4).
5. Vitest 테스트:
   - 상태 머신 전이(Idle→Running→Paused→Running→Idle)가 규칙대로 동작.
   - `run({episodes: N})`이 정확히 N번 종료 후 자동 정지.
   - Speed를 RUNNING 중 반복적으로 빠르게 전환해도 스텝이 중복/누락되지 않음
     (generation token 검증).
   - `reset(overrides)`가 어떤 필드 조합으로 호출되든 Agent/통계를 항상 전체
     초기화하고, `overrides`가 없으면 env/algorithm 설정은 보존됨.
   - 고속 모드에서 emit 횟수는 스텝 수보다 적을 수 있지만, 최종 Q-table/통계 값은
     매 스텝 emit한 경우와 동일함(계산-emit 분리 불변식 검증).

**완료 기준**: mock 없이 실제 GridWorld+Q-Learning 조합으로 500 Episode를
헤드리스로 실행해 Success Rate가 상승하는 것을 테스트로 확인(회귀 방지용 스모크 테스트).

---

## Phase 3 — 최소 시각화 (Grid + 기본 컨트롤)

**목표**: 브라우저에서 GridWorld를 보고 Step을 눌러볼 수 있는 첫 화면.

1. `ui/hooks/useSimulationEngine.ts` — `useSyncExternalStore`로 snapshot 구독.
2. `viz/grid/GridSvg.tsx` — Grid, Wall, Start, Goal, Agent 렌더 (읽기 전용, 편집 아직 없음).
3. `viz/controls/PlaybackControls.tsx` — Step / Reset 버튼만 우선 구현.
4. `ui/App.tsx`에서 GridSvg + PlaybackControls 조립.

**완료 기준**: 시나리오 A(1~2번, PRODUCT_SPEC.md)가 실제로 브라우저에서 동작.
Step 클릭 시 Agent가 SVG 위에서 이동하는 것이 육안으로 보인다.

---

## Phase 4 — Inspector 패널 (State/Action/Reward/TD Target/TD Error)

**목표**: "왜 그 값이 나왔는가"를 화면에서 확인 가능하게 한다 (핵심 UX 목표 달성 시작).

1. `viz/panels/InspectorPanel.tsx` — `lastTransition`, `lastActionSelection`,
   `lastTdInfo`를 수식(`targetFormula`) 그대로 표시하고, `previousEstimate →
   updatedEstimate`(그리고 `α·error` 차이)를 함께 표시해 "TD Error 때문에 Q가 얼마나
   바뀌었는지"를 닫힌 형태로 보여준다(`ARCHITECTURE.md` §4.4, 교육적 핵심 요구사항).
2. `viz/panels/QValueBars.tsx` — 선택된 State의 Q(s,·) 4방향 막대그래프.
3. GridSvg에 State 클릭 선택 기능 추가(선택된 State 하이라이트 → QValueBars 연동).
4. 값 갱신 시 강조 애니메이션(CSS transition, Tailwind 기반).

**Q-value 이력 스파크라인은 이 Phase에서 구현하지 않는다** — Post-MVP 항목이며,
구현 시에도 Engine 변경 없이 UI 로컬 누적으로 처리한다(`ARCHITECTURE.md` §5.6).

**완료 기준**: 시나리오 A(3~4번), 시나리오 G(1~2번, 스파크라인 제외)가 브라우저에서 동작.

---

## Phase 5 — Run/Pause/Resume/Speed 제어 + Policy/Value Overlay

**목표**: 자유롭게 속도를 조절하며 관찰하거나 빠르게 여러 Episode를 돌릴 수 있게 한다.

1. `viz/controls/PlaybackControls.tsx`에 Run / Run Episode / Pause / Resume 추가.
2. `viz/controls/SpeedControl.tsx` — Step Interval 슬라이더, 실행 중 변경 가능
   (Scheduler의 generation token 덕분에 안전).
3. `viz/grid/PolicyOverlay.tsx`, `viz/grid/ValueHeatmap.tsx` — 토글 가능한 오버레이.
4. 고속 모드에서 배치 렌더링이 실제로 프레임 드랍 없이 동작하는지 수동 성능 확인
   (500~1000 Episode 연속 실행 시 탭이 멈추지 않는지).

**완료 기준**: 시나리오 D, E, F가 브라우저에서 동작.

---

## Phase 6 — Statistics 패널

**목표**: 학습 진행 상황을 정량적으로 확인.

1. `viz/panels/StatsPanel.tsx` — Episode, Total Reward, Episode Length, Success Rate.
2. `viz/panels/RewardChart.tsx` — Reward 이력 라인 차트(간단한 SVG 기반 또는 경량 라이브러리
   검토, 신규 의존성 추가 시 이유를 이 문서 또는 커밋에 기록).

**완료 기준**: 시나리오 E(2~4번)가 브라우저에서 동작.

---

## Phase 7 — Environment Editor (MVP 범위: Grid / Wall / Start / Goal)

**목표**: 사용자가 GridWorld를 직접 편집할 수 있게 한다. **여기까지 완료되면
"GridWorld + Q-Learning" 기준의 완결된 관찰/편집/제어 경험이 갖춰진다.**

1. `viz/controls/EnvEditor.tsx` — Grid 크기 변경, 셀 클릭으로 Wall 토글,
   Start/Goal 지정 모드 전환.
2. Draft 상태(로컬) → Apply 시 `engine.reset({ envConfig: draftConfig })` 반영(§5.5),
   확인 다이얼로그("설정 변경 시 학습이 초기화됩니다").

**이 Phase에서 하지 않는 것** (Post-MVP로 이관, `ARCHITECTURE.md` §7.3/§11):
셀별 커스텀 Reward 편집, 임의 Terminal 지정 편집, JSON export/import(FR-11).
GridWorldConfig 자체는 Phase 1에서 이미 이 필드들을 갖고 있으므로, Post-MVP 착수 시
Engine/타입 변경 없이 `EnvEditor` UI만 추가하면 된다.

**완료 기준**: 시나리오 B(Wall/Start/Goal/Grid 크기 편집 범위 내)가 브라우저에서 동작.

---

## Phase 8 — SARSA 추가 (Registry 확장성 검증)

**목표**: Simulation Engine을 수정하지 않고 두 번째 알고리즘을 추가할 수 있음을
실제로 증명한다. **TD(0)는 이 Phase에 포함하지 않는다** — Future로 격리된 별도 항목이며
사유는 `ARCHITECTURE.md` §7.2, §11과 `DESIGN_REVIEW.md` §1 R3/R8 참고
("다른 알고리즘의 Q-table을 참조해 정책을 평가"하는 요구사항이 registry 단독 확장성과
충돌하고, MVP 대비 과도하게 복잡함).

1. `core/algorithms/sarsa.ts` — `requiredAgentKind: "Q"`, on-policy 업데이트.
   `pickNextAction(nextState, agent, hp)`을 구현해 Engine의 `pendingAction` 캐시로
   재사용되게 한다(§4.3 — "TD Target 계산에 쓴 a'"와 "실제 다음 스텝의 a'"가 항상 일치).
2. `viz/controls/AlgorithmSelector.tsx`, `HyperparamPanel.tsx` — registry 기반 자동 옵션 노출
   (`hyperparamSchema` 순회로 폼 자동 생성).
3. Vitest:
   - SARSA 업데이트 공식 단위 테스트(Phase 1 Q-Learning 테스트와 동일한 패턴).
   - **회귀 방지 핵심 테스트**: `pickNextAction`이 반환한 action이 실제로 다음
     `performStep()`에서 실행되는 action과 동일한지(=`pendingAction` 재사용이 깨지지
     않았는지)를 Engine 레벨에서 검증.
4. 회귀 확인: 이 단계에서 `core/engine/SimulationEngine.ts`, `core/agents/**`의
   기존 코드를 **수정하지 않고** 완료 가능해야 한다(아키텍처 검증 게이트 — 안 된다면
   `ARCHITECTURE.md`의 인터페이스 설계를 다시 검토해야 한다는 신호).

**완료 기준**: 시나리오 C가 브라우저에서 동작. Q-Learning/SARSA를 전환하며 동일 환경에서
Reward 곡선 비교 가능.

---

## Phase 9 — 마감 (v1 최종 검증 및 회귀 감사)

**목표**: Phase 0~8까지의 결과에 새 기능을 추가하지 않고, 전체 시스템의 정합성·회귀·
빌드·브라우저 동작을 검증해 v1 배포 가능 상태로 마감한다.

> 이 절은 실제 Phase 9 수행 결과에 맞춰 갱신되었다. 최초 계획(EnvSelector/preset 노출,
> `docs/CONTRIBUTING_ENV_ALGO.md` 작성 등)은 실행 시점에 "새 기능 추가가 아니라 기존
> 구현의 마감 검증"으로 범위가 재확정되면서 대체되었다 — 아래 §"이후" Post-MVP 목록으로
> 이동한다.

1. 전체 회귀 테스트(`npm run test`/`npm run lint`/`npm run build`) 및 Phase 1~8 테스트
   수 유지 확인.
2. Core(`src/core/**`)에 React/DOM 의존성이 없는지 최종 재확인.
3. Q-Learning/SARSA, `SimulationEngine`(상태 머신/Scheduler/generation token/
   `reset(overrides)`/`pendingAction`), Environment Editor(v1 범위)의 계약이 문서와
   일치하는지 대조.
4. 브라우저 최종 smoke test — 개발 서버와 **production build(`vite preview`) 양쪽 모두**
   콘솔 에러 없이 동작하는지 확인(개발 환경에서만 동작하는 기능이 없는지 확인하는 것이
   목적).
5. 발견된 문제를 v1 blocker / 명백한 버그 / 설계 개선사항(수정 안 함) / Post-MVP(구현 안 함)
   4가지로 분류해 보고.

접근성(NFR-5)은 이번 Phase에서 별도 구현을 추가하지 않았다 — `PlaybackControls`가 이미
표준 `<button>` 엘리먼트를 사용하므로 Tab 이동 + Enter로 Step/Run/Pause를 조작하는
최소 요건은 네이티브 시맨틱만으로 충족됨을 최종 브라우저 검증에서 확인했다.
`EnvSelector`/preset 노출, `docs/CONTRIBUTING_ENV_ALGO.md`는 v1에 포함되지 않으며
Post-MVP로 유지한다(현재 Environment가 GridWorld 1종뿐이라 선택 UI 자체의 가치가
낮고, `core/environments/gridworld/presets.ts`도 아직 존재하지 않는다 — Phase 1의
"프리셋" 계획은 실제로는 구현되지 않았다).

**완료 기준(=v1 완료 기준)**: `PRODUCT_SPEC.md`의 사용자 시나리오 A~H가 (TD(0) 관련
서술 및 시나리오 G의 스파크라인 부분을 제외하고) 브라우저에서 실제로 동작하며,
`ARCHITECTURE.md` §11 "MVP" 기능 범위(Phase 7 시점)와 "Post-MVP" 중 SARSA 부분(Phase 8)이
모두 충족되고, 전체 테스트/lint/production build가 성공한다.

---

## 이후 (Phase 번호 없음 — 별도 착수 시점에 세부 계획 수립)

`ARCHITECTURE.md` §11의 분류를 그대로 따른다. v1(Phase 0~9)이 끝난 뒤 우선순위에
따라 순서를 정한다.

### Post-MVP

- JSON export/import (FR-11) — GridWorld config 저장/공유.
- Custom Reward 편집 — 셀별 reward 지정 UI (FR-8).
- Terminal 편집 — 임의 셀을 Terminal로 지정/해제 UI (FR-9).
- Q-value history 스파크라인 — 선택된 State에 한해 UI 로컬로 최근 N개 값 누적
  (`ARCHITECTURE.md` §5.6, Engine/타입 변경 없음).
- 기본 Preset 노출 및 Cliff Walking / Frozen Lake 고도화 — `core/environments/gridworld/presets.ts`
  (5x5/7x7 등 기본 프리셋)와 이를 고르는 `EnvSelector` UI를 함께 추가한다. 둘 다 v1(Phase 9)
  시점까지 구현되지 않았다 — 현재 Environment가 GridWorld 1종뿐이라 선택 UI의 가치가
  낮았기 때문이다. Cliff Walking/Frozen Lake 스타일의 큐레이션된 config는 이 기반 위에서
  추가한다.
- 접근성 심화 — 현재는 `PlaybackControls`의 네이티브 `<button>` 시맨틱으로 Tab+Enter
  조작(Step/Run/Pause)까지만 보장된다(Phase 9 최종 브라우저 검증에서 확인). 포커스
  인디케이터 커스터마이징, ARIA 라이브 리전을 통한 Inspector 갱신 안내 등 심화 작업은
  Post-MVP.
- `docs/CONTRIBUTING_ENV_ALGO.md` — Environment/Algorithm registry 등록 방법 온보딩 문서.

### Future

- **TD(0)** — 고정된 랜덤 정책 평가라는 가장 단순한 형태부터 시작. "다른 알고리즘이
  학습한 Q로부터 유도한 정책을 평가"하는 기능은 별도 설계 검토 전에는 추가하지 않는다
  (`ARCHITECTURE.md` §7.2/§11, `DESIGN_REVIEW.md` §1 R3/R8). `TabularValueAgent`/
  `ValueAgent` 인터페이스는 Phase 1에서 이미 자리를 마련해 두었다.
- Softmax/UCB 행동 선택 정책.
- λ(eligibility trace) 계열 알고리즘.
- Web Worker 기반 오프로딩(NFR-2, 실제 성능 문제가 관측되면 도입).
- 비-GridWorld 환경(Maze 등 위상 구조가 다른 환경), Trap/Multi-goal/특수 Tile/이동 비용/
  확률적 이동/Wind dynamics.
- Deep RL(함수 근사) — 별도 아키텍처 검토 필요(Agent/Algorithm 인터페이스 재검토 가능성).
- 환경 설정 저장/공유(로컬 스토리지 이상의 백엔드 연동).

---

## 단계 간 원칙

- 각 Phase는 이전 Phase의 완료 기준을 깨지 않아야 한다(Vitest 스위트는 항상 그린 유지).
- UI 계층 작업(Phase 3 이후)은 반드시 Phase 1~2에서 만든 core API를 그대로 사용하며,
  UI 편의를 위해 core에 React 의존성을 역으로 주입하지 않는다.
- 새 알고리즘을 추가하는 Phase 8은 "기존 `SimulationEngine`/`core/agents/**` 코드
  무수정"이 완료 기준의 일부다 — 만약 무수정으로 안 된다면 `ARCHITECTURE.md`의
  인터페이스 설계 자체를 재검토해야 한다는 신호로 간주한다.
- TD(0)는 Phase 8이 아니라 Future 항목이다 — SARSA 검증이 끝나기 전까지 TD(0) 설계에
  시간을 쓰지 않는다.
