# DESIGN_REVIEW.md — PRE-PHASE 설계 검증

검토 대상: `PRODUCT_SPEC.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `LEGACY_ANALYSIS.md`
(이 리뷰를 위해 `LEGACY_ANALYSIS.md`를 신규 작성했음 — 기존에 누락되어 있었다.)

이 문서는 코드를 작성하지 않고 설계만 비판적으로 검증한 결과다.

---

## 0. 결론 요약 (먼저 제시)

**GO WITH CHANGES.**

전체 골격(계층 분리, registry 기반 확장, EngineSnapshot을 통한 단방향 데이터 흐름)은
타당하다. 그러나 **Algorithm/Agent abstraction이 SARSA와 TD(0)를 실제로 수용하지 못하는
설계 결함이 하나 있고(§2 Q2, Critical)**, 이 문제는 Phase 0~7(GridWorld+Q-Learning만
다루는 구간)에는 영향을 주지 않지만 **Phase 8(SARSA/TD(0) 추가)에서 반드시 재작업이
발생**한다. Phase 0을 시작하기 전에 Agent/Algorithm 인터페이스를 먼저 수정해두는 것이
Phase 8에서의 재작업 비용보다 훨씬 싸다. 그 외 항목은 대부분 문서 보완/타입 수정 수준이며
Phase 0 착수를 막지 않는다.

---

## 1. 요구사항 충돌 검사 (PRODUCT_SPEC.md)

| # | 문제 | 유형 | 심각도 |
|---|---|---|---|
| R1 | FR-13이 "필요 시 λ 등"을 하이퍼파라미터로 언급하지만, 지원 알고리즘(TD(0)/SARSA/Q-Learning)은 전부 1-step 방식이라 λ를 쓸 곳이 없다. 구현 방법 미정의 상태로 방치된 요구사항. | 미정의 요구사항 | Low |
| R2 | FR-9(Terminal 지정)가 FR-8(셀별 Reward)에 암묵적으로 의존하는데("이 Terminal 셀의 reward는 얼마인가") 의존관계가 명시되지 않음. | 명시 안 된 의존성 | Low |
| R3 | 4.3.1의 TD(0) 설명: "평가 대상 정책 선택 UI(랜덤 정책 / 현재까지 학습된 Q 기반 greedy 정책)"는 **다른 알고리즘(Q-Learning/SARSA)이 만든 Q-table을 TD(0)가 읽어야 함**을 뜻한다. 이는 "알고리즘은 서로 독립적으로 registry에 등록된다"는 NFR-4 전제와 충돌한다 — TD(0)가 다른 알고리즘의 산출물에 의존하면 registry 단독 등록만으로는 동작할 수 없다. | **요구사항 간 충돌** (NFR-4 vs TD(0) 세부 스펙) | **High** |
| R4 | FR-23(Speed/Step Interval)이 "ms 지연"과 "steps per animation frame"이라는 서로 다른 두 메커니즘을 하나의 슬라이더로 뭉뚱그려 설명하지만, 두 값 사이의 변환 규칙(threshold, 프리셋 등)이 정의되지 않음. | 구현 방법 미정의 | Medium |
| R5 | FR-25(고속 모드 배치 렌더링)와 FR-26~35(매 스텝 관찰 가능성) 사이에 실질적 긴장이 있음: 고속 Run 중에는 Inspector가 스킵된 스텝의 TD 정보를 보여줄 수 없는데, 이 경우 Inspector가 무엇을 표시해야 하는지 스펙에 없음. | 모호한 요구사항 / 미명시 상호작용 | Medium |
| R6 | FR-15(설정 변경 시 알림)와 시나리오 B(환경 편집은 draft+Apply+경고)가 서로 다른 UX 패턴(즉시 반영+알림 vs staged+명시적 확인)을 쓰는데, 이것이 의도적 구분인지 문서에 명확히 선언되어 있지 않음. | 모호함(내부 일관성) | Low |
| R7 | NFR-2("고속 다중 Episode 실행 시 탭이 멈추지 않아야 함")는 단일 스레드 JS에서 Web Worker 없이 완전히 보장하기 어려운 기술적으로 위험한 요구사항. ARCHITECTURE.md는 rAF 기반 청크 실행만 언급하고 Web Worker 대안은 Future로도 명시되어 있지 않음. | 기술적으로 위험 | Medium |
| R8 | 4.3.1의 TD(0)는 구조적으로 **Control(정책 개선) 알고리즘이 아니라 Prediction(정책 평가) 알고리즘**인데, PRODUCT_SPEC 전체가 "Agent가 학습하며 Policy가 개선된다"는 Control 중심 서술(FR-32~35, 시나리오 C/E/G)로 되어 있어 TD(0) 선택 시 이 서술들이 그대로 적용되지 않는다(Policy 개선이 없고, 주어진 정책을 평가만 함). MVP 관점에서 과도하게 복잡. | MVP에서 과도하게 복잡 | Medium-High |

**핵심 발견**: R3 + R8은 사실상 같은 근본 원인(TD(0)를 Q-Learning/SARSA와 동일한 취급으로
설계에 욱여넣음)에서 나온다. §5 "MVP 범위 검토"에서 TD(0) 범위 축소를 권고한다.

---

## 2. Architecture 검증

### Q1. `reset / step / getState / getAvailableActions / isTerminal`만으로 새 Environment 추가에 충분한가?

**아니오, 부족하다.** 현재 `ARCHITECTURE.md`의 `Environment` 인터페이스(`reset`, `step`,
`getConfig/setConfig`, `getRenderModel`)와 질문에서 제시된 5개 메서드 둘 다 개별적으로는
구멍이 있다.

- `isTerminal(state)`가 **`step()`의 반환값 `done`과 별개로 독립 조회 가능한 pure 함수로
  존재해야 한다.** 현재 설계는 `done`이 `step()` 호출 시점에만 알 수 있는데, 다음 용도에는
  상태만 주고 즉시 조회할 수 있는 `isTerminal(state)`가 필요하다:
  - Algorithm이 부트스트랩 여부를 판단할 때(터미널이면 `γ·max Q(s')` 항 생략, `LEGACY_ANALYSIS.md`
    §3에서 지적한 함정과 동일한 문제)
  - 렌더링에서 "이 셀은 terminal"을 표시할 때
  - TD(0)가 임의 상태에 대해 평가 정책을 물을 때
  - **수정안**: `step()`의 `done`은 `isTerminal(nextState)`와 항상 같아야 한다는 불변식을
    명시하고, `Environment`에 `isTerminal(state): boolean`을 별도 필수 메서드로 추가한다.
- `getAvailableActions()`는 상태별로 가변적인 action space를 암시하는데, 현재 GridWorld
  설계(및 대부분의 GridWorld류 환경)는 **action space를 고정(4방향)**으로 두고 벽/경계는
  "이동 실패 + 페널티"로 처리한다(§ `LEGACY_ANALYSIS.md` — 원본도 이 방식). 상태별 가변
  action space를 허용하면 `Agent`의 Q-table(`number[4]` 고정 크기 배열)과 `ε-greedy` 구현이
  모두 가변 길이를 다뤄야 해서 복잡도가 크게 증가한다.
  - **수정안**: MVP 범위에서는 `getActionSpace(): number`(환경 전체에 대해 고정, 상태 무관)만
    제공하고, 상태별 action masking은 Future로 명시적으로 미룬다.
- 두 인터페이스 모두 `getRenderModel()`(또는 이에 준하는 시각화용 데이터)이 빠져 있다.
  Grid/Wall/Start/Goal 좌표 없이는 `GridSvg`가 그릴 수 없다.
  - **수정안**: `Environment`에 `getRenderModel(): EnvRenderModel`을 유지하되, 반환 타입을
    `unknown`이 아니라 판별 유니온(discriminated union)으로 명시한다(§3 타입 검증 참고).

**결론**: 제시된 5개 메서드 + 기존 설계를 합쳐 다음으로 확정 권고:
`reset(): State`, `step(action): StepResult`, `getState(): State`,
`getActionSpace(): number`, `isTerminal(state): boolean`, `getRenderModel(): EnvRenderModel`.

### Q2. TD(0), SARSA, Q-Learning이 동일한 Algorithm abstraction으로 표현 가능한가?

**아니오. 표현 불가능하며, 현재 설계 그대로는 두 가지 실제 결함이 있다.** 이 항목이
이 리뷰에서 가장 심각한 발견이다.

**결함 A — SARSA의 next-action 재사용 문제 (Critical, 정확성 버그)**

SARSA의 TD Target은 `r + γ·Q(s', a')`이며, 여기서 `a'`는 **다음 실제 스텝에서 진짜로
실행될 행동**이어야 한다(on-policy 정의 그 자체). 그런데 현재 Engine 루프(ARCHITECTURE.md §6.1)는
매 스텝마다 `agent.selectAction(state)`를 새로 호출한다. SARSA의 `computeUpdate`가 target을
계산하기 위해 내부적으로 `agent.selectAction(nextState)`를 호출해 `a'`를 얻더라도,
**그 다음 실제 Engine 스텝이 다시 `selectAction(nextState)`를 독립적으로 호출**하면
ε-greedy의 무작위성 때문에 두 호출 결과가 다를 수 있다. 이 경우 "TD Target 계산에 쓰인 a'"와
"실제로 실행된 a'"가 어긋나 SARSA가 더 이상 SARSA가 아니게 된다(표시되는 TD Target도 실제
학습과 불일치 — 교육적 신뢰성 문제까지 이어짐).

- **수정안**: Engine 루프를 SARS**A** 5-tuple을 다루도록 바꾼다. 즉 "다음 행동을 미리
  선택해 캐시해두고, 다음 스텝에서 새로 선택하지 않고 캐시된 행동을 그대로 사용"하는 구조로
  변경한다. 구체적으로 `Algorithm`에 선택적 메서드
  `pickNextAction?(nextState, agent): ActionSelection`을 추가하고, Engine은 각 스텝에서
  `pendingAction`을 들고 다닌다:
  1. 첫 스텝: `action = agent 기본 정책으로 선택`
  2. `env.step(action)` → `transition`
  3. `algorithm.pickNextAction`이 있으면 `nextAction = algorithm.pickNextAction(nextState, agent)` 호출,
     없으면(Q-Learning) 다음 스텝에서 새로 선택
  4. `algorithm.computeUpdate(transition, agent, nextAction?)`
  5. 다음 스텝의 `action`은 3에서 캐시한 `nextAction`을 재사용(SARSA), 또는 새로 선택(Q-Learning)
- 이 변경은 Q-Learning/TD(0)에는 영향이 없다(둘 다 next-action을 target 계산에 쓰지 않음).

**결함 B — TD(0)는 Q-table이 아니라 V-table을 다룬다 (Critical, 타입 불일치)**

`TabularAgent`는 `Map<StateKey, number[]>` (Q-table, 행동별 4개 값)로 설계되어 있다.
TD(0)는 상태 가치 `V(s)` 하나만 다루는 **prediction 알고리즘**이라 `number` 하나짜리
테이블이 필요하다. 현재 단일 `Agent` 타입으로는 이 둘을 동시에 만족할 수 없다.

- **수정안**: `Agent`를 `ValueAgent`(V-table, `getValue(state): number`)와
  `ActionValueAgent`(Q-table, `getValue(state, action): number`, `getQVector(state): number[]`)로
  분리하거나, 공통 베이스 위에 두 구현체를 둔다. `Algorithm`은
  `requiredAgentKind: "V" | "Q"`를 선언하고, Engine/registry는 알고리즘 전환 시 이 선언에
  맞는 Agent를 새로 생성한다(§6.2 `reset()` 흐름에 반영).
- 부수적으로, TD(0)는 ε-greedy로 "행동을 선택"하는 게 아니라 **주어진 고정 정책을
  따라간다**. 즉 "행동 선택 정책"이 Agent가 아니라 **Algorithm이 소유**해야 한다.
  - **수정안**: `Algorithm.selectAction(state, agent, hyperparams): ActionSelection`을
    Algorithm 인터페이스의 필수 메서드로 승격한다(현재는 정책이 `Agent`/`policies/`에
    있어 Q-Learning/SARSA는 ε-greedy를 공유하지만 TD(0)는 다른 정책이 필요함을
    표현할 수 없었다). ε-greedy는 여전히 `core/agents/policies/epsilonGreedy.ts`에
    순수 함수로 두고, Q-Learning/SARSA의 `Algorithm` 구현이 이를 호출하는 방식으로
    재사용하면 중복 없이 해결된다.

**결론**: Algorithm abstraction을 다음과 같이 수정해야 한다.

```ts
interface Algorithm {
  id: string;
  requiredAgentKind: "V" | "Q";
  selectAction(state: StateKey, agent: Agent, hp: Hyperparams): ActionSelection;
  computeUpdate(
    transition: Transition,
    agent: Agent,
    hp: Hyperparams,
    nextAction?: ActionSelection // SARSA류에서만 사용
  ): TDInfo;
  pickNextAction?(nextState: StateKey, agent: Agent, hp: Hyperparams): ActionSelection;
}
```

이 수정은 Phase 1(Q-Learning만 구현)에는 영향이 미미하지만(어차피 `selectAction`을
Algorithm에 두는 것으로 시작하면 됨), **Phase 8에서 인터페이스를 갈아엎는 것보다 Phase 0
설계 단계에서 이 형태로 확정하는 것이 훨씬 저렴**하다. 그래서 Phase 0 착수 전 수정 항목으로
분류한다(§4).

### Q3. Simulation Engine이 React 없이 독립 실행 가능한가?

대체로 **가능**하다(클래스 기반, `react`/`react-dom` import 없음). 다만 `Scheduler`가
`requestAnimationFrame`을 쓰는데 이는 브라우저 전용 API이고 Node(Vitest) 환경에는 없다.
ROADMAP.md Phase 2에는 "주입 가능하게 설계"라고 언급되어 있지만, 이는 **ARCHITECTURE.md
본문에 정식으로 명시되어야 할 구조적 계약**이지 로드맵 각주로 남겨둘 내용이 아니다.

- **수정안**: `Scheduler` 생성자가 `{ now, setTimeout, clearTimeout, requestAnimationFrame }`
  형태의 `TimerSource`를 주입받고, 기본값은 전역 `window`/`globalThis` API를 쓰도록
  ARCHITECTURE.md §5에 타입으로 명시한다.

### Q4. Step 실행과 Auto Run이 동일한 Engine API로 처리 가능한가?

가능하나, 현재 문서에는 암묵적으로만 그렇다. 내부적으로 `_performStep()` 같은 공유
프리미티브를 명시적으로 두고, `step()`은 이를 1회 호출 후 항상 snapshot을 emit,
`run()`/`runEpisode()`는 Scheduler를 통해 이를 반복 호출하며 조건부로 emit하는
구조임을 ARCHITECTURE.md에 명문화할 것을 권고한다(경미한 문서 보완, 재설계 아님).

### Q5. 고속 학습 중 렌더링 빈도를 낮춰도 학습 결과가 정확히 유지되는가?

구조적으로는 그렇다(스냅샷 emit과 실제 `env.step`/`algorithm.computeUpdate`/
`agent.applyUpdate` 실행은 분리되어 있어야 한다). **그러나 이 불변식이 ARCHITECTURE.md에
명시적으로 선언되어 있지 않다** — "M 스텝마다 emit"이라고만 되어 있어서, 구현자가
실수로 "M 스텝 중 1번만 실제로 계산"하는 최적화를 시도할 위험이 있다.

- **수정안**: ARCHITECTURE.md §5.1에 다음 불변식을 명문화: "렌더링/구독자 통지 빈도는
  프레젠테이션 레이어의 관심사이며, 실제 RL 계산(스텝 실행, Q/V 갱신, 통계 누적)은
  항상 매 스텝 1회씩 수행되어야 한다. 어떤 최적화도 이 불변식을 깨서는 안 된다."

### Q6. 실행 중 Speed 변경 시 Simulation state가 깨지지 않는가?

구조적으로는 Speed가 상태 머신과 분리되어 있어 안전해야 하지만, **저속(`setTimeout`
기반) → 고속(`rAF` 기반) 전환 시 이미 큐에 들어간 콜백을 취소하지 못해 스텝이 중복
실행되거나 두 스케줄러가 동시에 도는 race condition 위험**이 있다. 이는 현재
ARCHITECTURE.md/ROADMAP.md 어디에도 명시적으로 다뤄지지 않은 기술적 위험이다.

- **수정안**: `Scheduler`에 세대 토큰(generation counter)을 두어, 속도 전환 시 이전
  스케줄링 루프의 콜백이 실행되더라도 "내가 아직 유효한 세대인가"를 검사 후 무효면
  즉시 반환하도록 한다. Phase 2 완료 기준에 "Speed를 RUNNING 중 반복적으로 빠르게
  전환해도 스텝이 중복/누락되지 않는다"는 테스트를 추가할 것을 권고한다.

### Q7. Environment 변경 시 Agent/Algorithm/Statistics의 lifecycle이 명확한가?

대체로 명확하지만(§6.2에서 env 교체 시 agent/stats 재생성), **`reset()`의 시그니처가
"환경 교체"와 "같은 환경의 config 갱신"과 "알고리즘 교체"를 전부 하나의 느슨한
`config?` 인자로 뭉뚱그리고 있어 계약이 불명확**하다.

- **수정안**: `engine.reset(overrides?: { envId?, envConfig?, algorithmId?, hyperparams? })`로
  시그니처를 명시하고, "어떤 필드가 바뀌든 관계없이 Agent 전체 재생성 + 통계 전체 초기화"를
  단일 정책으로 ARCHITECTURE.md에 문장으로 못박는다(부분 초기화 금지 — 가장 단순하고
  버그 위험이 적은 정책).

---

## 3. Type 검증

| 발견 | 심각도 |
|---|---|
| `TDInfo.algorithm`이 `"q-learning" \| "sarsa" \| "td0"` 리터럴 유니온으로 하드코딩되어 있다. 새 알고리즘을 registry에 등록하는 것만으로 확장 가능해야 한다는 NFR-4와 정면으로 충돌 — 새 알고리즘 추가 시 이 공용 타입을 수정해야 한다. **수정안**: `algorithm: string`(registry id)로 완화. | Medium |
| `EngineSnapshot.envRenderModel: unknown`, `agentSnapshot: unknown` — Visualization 레이어가 타입 안전하게 그릴 수 없고 매번 캐스팅이 필요하다. **수정안**: `EnvRenderModel`을 `{ kind: "grid"; width; height; walls; start; goal; agentPos; cellRewards? }` 형태의 판별 유니온으로, `AgentSnapshot`을 `{ kind: "Q"; qTable: Record<StateKey, number[]> } \| { kind: "V"; vTable: Record<StateKey, number> }`로 구체화(Q2의 Agent 분리와 직결). | Medium |
| `StepResult`(`{nextState, reward, done}`)와 `Transition`(`{state, action, reward, nextState, done}`)이 필드가 중복 정의될 위험 — 두 타입이 각자 따로 선언되면 드리프트 가능. **수정안**: `Transition = { state: StateKey; action: number } & StepResult`로 합성. | Low |
| `EnvironmentDefinition`(레지스트리에 등록되는 "환경의 종류": id/factory/defaultConfig/editorSchema)과 `Environment`(런타임 인스턴스)가 문서상 구분되지 않고 섞여 쓰인다. **수정안**: 두 타입을 명시적으로 분리 명명. | Low |
| 순환 의존성 자체는 발견되지 않음 — `core/types`가 leaf이고 `environments/agents/algorithms`가 그 위에서만 의존하는 단방향 구조이기 때문에 타입 레벨 circular import는 구조적으로 방지되어 있다. | 없음(양호) |
| `HyperparamPanel`이 참조할 "하이퍼파라미터 스키마" 타입이 ARCHITECTURE.md 어디에도 정식 타입으로 정의되어 있지 않다(ROADMAP Phase 8에서 문장으로만 언급). **수정안**: `HyperparamSchema = { key: string; label: string; type: "number"|"range"; min?; max?; step?; default: number }[]`를 Algorithm 등록 시 필수로 첨부하는 타입으로 ARCHITECTURE.md §4에 추가. | Medium |

---

## 4. MVP 범위 재분류

기존 Phase 0~9는 "구현 순서"로는 합리적이지만, "무엇이 MVP인가"가 명시적으로
구분되어 있지 않았다. 아래와 같이 재분류를 권고한다.

### MVP (v1로 부를 수 있는 최소 완성)
- 환경: **GridWorld 1종만**, 편집 기능은 **Wall 배치/제거, Start/Goal 지정, Grid 크기 변경**까지만
  (셀별 커스텀 Reward·임의 Terminal 지정은 Post-MVP로 연기 — FR-8/FR-9 범위 축소).
- 알고리즘: **Q-Learning만** (레퍼런스가 있어 검증 가능, 이미 §2 Q2 수정 이후의
  Algorithm 인터페이스로 구현하되 다른 알고리즘은 아직 등록하지 않음).
- 제어: Step / Run / Run Episode / Pause / Resume / Reset / Speed 조절.
- 관찰: Inspector(State/Action/Reward/NextState/TD Target/TD Error, 수식 포함),
  선택 State의 Q-value 막대그래프(현재 값만, 스파크라인 이력 제외),
  Policy Overlay(화살표), Value Heatmap.
- 통계: Episode/Total Reward/Episode Length/Average Reward/Success Rate + 기본 Reward 곡선.
- JSON export/import는 **제외**(Post-MVP).

### Post-MVP (MVP 직후 추가)
- SARSA 추가 (§2 Q2 수정안 적용 후 registry 등록만으로 가능해야 함 — 이게 되는지가
  아키텍처 검증 게이트).
- 셀별 커스텀 Reward, 임의 Terminal 지정 편집 UI.
- 선택 State의 Q-value 이력 스파크라인(§5에서 제안하는 "클라이언트 로컬 누적" 경량 구현으로).
- JSON export/import.
- Cliff Walking / Frozen Lake 프리셋(동일 GridWorldEnv, config만 다름).

### Future (지금 설계/구현 불필요)
- **TD(0) — 임의 정책(특히 "다른 알고리즘의 학습된 Q 기반 정책") 평가 기능**은
  §1 R3/R8, §2 Q2의 근본적 복잡도 때문에 Future로 명확히 격하할 것을 권고한다.
  TD(0)를 나중에 넣더라도 "고정된 랜덤 정책 평가"라는 가장 단순한 형태로 시작하고,
  "다른 알고리즘의 Q-table을 읽어와 평가"하는 기능은 별도 설계 검토 후에만 추가한다.
- Trap, Multi-goal, 특수 Tile, 이동 비용, 확률적 이동, Wind/장애물 dynamics.
- Softmax/UCB 행동 선택 정책, λ(eligibility trace) 계열 알고리즘.
- Maze(비-사각 격자) 등 GridWorld와 위상 구조가 다른 환경.
- Web Worker 기반 오프로딩(R7 대응, 실제 성능 문제가 관측되면 그때 도입).
- 접근성 심화, 다국어, 계정/서버 연동.

---

## 5. 핵심 사용자 경험 흐름 검증

```
Environment 선택 → 환경 편집 → Algorithm 선택 → Hyperparameter 설정 → Step
→ State/Action/Reward/TD Update/Q-value/Policy 확인 → Run → Pause → Speed 변경 → 결과 확인
```

전체 흐름이 완전히 끊기는 지점은 없다. 다만 두 개의 **약한 연결(soft gap)**을 발견했다:

1. **Q-value 변화 확인 (§FR-32, 시나리오 G)** — PRODUCT_SPEC은 "스파크라인으로 최근 N개
   갱신 이력"을 요구하지만, ARCHITECTURE.md의 `EngineSnapshot`에는 이력을 저장하는 필드가
   없다. 이 상태로 Phase 4를 구현하면 스펙과 어긋난다.
   - **수정안**: Engine에 이력 버퍼를 추가하지 않는다(모든 상태에 대해 이력을 쌓으면
     메모리가 grid 크기에 비례해 무한히 증가). 대신 **UI 레이어에서** "현재 선택된 State"에
     대해서만 연속된 `EngineSnapshot`을 관찰하며 클라이언트 로컬로 최근 N개 값을 누적하는
     방식으로 구현한다(Engine/타입 변경 불필요, Post-MVP 항목으로 재분류 — §4 참고).
2. **"왜 Q-value가 바뀌었는가"의 닫힌 설명** — 현재 `TDInfo`는 `target`, `error`만 있고
   실제 갱신 전/후 값(`previousEstimate → updatedEstimate`, 또는 `delta = α·error`)이
   없어 "TD Error가 X였고 그래서 Q가 Y만큼 바뀌었다"를 화면에서 한 번에 보여줄 수 없다.
   이는 이 프로젝트의 핵심 교육 목표(§6)와 직결되므로 **MVP에 포함**해야 한다.
   - **수정안**: `TDInfo`에 `previousEstimate: number`, `updatedEstimate: number`
     (또는 `delta: number`) 필드를 추가한다. 계산 비용이 거의 없으므로 Phase 1에서
     바로 반영 가능.

3부(Algorithm 선택)는 MVP 단계에서 옵션이 1개(Q-Learning)뿐이라 사실상 셀렉터가
무의미하지만, 이는 "끊김"이 아니라 "아직 다양성이 없을 뿐"이므로 문제로 취급하지 않는다.
단, `AlgorithmSelector`는 옵션이 1개일 때도 정상 렌더링되어야 함을 구현 시 유의.

---

## 6. 교육적 가치 검토

| 관찰 대상 | 현재 설계로 충분한가 | 비고 |
|---|---|---|
| State / Action / Reward / Next State | 충분 | `Transition` + `InspectorPanel` |
| TD Target (수식 대입 표시) | 충분 | `targetFormula` 문자열 필드가 핵심 강점 |
| TD Error | 충분 | `TDInfo.error` |
| **Value/Q-value가 "왜" 바뀌었는가** | **불충분 — 수정 필요** | §5 항목 2와 동일. `previousEstimate`/`updatedEstimate`(또는 `delta`) 추가 필요 |
| Policy 변화 | 충분(실시간 재렌더로 관찰 가능) | 별도 이력 추적 없이도 "관찰"은 가능. 이력/diff 강조는 Post-MVP 성격 |
| "왜 그 Action을 선택했는가" | 충분 | `ActionSelection.wasExploration` + `candidateValues` |

**결론**: 교육적 목표 달성에 필요한 수정은 §5에서 이미 제시한 `TDInfo` 필드 추가
하나로 충분하다. 이는 작고 저렴한 수정이며 Phase 1 범위에서 바로 반영해야 한다.

---

## 7. 발견 사항 종합 (심각도별)

### Critical (Phase 0 착수 전 설계 수정 필요)
1. **SARSA next-action 재사용 문제** — Engine 루프가 SARSA의 on-policy 정의를 깨뜨릴 수
   있는 정확성 버그. Algorithm 인터페이스에 `pickNextAction`/캐시된 action 재사용 구조를
   반영해야 한다. (§2 Q2 결함 A)
2. **Agent가 Q-table 전용으로 고정되어 TD(0)의 V-table을 표현 못 함** — Agent를
   `ValueAgent`/`ActionValueAgent`로 분리하고 Algorithm이 `requiredAgentKind`를 선언하도록
   수정해야 한다. (§2 Q2 결함 B)
3. **TD(0)의 "다른 알고리즘 Q 기반 정책 평가" 요구사항이 NFR-4(registry 단독 등록 확장성)와
   충돌** — 이 요구사항 자체를 Future로 격하하고 MVP/Post-MVP 범위에서 제거. (§1 R3, §4)

### High
4. Environment 인터페이스에 `isTerminal(state)` pure query 메서드 부재 — 부트스트랩 처리,
   렌더링, 향후 TD(0) 모두에 필요. (§2 Q1)

### Medium
5. `TDInfo.algorithm` 리터럴 유니온 하드코딩 — registry 확장성과 충돌. `string`으로 완화. (§3)
6. `EngineSnapshot`의 `unknown` 타입들 — `EnvRenderModel`/`AgentSnapshot` 판별 유니온으로 구체화. (§3)
7. `TDInfo`에 `previousEstimate`/`updatedEstimate`(delta) 필드 부재 — 교육적 핵심 갭. (§5, §6)
8. Speed 저속↔고속 전환 시 스케줄러 race condition 가능성 — generation token 필요. (§2 Q6)
9. "렌더링 빈도 ≠ 계산 빈도" 불변식이 문서에 명문화되어 있지 않음. (§2 Q5)
10. `reset()` 시그니처가 느슨해 env/algorithm 교체 시 계약이 불명확. (§2 Q7)
11. HyperparamSchema 타입 미정의. (§3)
12. FR-25 고속 모드에서 Inspector가 무엇을 보여줄지 미정의. (§1 R5)
13. NFR-2(탭 안 멈춤)가 Web Worker 없이 완전 보장되기 어려운 기술적 위험. (§1 R7)

### Low
14. `getAvailableActions`류 상태별 가변 action space는 MVP에서 불필요 — 고정
    `getActionSpace()`로 단순화. (§2 Q1)
15. `StepResult`/`Transition` 필드 중복 정의 위험 — 합성으로 정리. (§3)
16. `EnvironmentDefinition`/`Environment` 명명 미분리. (§3)
17. FR-13의 λ 언급, FR-9/FR-8 의존관계 미명시, FR-15/시나리오 B UX 패턴 불일치 등
    문서 정합성 수준의 사소한 항목들. (§1 R1, R2, R6)

---

## 8. Architecture 수정안 (요약, 반영 위치: ARCHITECTURE.md)

```ts
// Environment — Q1 반영
interface Environment {
  reset(): StateKey;
  step(action: number): StepResult;
  getState(): StateKey;
  getActionSpace(): number;         // 고정, 상태 무관 (MVP)
  isTerminal(state: StateKey): boolean; // step()의 done과 항상 일치해야 함(불변식)
  getRenderModel(): EnvRenderModel;   // 판별 유니온
  getConfig(): unknown;               // 환경별 config (편집 UI용)
  setConfig(config: unknown): void;
}

// Agent — Q2 결함 B 반영
interface ValueAgent {
  kind: "V";
  getValue(state: StateKey): number;
  applyUpdate(state: StateKey, tdInfo: TDInfo): void;
  reset(): void;
}
interface ActionValueAgent {
  kind: "Q";
  getQVector(state: StateKey): number[];
  getValue(state: StateKey, action: number): number;
  applyUpdate(state: StateKey, action: number, tdInfo: TDInfo): void;
  reset(): void;
}
type Agent = ValueAgent | ActionValueAgent;

// Algorithm — Q2 결함 A, B 반영
interface Algorithm {
  id: string;                          // registry key, 리터럴 유니온 금지
  requiredAgentKind: "V" | "Q";
  hyperparamSchema: HyperparamSchema;
  selectAction(state: StateKey, agent: Agent, hp: Hyperparams): ActionSelection;
  pickNextAction?(nextState: StateKey, agent: Agent, hp: Hyperparams): ActionSelection;
  computeUpdate(
    transition: Transition,
    agent: Agent,
    hp: Hyperparams,
    nextAction?: ActionSelection
  ): TDInfo;
}

// TDInfo — §5, §6 반영
interface TDInfo {
  algorithm: string;          // registry id, 리터럴 유니온 아님
  target: number;
  targetFormula: string;
  previousEstimate: number;   // 신규
  updatedEstimate: number;    // 신규 (= previousEstimate + alpha * error)
  error: number;
}
```

Engine 루프(§6.1 재정의):

```
pendingAction ??= algorithm.selectAction(engine.currentState, agent, hp)
transition = env.step(pendingAction.action)
nextAction = algorithm.pickNextAction?.(transition.nextState, agent, hp)
tdInfo = algorithm.computeUpdate(transition, agent, hp, nextAction)
agent.applyUpdate(...)
pendingAction = nextAction ?? algorithm.selectAction(transition.nextState, agent, hp)
emit(snapshot)   // 계산은 항상 매 스텝, emit만 배치 가능(§2 Q5 불변식)
```

`reset(overrides?: { envId?; envConfig?; algorithmId?; hyperparams? })`은 어떤 필드가
바뀌든 Agent 전체 재생성 + 통계 전체 초기화를 수행한다(§2 Q7).

---

## 9. 최종 권장 개발 순서

기존 ROADMAP.md의 Phase 순서 자체(0→9)는 유지하되, 다음을 반영해 조정한다.

1. **Phase 0**은 변경 없음.
2. **Phase 1 착수 전**, §8의 수정된 `Environment`/`Agent`/`Algorithm`/`TDInfo` 인터페이스를
   ARCHITECTURE.md에 먼저 반영한다(문서 수정, 코드는 아직 아님 — 이 리뷰의 산출물로 처리).
3. **Phase 1**: GridWorld + Q-Learning 구현은 기존 계획대로 진행하되, `Algorithm` 구현체가
   처음부터 `selectAction`/`requiredAgentKind: "Q"`/`hyperparamSchema`를 갖추도록 한다
   (나중에 인터페이스를 확장하는 대신 처음부터 맞는 형태로 구현 — 재작업 방지).
   `TDInfo`에 `previousEstimate`/`updatedEstimate` 포함.
4. **Phase 2**: Scheduler에 `TimerSource` 주입 구조(Q3)와 generation token(Q6)을
   설계 단계부터 포함. "계산은 매 스텝, emit은 배치"(Q5) 불변식을 테스트로 고정.
5. **Phase 3~7**: 기존 계획 유지하되, §4에서 정한 MVP 범위(셀별 Reward·임의 Terminal
   편집은 Post-MVP)에 맞춰 Phase 7(Env Editor)의 범위를 축소한다. Q-value 스파크라인은
   Phase 4에서 제외하고 Post-MVP로 이동(§5).
6. **Phase 8(SARSA/TD(0))**: SARSA만 우선 구현하고, "Simulation Engine을 수정하지 않고
   추가 가능한가"를 완료 기준으로 유지(§8 수정안이 맞다면 이 게이트를 통과해야 정상).
   TD(0)는 이 Phase에서 제외하고 Future로 명확히 재분류(§4, §7 Critical #3).
7. **Phase 9**: 기존 계획 유지.

이렇게 하면 "MVP로 부를 수 있는 지점"은 **Phase 7 완료 시점**(GridWorld+Q-Learning
기준의 완전한 관찰/편집/제어 경험)이 되고, SARSA는 Post-MVP(Phase 8 일부), TD(0)와
그 외 항목은 Future로 명확히 분리된다.

---

## 10. 최종 판정

**GO WITH CHANGES**

- Phase 0(부트스트랩)은 지금 바로 시작해도 무방하다(영향 없음).
- **Phase 1 코드를 작성하기 전에** §8의 Environment/Agent/Algorithm/TDInfo 인터페이스
  수정안을 `ARCHITECTURE.md`에 반영해야 한다 — 이 수정 없이 Phase 1~7을 구현하면
  Phase 8(SARSA 추가)에서 Agent/Algorithm/Engine 루프를 갈아엎어야 하며, 이는
  "새 알고리즘은 registry 등록만으로 추가 가능해야 한다"는 NFR-4 자체를 검증할 수
  없게 만든다.
- BLOCKED는 아니다 — 발견된 문제들은 전면 재설계가 아니라 **인터페이스 시그니처 확장과
  타입 정리** 수준이며, 이미 Phase 0~9의 전체 골격(계층 분리, registry, EngineSnapshot
  단방향 흐름)은 유효하다.
