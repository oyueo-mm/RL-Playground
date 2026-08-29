# ARCHITECTURE.md — RL Playground

이 문서는 RL Playground의 모듈 구조, 데이터 흐름, 기술 선택 근거를 정의한다.
기능 요구사항은 `PRODUCT_SPEC.md`, 개발 순서는 `ROADMAP.md`를 참고한다.

---

## 1. 기술 스택 및 선택 근거

| 영역 | 선택 | 이유 |
|---|---|---|
| UI 프레임워크 | React + TypeScript | 컴포넌트 단위로 Inspector/Grid/Stats 패널을 독립적으로 관리하기 용이하고, TS로 State/Action/Transition 등 RL 도메인 타입을 엄격히 정의할 수 있음 |
| 빌드 도구 | Vite | 빠른 HMR로 시각화 컴포넌트를 반복 조정하는 개발 사이클에 적합 |
| 스타일링 | Tailwind CSS | Inspector/Stats 등 정보 밀도가 높은 대시보드형 UI를 빠르게 조립 |
| 테스트 | Vitest | Vite 생태계와 통합이 쉽고, 알고리즘/환경 순수 함수에 대한 단위 테스트를 빠르게 실행 |
| 환경 시각화 | **SVG** (최초), Canvas는 향후 대형 그리드용으로 검토 | 아래 1.1 참고 |
| 상태 동기화(엔진↔React) | `useSyncExternalStore` 기반 커스텀 훅 | 엔진을 React 외부의 순수 클래스로 유지하면서 React 렌더링과 안전하게 동기화 |

### 1.1 SVG vs Canvas 선택 근거

- GridWorld류 환경은 최초 버전 기준 셀 수가 많지 않음(수십~수백 셀 수준).
- 각 셀에 대해 클릭 이벤트(Wall 토글, Start/Goal 지정, State 선택), hover 툴팁,
  Q-value 텍스트/화살표 오버레이 등 **개별 엘리먼트 단위 상호작용**이 많다.
- SVG는 DOM 엘리먼트 단위로 이벤트/스타일/애니메이션(CSS transition)을 다룰 수 있어
  이런 요구에 더 적합하고, React 컴포넌트로 선언적으로 표현하기 쉽다.
- Canvas는 셀 수가 매우 많아지거나(수천 셀), 프레임 단위 커스텀 애니메이션이 필요할 때
  성능상 유리하지만, 현재 요구사항(교육용 GridWorld 계열, 관찰 중심)에서는 이점이 크지 않음.
- **결정**: 최초 버전은 SVG로 구현하고, `viz/grid` 모듈은 렌더러를 교체 가능하게
  분리해 향후 대형 환경 등장 시 Canvas 렌더러를 추가할 수 있도록 한다.

---

## 2. 계층 구조 (Layered Architecture)

```
Environment → Agent → Algorithm → Simulation Engine → Visualization → UI
```

### 2.1 계층별 책임과 의존 방향

```
┌─────────────────────────────────────────────────────────┐
│ UI (React components, layout, forms)                     │
│  - RL 수식을 직접 구현하지 않는다                          │
├─────────────────────────────────────────────────────────┤
│ Visualization (React components: Grid SVG, Charts)       │
│  - RL 계산을 직접 수행하지 않는다. Engine이 만든 snapshot만│
│    그린다                                                 │
├─────────────────────────────────────────────────────────┤
│ Simulation Engine (순수 TS, React 비의존)                 │
│  - UI와 분리. Step/Episode 루프, 타이밍/속도 제어,         │
│    이벤트 emit                                            │
├─────────────────────────────────────────────────────────┤
│ Algorithm (순수 함수/클래스, React 비의존)                 │
│  - Q-Learning/SARSA/(향후) TD(0) 업데이트 규칙, 행동 선택   │
│    정책(ε-greedy 등)을 소유. 어떤 Agent 종류(V/Q)가        │
│    필요한지 스스로 선언한다 (§4.2 참고)                     │
├─────────────────────────────────────────────────────────┤
│ Agent (순수 클래스, React 비의존)                          │
│  - Value/Q-table 저장소. ValueAgent(V-table) 또는          │
│    ActionValueAgent(Q-table) 중 알고리즘이 요구하는 종류로  │
│    Engine이 생성한다 (§4.2 참고)                            │
├─────────────────────────────────────────────────────────┤
│ Environment (순수 클래스, React 비의존)                    │
│  - reset()/step()/config, GridWorld 등                    │
└─────────────────────────────────────────────────────────┘
```

- 의존 방향은 항상 **위 계층 → 아래 계층**이며 역방향 의존은 금지한다.
- `Environment`, `Agent`, `Algorithm`, `Simulation Engine`은 `src/core/`에 위치하며
  React/DOM import를 하지 않는다(ESLint 규칙으로 강제, ROADMAP 참고).
- `Visualization`, `UI`는 `src/viz/`, `src/ui/`에 위치하며 `core`의 출력(snapshot)만 소비한다.

---

## 3. 디렉터리 구조 (제안)

```
src/
  core/
    types/
      rl.ts            # StateKey, Transition, StepResult, TDInfo, ActionSelection
      render.ts         # EnvRenderModel, AgentSnapshot 판별 유니온 (§4.4)
      hyperparams.ts     # HyperparamSchema (§4.5)
    environments/
      Environment.ts    # Environment 인터페이스, EnvironmentDefinition 타입 (§4.1)
      registry.ts        # 환경 레지스트리 (EnvironmentDefinition을 id로 등록)
      gridworld/
        GridWorldEnv.ts
        types.ts          # GridWorldConfig, CellType 등
        presets.ts        # 기본 5x5/7x7 프리셋
    agents/
      Agent.ts            # ValueAgent / ActionValueAgent 인터페이스 + Agent 유니온 (§4.2)
      TabularQAgent.ts     # Q-table 구현체 (ActionValueAgent, Q-Learning/SARSA가 사용, MVP)
      TabularValueAgent.ts # V-table 구현체 (ValueAgent, TD(0)용— Future, 인터페이스만 대비)
      policies/
        epsilonGreedy.ts   # 순수 함수. Algorithm.selectAction 구현체가 내부에서 호출
    algorithms/
      Algorithm.ts         # Algorithm 인터페이스 (§4.3): selectAction/pickNextAction?/computeUpdate
      registry.ts           # 알고리즘 레지스트리 (id -> factory)
      qLearning.ts           # MVP
      sarsa.ts                # Post-MVP (ROADMAP Phase 8), pickNextAction 사용
      td0.ts                   # Future — MVP/Post-MVP 범위 밖 (§11 참고)
    engine/
      SimulationEngine.ts   # step/runEpisode/run/pause/resume/reset, 이벤트 emit
      Scheduler.ts            # TimerSource 주입 + generation token 기반 속도 제어 (§5.4)
      EventEmitter.ts         # 경량 pub/sub (외부 라이브러리 비의존)
      snapshot.ts              # EngineSnapshot 타입 및 생성 함수
  viz/
    grid/
      GridSvg.tsx            # 셀 렌더, 클릭 핸들러(Wall/Start/Goal 편집, State 선택)
      AgentMarker.tsx
      PolicyOverlay.tsx
      ValueHeatmap.tsx
    panels/
      InspectorPanel.tsx     # State/Action/Reward/NextState/TDTarget/TDError
      QValueBars.tsx
      StatsPanel.tsx          # Episode/TotalReward/Length/AvgReward/SuccessRate
      RewardChart.tsx
    controls/
      PlaybackControls.tsx    # Step/RunEpisode/Run/Pause/Resume/Reset
      SpeedControl.tsx
      EnvSelector.tsx
      AlgorithmSelector.tsx
      HyperparamPanel.tsx
      EnvEditor.tsx            # Grid 크기/Wall/Start/Goal/Reward/Terminal 편집
  ui/
    hooks/
      useSimulationEngine.ts  # useSyncExternalStore로 EngineSnapshot 구독
      useEngineActions.ts       # step/run/pause/... 액션 바인딩
    App.tsx
    layout/
      PlaygroundLayout.tsx
  test/
    (core 모듈에 대한 vitest 단위 테스트는 각 모듈과 동일 위치에 *.test.ts로 배치)
docs/
  PRODUCT_SPEC.md
  ARCHITECTURE.md
  ROADMAP.md
  LEGACY_ANALYSIS.md
  DESIGN_REVIEW.md
```

---

## 4. 핵심 타입 (개념 정의, 최종 시그니처는 구현 단계에서 확정)

> 이 섹션은 `docs/DESIGN_REVIEW.md` §8의 수정안을 반영한 확정 버전이다.
> 이전 버전은 SARSA(next-action 재사용)와 TD(0)(V-table)를 표현할 수 없다는
> 구조적 결함이 있었다 — 자세한 근거는 `DESIGN_REVIEW.md` §2 Q2, §3을 참고.

### 4.1 Environment

```ts
// core/environments/Environment.ts
type StateKey = string; // 환경별 State를 직렬화한 고유 키 (예: GridWorld는 "x,y")

interface StepResult {
  nextState: StateKey;
  reward: number;
  done: boolean;
}

interface Environment {
  reset(): StateKey;
  step(action: number): StepResult;
  getState(): StateKey;              // 현재 State 조회 (step 없이)
  getActionSpace(): number;           // 고정 action 개수. 상태별 가변 action space는
                                       // MVP 범위 밖 (DESIGN_REVIEW §2 Q1 — 복잡도 대비 이득 없음)
  isTerminal(state: StateKey): boolean; // 순수 조회. step()의 done과 항상 일치해야 하는 불변식:
                                       // step(a).done === isTerminal(step(a).nextState)
  getRenderModel(): EnvRenderModel;    // §4.4, 시각화 전용 스냅샷
  getConfig(): unknown;                 // 환경별 config (편집 UI가 읽음, 타입은 환경마다 다름)
  setConfig(config: unknown): void;
}

// registry에 등록되는 "환경의 종류"는 런타임 Environment 인스턴스와 별개 개념이다.
interface EnvironmentDefinition {
  id: string;
  displayName: string;
  createDefaultConfig(): unknown;
  create(config: unknown): Environment;   // factory
  editorSchema: unknown;                    // EnvEditor 폼 자동 생성용 (Phase 7 확정)
}
```

- `isTerminal(state)`가 필요한 이유: Algorithm이 부트스트랩 여부(`γ·max Q(s')` 항을 넣을지)를
  판단하려면 `step()`을 호출하지 않고도 임의 상태의 terminal 여부를 조회할 수 있어야 한다.
  `LEGACY_ANALYSIS.md` §3에서 지적한 "터미널인데 부트스트랩해버리는" 함정을 여기서 막는다.
- `getActionSpace()`는 환경 전체에 대해 고정된 값이다(GridWorld는 4). 벽/경계에 부딪히는 것은
  "이동 실패 + 페널티"로 처리하며 action을 제거하지 않는다(레퍼런스 저장소와 동일한 접근,
  `LEGACY_ANALYSIS.md` §2 참고).
- `EnvironmentDefinition`(정적인 "환경 종류" 메타데이터)과 `Environment`(런타임 인스턴스)는
  명확히 다른 타입이다 — 전자는 `EnvSelector`/`EnvEditor`가, 후자는 `SimulationEngine`이 다룬다.

### 4.2 Agent

```ts
// core/agents/Agent.ts
interface ValueAgent {
  kind: "V";
  getValue(state: StateKey): number;
  applyUpdate(state: StateKey, tdInfo: TDInfo): void;
  reset(): void;
}

interface ActionValueAgent {
  kind: "Q";
  getValue(state: StateKey, action: number): number;
  getQVector(state: StateKey): number[]; // 전체 action에 대한 Q(s,·), UI의 QValueBars용
  applyUpdate(state: StateKey, action: number, tdInfo: TDInfo): void;
  reset(): void;
}

type Agent = ValueAgent | ActionValueAgent;
```

- MVP는 Q-Learning만 지원하므로 실제로 인스턴스화되는 것은 `TabularQAgent`
  (`ActionValueAgent` 구현체, `Map<StateKey, number[]>` 기반)뿐이다.
- `TabularValueAgent`(`ValueAgent` 구현체, `Map<StateKey, number>` 기반)는 TD(0)를 Future에서
  실제로 추가할 때 쓸 자리로 인터페이스만 지금 확정해 둔다 — TD(0) 자체의 구현/등록은
  하지 않는다(§11).
- 행동 선택 정책(ε-greedy 등)은 더 이상 `Agent`가 소유하지 않는다. Q-Learning/SARSA처럼
  Q-table 기반 ε-greedy를 쓰는 알고리즘도 있고, TD(0)처럼 "주어진 고정 정책을 따라간다"는
  전혀 다른 정책을 쓰는 알고리즘도 있기 때문에, 정책은 **Algorithm이 소유**한다(§4.3).
  `core/agents/policies/epsilonGreedy.ts`는 여러 Algorithm 구현체가 재사용하는 순수 함수로만
  남는다.

### 4.3 Algorithm

```ts
// core/algorithms/Algorithm.ts
interface Algorithm {
  id: string;                    // registry id. 리터럴 유니온으로 하드코딩하지 않는다
                                  // (신규 알고리즘 등록만으로 확장 가능해야 하므로 — NFR-4)
  requiredAgentKind: "V" | "Q";   // Engine이 알고리즘 전환 시 어떤 Agent를 새로 만들지 결정
  hyperparamSchema: HyperparamSchema; // §4.5

  selectAction(state: StateKey, agent: Agent, hp: Hyperparams): ActionSelection;

  // SARSA류(on-policy, next action이 target 계산에 필요한 알고리즘)만 구현한다.
  // Q-Learning/TD(0)는 생략(undefined) — Engine은 다음 스텝에서 selectAction을 새로 호출한다.
  pickNextAction?(nextState: StateKey, agent: Agent, hp: Hyperparams): ActionSelection;

  computeUpdate(
    transition: Transition,
    agent: Agent,
    hp: Hyperparams,
    nextAction?: ActionSelection // pickNextAction이 있는 알고리즘만 사용
  ): TDInfo;
}
```

- **SARSA의 next-action 재사용 문제** (`DESIGN_REVIEW.md` §2 Q2 결함 A): SARSA의 TD Target은
  `r + γ·Q(s', a')`이며 `a'`는 **다음 실제 스텝에서 진짜로 실행되는 행동**이어야 한다(on-policy
  정의 자체). Engine이 매 스텝 `selectAction`을 독립적으로 새로 호출하면 ε-greedy의 무작위성
  때문에 "target 계산에 쓴 a'"와 "실제로 실행된 a'"가 어긋날 수 있다. 이를 막기 위해
  `pickNextAction`으로 다음 행동을 미리 계산해 Engine이 캐시(`pendingAction`)해두고, 다음
  스텝에서 새로 선택하지 않고 그대로 재사용한다 — Engine 루프 구조는 §5.1에서 정의한다.
- Q-Learning은 `pickNextAction`을 구현하지 않는다(off-policy — target은 `max_a' Q(s',a')`로
  실제 다음 행동과 무관하게 계산되므로 재사용할 필요가 없다).
- 알고리즘별 ε-greedy 등 정책 구현은 `selectAction` 안에서 `policies/epsilonGreedy.ts`를
  호출하는 방식으로 Q-Learning/SARSA가 코드를 공유한다.

### 4.4 공용 타입 (Transition, TDInfo, ActionSelection, 렌더링/스냅샷 타입)

```ts
// core/types/rl.ts
interface Transition extends StepResult {
  state: StateKey;
  action: number;
}
// Transition = { state, action } & StepResult 로 합성해 nextState/reward/done 필드가
// 두 곳에서 중복 선언되어 드리프트하는 것을 방지한다.

interface TDInfo {
  algorithm: string;        // registry id (리터럴 유니온 아님 — Algorithm.id와 동일 원칙)
  target: number;            // TD Target 계산값
  targetFormula: string;      // 사용자에게 보여줄 수식 문자열 (값이 대입된 형태)
  previousEstimate: number;    // 갱신 전 Q(s,a) 또는 V(s)
  updatedEstimate: number;      // 갱신 후 값 (= previousEstimate + α · error)
  error: number;                  // TD Error (δ = target - previousEstimate)
}

interface ActionSelection {
  action: number;
  wasExploration: boolean;   // ε-greedy에서 탐험/활용 여부
  candidateValues: number[];  // 비교에 사용된 Q(s,·) (ValueAgent 알고리즘은 빈 배열일 수 있음)
}
```

```ts
// core/types/render.ts — EngineSnapshot에서 unknown 대신 사용 (DESIGN_REVIEW §3)
type EnvRenderModel =
  | {
      kind: "grid";
      width: number;
      height: number;
      walls: StateKey[];
      bombs: StateKey[];
      bombPenalty: number;
      // Phase 30: stepReward/wallPenalty/goalReward optional (Environment Editor seed
      // only — see EnvEditor.tsx); goal is now goals: StateKey[] (Phase 30 §6-§10 —
      // Episode ends only once every Goal has been visited, or a Bomb is reached).
      stepReward?: number;
      wallPenalty?: number;
      goalReward?: number;
      start: StateKey;
      goals: StateKey[];
      agentPos: StateKey;
      cellRewards?: Record<StateKey, number>;
    };
  // 향후 비-grid 환경 추가 시 유니온 멤버 추가 (예: { kind: "graph"; ... })

type AgentSnapshot =
  | { kind: "Q"; qTable: Record<StateKey, number[]> }
  | { kind: "V"; vTable: Record<StateKey, number> };
```

- `TDInfo.previousEstimate`/`updatedEstimate` 추가는 교육적 핵심 요구사항이다
  (`PRODUCT_SPEC.md` FR-32, FR-35 — "Value/Q-value가 왜 바뀌었는가"). TD Error(δ)만으로는
  "그래서 값이 실제로 얼마나, 어떻게 바뀌었는지"를 화면에서 닫힌 형태로 보여줄 수 없어서
  전/후 값을 함께 노출한다(`DESIGN_REVIEW.md` §5, §6).
- `EnvRenderModel`/`AgentSnapshot`을 판별 유니온(`kind` 필드)으로 구체화해 `viz/**`가
  캐스팅 없이 타입 안전하게 렌더링할 수 있게 한다. `AgentSnapshot`의 `kind`는
  `Algorithm.requiredAgentKind`와 항상 일치한다.

### 4.5 HyperparamSchema

```ts
// core/types/hyperparams.ts
interface HyperparamField {
  key: string;             // 예: "alpha", "gamma", "epsilonStart"
  label: string;             // UI 표시명
  type: "number" | "range";
  min?: number;
  max?: number;
  step?: number;
  default: number;
}
type HyperparamSchema = HyperparamField[];
type Hyperparams = Record<string, number>; // key -> 현재 값
```

- `HyperparamPanel`은 `Algorithm.hyperparamSchema`를 순회해 폼을 자동 생성한다
  (하드코딩 금지 — NFR-4, §7.2와 동일한 registry 확장 원칙).

---

## 5. Simulation Engine 설계

### 5.1 책임 및 스텝 루프 (pendingAction)

- Environment/Agent/Algorithm 인스턴스를 조합해 스텝을 수행한다. `pickNextAction`을 가진
  알고리즘(SARSA)의 정확성을 보장하기 위해, Engine은 다음 스텝에서 실행할 행동을
  `pendingAction`으로 캐시해 재사용한다(§4.3 — SARSA next-action 재사용 문제 해결):

  ```
  // Engine 내부 상태: pendingAction: ActionSelection | null

  function performStep():
    action = pendingAction ?? algorithm.selectAction(env.getState(), agent, hp)
    transition = { state: env.getState(), action: action.action, ...env.step(action.action) }
    nextAction = algorithm.pickNextAction?.(transition.nextState, agent, hp)
    tdInfo = algorithm.computeUpdate(transition, agent, hp, nextAction)
    agent.applyUpdate(...)  // kind("V"|"Q")에 맞는 오버로드
    pendingAction = nextAction ?? null   // 있으면 다음 performStep()이 재사용, 없으면 새로 선택
    return { transition, actionSelection: action, tdInfo }
  ```

  - Q-Learning: `pickNextAction`이 없으므로 `pendingAction`은 항상 `null` — 매 스텝
    `selectAction`을 새로 호출(기존 동작과 동일).
  - SARSA: `pickNextAction`이 반환한 `nextAction`이 다음 `performStep()`에서 그대로
    `action`으로 쓰이므로, "TD Target 계산에 쓴 a'"와 "실제로 실행된 a'"가 항상 일치한다.
  - `reset()`(§5.5) 시 `pendingAction`은 반드시 `null`로 초기화한다.

- `step()`(단발) / `runEpisode()` / `run({episodes})`는 모두 위 `performStep()`을 공유
  프리미티브로 재사용한다. 차이는 "몇 번 반복하고 언제 멈추는가"와 "매번 emit하는가"뿐이다:
  - `step()`: `performStep()` 1회 실행 후 항상 emit.
  - `runEpisode()`: `done === true`가 될 때까지 반복.
  - `run({episodes})`: episode 카운트가 목표에 도달하거나 `pause()`가 호출될 때까지 반복.
- Pause/Resume/Reset 상태 머신을 관리한다(§5.2).
- 실행 속도(Speed/Step Interval)를 `Scheduler`를 통해 제어한다(§5.4).

### 5.2 상태 머신

```
IDLE --step()--> IDLE (single step executed, stays idle)
IDLE --run()/runEpisode()--> RUNNING
RUNNING --pause()--> PAUSED
PAUSED --resume()--> RUNNING
RUNNING/PAUSED --reset(overrides?)--> IDLE
```

- Environment/Algorithm/Hyperparameter 변경은 상태 머신의 전이가 아니라 **항상
  `reset(overrides)` 호출로 처리**한다(§5.5) — RUNNING 중 변경 요청이 오면 Engine이 먼저
  내부적으로 정지한 뒤 `reset`을 수행한다(구현 단순화를 위한 정책: "실행 중 설정 변경 시
  자동 정지 후 즉시 반영").
- Speed 변경은 위 상태 머신과 독립적으로 RUNNING 중에도 즉시 적용 가능하다(FR-24, §5.4).

### 5.3 계산 빈도와 렌더링 빈도 분리 (불변식)

> **불변식**: 렌더링/구독자 통지(emit) 빈도는 프레젠테이션 레이어의 관심사일 뿐이며,
> 실제 RL 계산(`performStep()` — env.step, algorithm.computeUpdate, agent.applyUpdate,
> 통계 누적)은 **항상 매 스텝 1회씩, 빠짐없이** 수행되어야 한다. 고속 모드(FR-25)에서
> "N 스텝마다 1번만 emit"하는 최적화는 허용되지만, "N 스텝 중 1번만 계산"하는 최적화는
> 학습 결과를 조용히 오염시키므로 **금지**한다(`DESIGN_REVIEW.md` §2 Q5).
>
> 고속 모드에서 Inspector가 스킵된 스텝의 TD 정보를 보여줄 수 없는 것은 이 불변식의
> 당연한 귀결이다 — Inspector는 "마지막으로 emit된 스텝"의 정보만 표시하며, 이는
> `PRODUCT_SPEC.md`가 요구하는 "관찰 가능성"이 저속/Step 모드에서 충족되고 고속 Run
> 모드에서는 통계(Statistics 패널)로 대체 관찰된다는 것을 의미한다.

### 5.4 Scheduler — TimerSource 주입 및 generation token

- `Scheduler`는 `requestAnimationFrame`/`setTimeout` 등 브라우저 타이머 API에 직접
  의존하지 않고, 생성자에서 `TimerSource`를 주입받는다:

  ```ts
  interface TimerSource {
    now(): number;
    setTimeout(fn: () => void, ms: number): number;
    clearTimeout(id: number): void;
    requestAnimationFrame(fn: () => void): number;
    cancelAnimationFrame(id: number): void;
  }
  ```

  기본값은 전역 `window`/`globalThis` API를 사용하고, Vitest(Node) 환경에서는 fake
  timer를 주입해 `Scheduler`를 React/브라우저 없이 단독 테스트한다(§3 디렉터리 구조,
  §9 테스트 전략과 일치 — `DESIGN_REVIEW.md` §2 Q3).
- 저속(`setTimeout` 인터벌) ↔ 고속(`requestAnimationFrame` 기반 배치) 전환 시,
  이미 큐에 들어간 이전 스케줄의 콜백이 뒤늦게 실행되어 스텝이 중복/누락될 수 있는
  race condition이 있다(`DESIGN_REVIEW.md` §2 Q6). 이를 막기 위해 `Scheduler`는
  세대 토큰(`generation: number`)을 두고, Speed 전환 시 `generation`을 증가시킨다.
  각 예약된 콜백은 실행 시점에 자신이 예약될 때의 `generation`이 현재 `generation`과
  같은지 검사하고, 다르면(=무효화됨) 즉시 반환한다.

### 5.5 reset() 계약

```ts
interface ResetOverrides {
  envId?: string;
  envConfig?: unknown;
  algorithmId?: string;
  hyperparams?: Hyperparams;
}

reset(overrides?: ResetOverrides): void
```

- 정책: **어떤 필드가 바뀌든 관계없이 항상 전체 재초기화**한다 — `envId`/`envConfig`만
  바뀌어도, `algorithmId`/`hyperparams`만 바뀌어도 다음이 전부 수행된다:
  1. (필요 시) `environment = createEnvironment(envId ?? 현재값, envConfig ?? 현재값)`
     — registry(`EnvironmentDefinition`) 조회 후 생성, `environment.reset()` 호출.
  2. (필요 시) `algorithm = createAlgorithm(algorithmId ?? 현재값)` — registry 조회.
  3. `algorithm.requiredAgentKind`에 맞는 새 `Agent`(`TabularQAgent` 또는
     `TabularValueAgent`)를 생성한다(기존 Agent를 재사용하지 않음 — kind가 바뀔 수 있으므로).
  4. `hyperparams = overrides.hyperparams ?? algorithm.hyperparamSchema의 default 값들`.
  5. 통계(`stats`) 전체 초기화, `pendingAction = null`, episode/step 카운터 초기화.
  6. `emit(snapshot)`.
- 부분 초기화(예: env만 바뀌었으니 Agent는 유지)는 허용하지 않는다 — 상태 불일치
  가능성을 없애기 위한 단순하고 보수적인 정책이다(`DESIGN_REVIEW.md` §2 Q7).
- `overrides` 없이 호출하는 "Reset" 버튼(FR-21)은 `envId`/`algorithmId`/`hyperparams`를
  모두 현재값으로 유지한 채 위 절차를 수행하는 것과 동일하다(환경/알고리즘 설정은 보존,
  학습 상태만 초기화).

### 5.6 EngineSnapshot (Engine → Visualization 데이터 흐름)

```ts
interface EngineSnapshot {
  status: "idle" | "running" | "paused";
  episode: number;
  stepInCurrentEpisode: number;
  lastTransition: Transition | null;
  lastActionSelection: ActionSelection | null;
  lastTdInfo: TDInfo | null;
  envRenderModel: EnvRenderModel;   // §4.4 판별 유니온 (unknown 아님)
  agentSnapshot: AgentSnapshot;      // §4.4 판별 유니온 (unknown 아님)
  stats: {
    totalRewardThisEpisode: number;
    rewardHistory: number[];       // 최근 N개 (또는 다운샘플링된 전체)
    avgRewardMovingWindow: number;
    successRate: number;
  };
}
```

- Visualization/UI는 이 `EngineSnapshot`만 소비하며, 내부적으로 RL 계산을 재수행하지 않는다.
- 고빈도 갱신(고속 모드)에서는 `rewardHistory` 등을 다운샘플링해 렌더링 비용을 제한한다
  (단, §5.3 불변식에 따라 다운샘플링은 emit 대상 데이터에만 적용되고 실제 계산에는 영향
  없어야 한다).
- 선택된 State의 Q-value 변화 이력(스파크라인, `PRODUCT_SPEC.md` 시나리오 G)은
  `EngineSnapshot`에 필드를 추가하지 않는다 — 모든 State의 이력을 Engine이 들고 있으면
  grid 크기에 비례해 메모리가 무한히 증가하기 때문이다. 대신 **UI 레이어**(`ui/hooks`)가
  "현재 선택된 State"에 대해서만 연속된 snapshot을 관찰하며 클라이언트 로컬로 최근 N개
  값을 누적한다. 이 기능 자체는 Post-MVP다(§11).

---

## 6. 데이터 흐름 (End-to-End)

### 6.1 단일 Step 흐름

```
[UI: Step 버튼 클릭]
   -> useEngineActions().step()
   -> SimulationEngine.step()
        -> performStep()  # §5.1
             action = pendingAction ?? algorithm.selectAction(env.getState(), agent, hp)
             { nextState, reward, done } = environment.step(action.action)
             transition = { state, action: action.action, nextState, reward, done }
             nextAction = algorithm.pickNextAction?.(nextState, agent, hp)   # SARSA만
             tdInfo = algorithm.computeUpdate(transition, agent, hp, nextAction)
             agent.applyUpdate(...)
             pendingAction = nextAction ?? null
        -> snapshot = buildSnapshot(engine internal state)   # envRenderModel/agentSnapshot 포함
        -> emit(snapshot)
   -> useSimulationEngine 훅이 재렌더 트리거
   -> GridSvg / InspectorPanel / StatsPanel이 새 snapshot을 그림 (previousEstimate ->
      updatedEstimate 차이를 InspectorPanel이 함께 표시)
```

### 6.2 환경 편집 흐름

```
[UI: EnvEditor에서 Wall 셀 클릭]
   -> EnvEditor 로컬 draft config 갱신 (아직 Engine에 미반영)
   -> [Apply 클릭]
   -> useEngineActions().applyEnvConfig(draftConfig)
   -> SimulationEngine.reset({ envConfig: draftConfig })   # §5.5 reset(overrides) 계약
        -> environment = createEnvironment(현재 envId, draftConfig)  # registry 조회
        -> algorithm.requiredAgentKind에 맞는 새 Agent 생성 (Q/V table 초기화)
        -> stats 전체 초기화, pendingAction = null
        -> emit(snapshot)
```

### 6.3 알고리즘/하이퍼파라미터 변경 흐름

```
[UI: AlgorithmSelector에서 SARSA 선택]
   -> useEngineActions().setAlgorithm("sarsa")
   -> SimulationEngine.reset({ algorithmId: "sarsa" })   # §5.5
        -> algorithm = createAlgorithm("sarsa")   # registry 조회
        -> algorithm.requiredAgentKind("Q")에 맞는 새 Agent 생성
        -> hyperparams = algorithm.hyperparamSchema의 default 값
        -> stats 전체 초기화, pendingAction = null
        -> emit(snapshot)
```

### 6.4 Run Episode(다중 Episode, 고속) 흐름

Run은 Phase 12에서 "현재 Episode 1개만 실행"으로 의미가 확정되었다(`engine.run({ episodes: 1 })`
고정). 아래의 다중 Episode 고속 실행 흐름은 Phase 15에서 UI가 추가된 **Run Episode**(Episode
수 입력, 기본값 1, 정수, [1, 200])에 해당한다.

```
[UI: Run Episode 클릭, episodes=100(사용자 입력), speed=max]
   -> engine.run({ episodes: 100 })
   -> Scheduler가 speed 설정에 따라 performStep()을 반복 실행 (§5.4)
        - 저속: setTimeout(performStep, interval), 매 스텝 emit
        - 고속: 프레임당 여러 performStep()을 동기 실행 후 requestAnimationFrame으로 양보,
          M 스텝마다 한 번만 emit(snapshot) (§5.3 불변식: performStep() 자체는 매 스텝 실행,
          emit만 배치)
        - Speed 전환 시 generation token으로 이전 스케줄의 지연 콜백을 무효화 (§5.4)
   -> 매 Episode 종료 시 stats 갱신, episode==100 도달 또는 pause() 호출 시 정지
```

---

## 7. 확장성 설계

### 7.1 새 Environment 추가 절차 (Simulation Engine 무수정)

1. `Environment` 인터페이스를 구현하는 클래스 작성 (`core/environments/<name>/...`).
2. `registry.ts`에 `registerEnvironment(id, factory, defaultConfig, editorSchema)` 등록.
3. `EnvSelector`, `EnvEditor`는 레지스트리를 순회해 자동으로 옵션/편집 폼을 노출
   (편집 가능한 설정 필드는 `editorSchema`로 선언적으로 기술해 UI가 하드코딩되지 않게 함).
4. Simulation Engine, Agent, Algorithm 코드는 변경하지 않는다
   (모두 `Environment` 인터페이스에만 의존).

### 7.2 새 Algorithm 추가 절차 (Simulation Engine 무수정)

1. `Algorithm` 인터페이스(`id`, `requiredAgentKind`, `hyperparamSchema`, `selectAction`,
   `pickNextAction?`, `computeUpdate`)를 구현(§4.3).
2. `algorithms/registry.ts`에 등록.
3. `AlgorithmSelector`, `HyperparamPanel`이 레지스트리(`hyperparamSchema`) 기반으로 자동 노출.
4. Simulation Engine은 `algorithm.selectAction/pickNextAction?/computeUpdate`만 호출하고
   `requiredAgentKind`에 따라 이미 정의된 `TabularQAgent`/`TabularValueAgent` 중 하나를
   생성하므로 무수정이다. 이 절차가 실제로 무수정으로 되는지는 SARSA 추가
   (ROADMAP Phase 8)가 완료 기준의 검증 게이트다.
- **TD(0)는 이 절차의 대상에서 현재 제외한다.** TD(0)는 "다른 알고리즘이 학습한 Q로부터
  유도한 정책을 평가"하는 기능까지 포함할 경우 다른 Algorithm의 산출물(Q-table)을
  참조해야 해서 "registry 등록만으로 독립적으로 추가 가능"이라는 전제 자체와 충돌한다
  (`DESIGN_REVIEW.md` §1 R3, §2 Q2 결함 B). §4.2/§4.3의 `ValueAgent`/`requiredAgentKind: "V"`
  구조는 TD(0)를 나중에 수용할 자리를 마련해 두는 것이며, TD(0) 자체의 설계/구현은
  Future로 격하한다(§11).

### 7.3 Custom Environment (사용자 정의)

- MVP 범위: GridWorld 하나의 config(Grid 크기, Wall, Start, Goal)를 UI(`EnvEditor`)로
  직접 편집하는 것까지만 지원한다(§11 MVP 범위 참고).
- Post-MVP: GridWorld config를 JSON으로 export/import 가능하게 해 "사용자가 만든 커스텀
  GridWorld"를 저장/공유할 수 있게 한다. 셀별 커스텀 Reward, 임의 Terminal 지정 편집
  UI도 이 단계에서 추가한다(`PRODUCT_SPEC.md` FR-8/FR-9/FR-11은 유효한 요구사항이며
  범위 밖으로 삭제하는 것이 아니라 구현 순서를 뒤로 미루는 것이다 — §11 참고).
- Future: 완전히 새로운 환경 로직(비-GridWorld) 추가는 위 7.1 절차를 따르는 새 코드
  기여로 처리한다(브라우저 내 스크립팅/샌드박스 실행은 범위 밖).

---

## 8. 상태 관리 원칙 (React 관점)

- `SimulationEngine`은 React와 무관한 싱글턴(또는 Provider로 주입되는 인스턴스) 클래스.
- React는 `useSyncExternalStore(engine.subscribe, engine.getSnapshot)`로 최신
  `EngineSnapshot`을 구독한다. 이렇게 하면:
  - Engine의 내부 루프(타이머 기반 고속 실행)가 React 렌더 사이클과 독립적으로 동작 가능.
  - 여러 컴포넌트(Grid, Inspector, Stats)가 동일한 snapshot을 일관되게 공유.
- 순수 UI 상태(선택된 State 하이라이트, 편집 모드 on/off, 폼 draft 값 등)는 일반 React
  state(또는 매우 가벼운 Context)로 별도 관리하고 Engine과 섞지 않는다.

---

## 9. 테스트 전략

- `core/environments`, `core/agents`, `core/algorithms`: Vitest 순수 단위 테스트
  (예: Q-Learning 업데이트 공식이 알려진 입력에 대해 정확한 TD Target/Error를 내는지,
  GridWorld의 경계/Wall/Terminal 처리가 규칙대로 동작하는지).
- `core/engine/SimulationEngine`: mock Environment/Agent/Algorithm으로 상태 머신
  전이(IDLE/RUNNING/PAUSED)와 이벤트 emit 타이밍을 테스트.
- `viz`, `ui`: 최초 버전은 스냅샷/렌더 테스트를 최소한으로 유지하고, 핵심 로직 검증은
  `core` 계층 테스트로 충분히 커버되도록 한다(React 컴포넌트는 얇게 유지).

---

## 10. 아키텍처 원칙 준수 체크리스트

- [ ] `core/**`는 `react`, `react-dom`을 import하지 않는다.
- [ ] `Environment`, `Agent`, `Algorithm`은 서로의 구체 구현이 아닌 인터페이스에 의존한다.
- [ ] `SimulationEngine`은 `TimerSource`로 주입된 타이밍 API 외 브라우저 전용 렌더링
  코드를 포함하지 않는다(§5.4 — Node/Vitest에서 fake timer로 단독 테스트 가능해야 함).
- [ ] `viz/**` 컴포넌트는 `EngineSnapshot`을 props로만 받고, 자체적으로 TD 계산을
  수행하지 않는다.
- [ ] 새 환경/알고리즘은 registry 등록만으로 UI에 노출된다(하드코딩된 switch문 지양).
- [ ] `Algorithm.id`/`TDInfo.algorithm`은 리터럴 유니온이 아니라 `string`이다(신규
  알고리즘 등록이 공용 타입 수정을 요구하지 않아야 함).
- [ ] SARSA류(`pickNextAction`을 구현한) 알고리즘에서 "TD Target 계산에 쓰인 a'"와
  "실제로 다음 스텝에 실행된 a'"가 항상 동일하다(`pendingAction` 재사용, §5.1).
- [ ] 고속 Run 중에도 `performStep()`(실제 RL 계산)은 매 스텝 수행되며, 배치되는 것은
  emit(snapshot)뿐이다(§5.3 불변식).
- [ ] `EngineSnapshot.envRenderModel`/`agentSnapshot`은 `unknown`이 아니라 판별
  유니온(`EnvRenderModel`/`AgentSnapshot`)이다.

---

## 11. MVP 범위 (아키텍처 관점)

> 이 섹션은 `docs/DESIGN_REVIEW.md` §4/§7의 MVP 재분류를 아키텍처 문서에 정리한 것이다.
> `PRODUCT_SPEC.md`의 FR 목록 자체를 축소하는 것이 아니라, **ROADMAP.md의 어느 Phase까지
> 완료되면 "완성된 v1"이라 부를 것인가**를 명확히 하는 것이다 — FR-8(셀별 Reward),
> FR-9(임의 Terminal), FR-11(JSON export/import)은 여전히 유효한 요구사항이며 §7.3에서
> Post-MVP로 구현 순서만 뒤로 미뤘다.

### MVP (ROADMAP Phase 0~7 완료 시점)

- 환경: GridWorld 1종. 편집은 Grid 크기 변경, Wall 배치/제거, Start/Goal 지정까지.
- 알고리즘: Q-Learning만 등록(`ActionValueAgent`/`TabularQAgent` 경로만 실제로 쓰인다).
- 제어: Step / Run / Run Episode / Pause / Resume / Reset / Speed.
- 관찰: Inspector(State/Action/Reward/NextState/TD Target/TD Error,
  `previousEstimate → updatedEstimate` 포함), 선택 State의 Q-value 막대그래프(현재 값만,
  스파크라인 이력 제외), Policy Overlay, Value Heatmap.
- 통계: Episode/Total Reward/Episode Length/Average Reward/Success Rate + Reward 곡선.
- JSON export/import는 MVP에서 **제외**.

### Post-MVP (ROADMAP Phase 8 및 그 이후 일부)

- SARSA 추가 — `pickNextAction`/`pendingAction` 구조(§5.1)가 실제로 Engine 무수정으로
  동작하는지 검증하는 단계.
- 셀별 커스텀 Reward, 임의 Terminal 지정 편집 UI(FR-8, FR-9).
- JSON export/import(FR-11).
- 선택 State의 Q-value 이력 스파크라인(§5.6 — UI 로컬 누적으로 구현, Engine 변경 없음).
- Cliff Walking / Frozen Lake 프리셋(동일 `GridWorldEnv`, config만 다름).

### Future (현재 설계/구현 범위 밖)

- **TD(0)** — 고정된 랜덤 정책 평가라는 가장 단순한 형태부터 시작하되, "다른 알고리즘이
  학습한 Q로부터 유도한 정책을 평가"하는 기능(`PRODUCT_SPEC.md` §4.3.1)은 별도 설계 검토
  없이 추가하지 않는다(§7.2, `DESIGN_REVIEW.md` §1 R3/R8).
- Multi-goal, 특수 Tile, 이동 비용, 확률적 이동, Wind/장애물 dynamics.
  (Trap/Bomb는 Phase 20에서 구현 완료 — `GridWorldConfig.bombs`/`bombPenalty`, 아래
  MVP 이후 섹션 참고.)
- Softmax/UCB 행동 선택 정책, λ(eligibility trace) 계열 알고리즘.
- Maze(비-사각 격자) 등 GridWorld와 위상 구조가 다른 환경.
- Web Worker 기반 오프로딩(NFR-2 대응, 실제 성능 문제가 관측되면 그때 도입).
