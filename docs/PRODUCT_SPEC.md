# PRODUCT_SPEC.md — RL Playground

## 1. 개요

RL Playground는 브라우저에서 강화학습(RL)의 내부 동작을 **직접 조작하며 눈으로 관찰**할 수 있는
인터랙티브 학습 도구다. 사용자는 환경을 선택/편집하고, 알고리즘과 하이퍼파라미터를 설정하고,
Step 단위로 학습을 진행시키면서 State/Action/Reward/TD Target/TD Error/Value/Policy가
실시간으로 어떻게 변하는지 확인할 수 있다.

이 문서는 실제 개발 기준이 되는 **기능 명세**와 **사용자 시나리오**를 정의한다.
구현 방법(모듈 구조 등)은 `ARCHITECTURE.md`, 개발 순서는 `ROADMAP.md`를 참고한다.

### 1.1 참고 프로젝트 (Reference-only)

- https://github.com/oyueo-mm/Reinforcement_Learning_Practice-
- 확인 결과: `TD/` 폴더에는 **Q-Learning만 구현**되어 있음 (7×7 GridWorld, ε-greedy,
  Q-table은 `dict[state] -> np.array(4)`, lr=0.1, γ=0.9, ε 1.0→0.01 decay 0.995).
  SARSA, TD(0)는 기존 저장소에 존재하지 않는다.
- 이 프로젝트에서는 위 저장소를 **수정하지 않으며**, GridWorld 환경 구조와 Q-Learning
  업데이트 규칙만 참고용으로 재구현한다. SARSA / TD(0)는 동일한 아키텍처 패턴을 따라
  신규로 구현한다.

---

## 2. 목표 사용자와 핵심 가치

- **대상**: 강화학습을 처음 배우는 학생, RL 개념(TD Target/TD Error/Policy 수렴 등)을
  직관적으로 이해하고 싶은 개발자/교육자.
- **핵심 가치**: "코드를 읽지 않고 화면만 보고" 아래 질문에 답할 수 있어야 한다.
  - Agent는 현재 어떤 State에 있는가?
  - 어떤 Action을 선택했는가? 왜 그 Action을 선택했는가?
  - Reward는 얼마인가? Next State는 무엇인가?
  - TD Target은 어떻게 계산되었는가? TD Error는 얼마인가?
  - Value/Q-value가 왜 바뀌었는가?
  - 학습이 진행되며 Policy가 어떻게 변했는가?

---

## 3. 사용자 시나리오 (User Scenarios)

### 시나리오 A — 처음 방문한 사용자가 GridWorld를 탐색한다

1. 사용자가 사이트에 접속하면 기본 환경(7×7 GridWorld, 기본 Start/Goal/Wall 배치)이
   즉시 렌더링되어 있다. 별도 설정 없이 바로 "Step" 버튼을 눌러볼 수 있다.
2. 사용자가 "Step" 버튼을 누르면 Agent가 한 칸 이동하고, 우측 Inspector 패널에
   `State: (0,0) → Action: RIGHT → Reward: -0.1 → Next State: (1,0)`가 표시된다.
3. 같은 패널에 `TD Target = r + γ·max Q(s',·) = -0.1 + 0.9×0 = -0.1`,
   `TD Error = TD Target - Q(s,a) = -0.1 - 0 = -0.1` 수식이 실제 대입된 숫자와 함께 표시된다.
4. 그리드 위 현재 칸에는 갱신된 Q-value(또는 화살표로 표시된 Policy)가 즉시 반영된다.

### 시나리오 B — 환경을 직접 편집한다

1. 사용자가 "Edit Environment" 모드로 전환한다.
2. Grid 크기를 5×5 → 10×10으로 변경한다. 그리드가 다시 그려진다.
3. 특정 셀을 클릭해 Wall을 배치/제거한다. 클릭할 때마다 Empty → Wall → Empty로 토글된다.
4. 다른 셀을 우클릭(또는 모드 전환 버튼)해 Start 위치를, 또 다른 셀을 Goal로 지정한다.
5. 특정 셀을 선택해 Reward 값(기본 step reward, terminal reward 등)과
   Terminal 여부를 지정한다.
6. "Apply"를 누르면 현재 학습 세션이 초기화되고 새 환경 설정으로 시뮬레이션이 재시작된다.
   (편집 중에는 기존 Q-table/통계가 사라진다는 경고를 표시한다.)

### 시나리오 C — 알고리즘과 하이퍼파라미터를 바꿔가며 비교한다

1. 사용자가 Algorithm 드롭다운에서 "Q-Learning" → "SARSA"로 변경한다.
2. Hyperparameter 패널에서 Learning Rate(α), Discount Factor(γ), ε(초기값/최소값/감쇠율)를
   슬라이더 또는 숫자 입력으로 조정한다.
3. 알고리즘/하이퍼파라미터를 바꾸면 현재 학습 상태(Q-table, Episode 카운트)는 초기화되며,
   사용자에게 "설정 변경 시 학습이 리셋됩니다" 안내가 표시된다.
4. "Reset & Run"을 눌러 새 설정으로 처음부터 여러 Episode를 실행하고, Reward 곡선이
   알고리즘/하이퍼파라미터에 따라 다르게 수렴하는 것을 비교한다.

### 시나리오 D — 학습을 느리게 돌려서 한 스텝씩 관찰한다

1. 사용자가 Speed 슬라이더를 가장 느리게(예: 1 step / 2초) 설정한다.
2. "Run"을 누르면 Agent가 2초에 한 칸씩 이동하며, 매 스텝마다 Inspector 패널의
   State/Action/Reward/TD Target/TD Error가 갱신된다.
3. 사용자가 "Pause"를 누르면 다음 스텝 실행 전에 즉시 멈춘다. 화면의 모든 정보(현재 State,
   마지막 TD 계산 결과 등)는 멈춘 시점 그대로 유지된다.
4. "Resume"을 누르면 멈춘 지점부터 이어서 실행된다(에피소드/Q-table 상태 보존).
5. 사용자가 Speed를 다시 가장 빠르게 바꾸면, 실행 중이던 학습을 중단하지 않고
   다음 스텝부터 즉시 빠른 속도로 전환된다.

### 시나리오 E — 여러 Episode를 빠르게 돌려 수렴을 관찰한다

1. 사용자가 Episode 수를 500으로 설정하고 Speed를 최고 속도로 설정한다.
2. "Run"을 누르면 화면 렌더링을 매 스텝마다 하지 않고(빠른 모드에서는 배치/스킵 렌더링)
   Statistics 패널의 Reward 곡선, Success Rate, Average Episode Length가 실시간으로 갱신된다.
3. 실행 도중 언제든 "Pause"를 눌러 현재 Episode 중간 상태에서 멈출 수 있고,
   Policy Heatmap(그리드 위 화살표)이 그 시점까지 학습된 정책을 보여준다.
4. 500 Episode가 끝나면 자동으로 정지하고, 최종 Policy와 Value/Q 값이 그리드에 표시된다.

### 시나리오 F — Step/Episode 단위 실행을 섞어 쓴다

1. 사용자가 "Step" 버튼을 여러 번 눌러 Agent를 한 칸씩 수동으로 이동시키며 관찰한다.
2. 이후 "Run Episode"를 눌러 현재 Episode가 끝날 때까지(Goal 도달 또는 종료 조건)
   자동 진행시킨다.
3. Episode가 끝나면 자동으로 멈추고 다음 Episode 시작 전 상태에서 대기한다
   (연속 Episode 실행과는 별도 컨트롤).

### 시나리오 G — Value/Q-value와 Policy 변화를 시간에 따라 관찰한다

1. 사용자가 특정 State(셀)를 클릭해 선택하면, 해당 State의 Q(s,a) 4방향 값이
   숫자와 막대그래프로 표시된다.
2. 학습이 진행되며 이 값들이 실시간으로 바뀌는 것을 애니메이션(또는 즉시 갱신)으로 확인한다.
3. *(Post-MVP)* Value/Q 변화 이력을 미니 스파크라인 차트로 볼 수 있다(최근 N 갱신 기록,
   `ARCHITECTURE.md` §5.6 — UI 로컬 누적으로 구현, Engine 변경 없음).
4. 그리드 전체에 대해 "Policy Overlay"(각 셀의 최선 행동을 화살표로 표시)와
   "Value Heatmap"(색상 농도로 V(s) 또는 max Q(s,a) 표시)을 토글할 수 있다.

### 시나리오 H — 학습을 초기화한다

1. 사용자가 "Reset" 버튼을 누르면 확인 없이(또는 간단한 확인 후) 다음이 초기화된다:
   Q-table/V-table, Episode 카운트, 통계(Reward 이력 등), 현재 Agent 위치는 Start로 복귀.
2. 환경 설정(Grid, Wall, Reward 등)은 유지된다. 알고리즘/하이퍼파라미터 설정도 유지된다.
3. Reset 이후 즉시 새로운 학습을 시작할 수 있는 상태가 된다.

---

## 4. 기능 명세 (Functional Requirements)

### 4.1 환경 선택 및 관리
- FR-1: 사용자는 지원되는 환경 목록(최초: GridWorld) 중 하나를 선택할 수 있다.
- FR-2: 환경을 전환하면 현재 학습 세션은 초기화된다.
- FR-3: 향후 Maze, Cliff Walking, Frozen Lake, Multi-goal GridWorld, Custom Env를
  동일한 선택 UI에 추가할 수 있어야 한다(코드 변경 없이 등록만으로 노출).

### 4.2 환경 설정/편집
- FR-4: Grid 크기(가로/세로, 예: 3~20)를 변경할 수 있다.
- FR-5: Start 위치를 지정할 수 있다(1개, 향후 다중 확장 가능하도록 설계).
- FR-6: Goal 위치를 지정할 수 있다(최초 1개, 향후 Multi-goal 확장).
- FR-7: 임의의 셀을 Wall로 배치/제거할 수 있다.
- FR-8 *(Post-MVP)*: 셀 단위 Reward를 설정할 수 있다(기본 step reward, 특정 셀 커스텀
  reward). Config 데이터 구조는 MVP(Phase 1)에서부터 갖추되, 편집 UI는 Post-MVP에서
  제공한다(`ARCHITECTURE.md` §7.3/§11).
- FR-9 *(Post-MVP)*: 임의의 셀을 Terminal state로 지정/해제할 수 있다. FR-8과 동일하게
  데이터 구조는 MVP부터, 편집 UI는 Post-MVP.
- FR-10: (향후) Trap, 다중 Goal, 특수 Tile, 이동 비용, 확률적 이동(slip), Wind/장애물
  dynamics를 지원할 수 있는 데이터 구조를 최초 설계에 반영한다(즉시 UI 제공은 아님).
- FR-11 *(Post-MVP)*: 편집한 환경 설정을 저장/불러오기(JSON export/import 또는 로컬 저장)
  할 수 있다(최소 JSON export/import만 제공 가능). MVP에서는 제외한다
  (`ARCHITECTURE.md` §7.3/§11, `DESIGN_REVIEW.md` §4).

### 4.3 Agent / 알고리즘 설정
- FR-12: 알고리즘 목록(Q-Learning, SARSA, TD(0) — 아래 4.3.1 참고) 중 선택할 수 있다.
  구현 단계는 `ROADMAP.md`/`ARCHITECTURE.md` §11을 따른다: Q-Learning은 MVP(Phase 1),
  SARSA는 Phase 8, TD(0)는 Future(별도 설계 검토 후 착수 — `DESIGN_REVIEW.md` §1 R3/R8
  참고. 아키텍처 관점에서는 `ARCHITECTURE.md` §4.2의 `ValueAgent` 인터페이스가 자리를
  마련해 둔다).
- FR-13: 하이퍼파라미터(α, γ, ε 초기값/최소값/감쇠율, 필요 시 λ 등)를 UI로 조정할 수 있다.
- FR-14: 행동 선택 정책(ε-greedy 최초, 향후 softmax/UCB 확장 가능한 구조)을 설정할 수 있다.
- FR-15: 알고리즘/하이퍼파라미터 변경 시 학습 상태가 초기화됨을 사용자에게 알린다.

#### 4.3.1 알고리즘 지원 방침
- **Q-Learning**: 레퍼런스 저장소의 구현을 참고해 최초 포팅. Off-policy TD control.
- **SARSA**: 레퍼런스에는 없음. Q-Learning과 동일한 아키텍처 인터페이스로 신규 구현
  (On-policy TD control, next action은 실제 선택된 action 사용).
- **TD(0)** *(Future — MVP/Post-MVP 범위 밖)*: 레퍼런스에는 없음. Policy Evaluation
  (고정 정책의 V(s) 추정)용으로 신규 구현 예정. Control(정책 개선)이 아니라 "주어진
  정책을 평가"하는 별도 모드로 제공하며, 랜덤 정책 또는 학습된 Q-Learning/SARSA 정책을
  평가 대상으로 선택할 수 있다. 단, "다른 알고리즘이 학습한 Q로부터 유도한 정책을
  평가"하는 후자의 기능은 "새 알고리즘은 registry 등록만으로 추가 가능해야 한다"는
  원칙(NFR-4)과 충돌하는 것으로 확인되어(`DESIGN_REVIEW.md` §1 R3, §2 Q2), 가장 단순한
  형태(고정 랜덤 정책 평가)부터 별도 설계 검토를 거쳐 착수한다.

### 4.4 학습 제어
- FR-16: Step — 한 스텝(state→action→env.step→update)만 실행한다.
- FR-17: Run Episode — 현재 Episode가 종료(Goal 도달/Terminal/최대 step 도달)될 때까지 실행.
- FR-18: Run — 지정된 Episode 수만큼(또는 무한) 연속 실행.
- FR-19: Pause — 실행 중인 Run/Run Episode를 다음 스텝 경계에서 정지.
- FR-20: Resume — Pause된 지점부터 이어서 실행.
- FR-21: Reset — Q-table/V-table, 통계, 현재 Episode 진행 상태를 초기화(환경/알고리즘 설정은 유지).
- FR-22: Episode 수 설정 — Run 시 실행할 Episode 개수(또는 "until stopped")를 지정.
- FR-23: Step Interval / Speed 설정 — 스텝 간 지연 시간(ms) 또는 "steps per animation frame"을
  슬라이더로 조정. 최저 속도(육안 관찰용)부터 최고 속도(다수 Episode 고속 실행)까지 지원.
- FR-24: 실행 중 Speed 변경이 가능해야 하며, 현재 진행 중인 학습을 중단하지 않는다.
- FR-25: 고속 모드에서는 매 스텝 렌더링을 하지 않고 일정 주기로 배치 렌더링하여
  브라우저가 멈추지 않도록 한다(성능 고려 사항, 상세는 ARCHITECTURE.md).

### 4.5 관찰/시각화
- FR-26: 현재 State를 그리드 위 Agent 위치로, 텍스트로도 표시한다.
- FR-27: 마지막으로 선택된 Action을 표시한다(방향 아이콘 + 텍스트).
- FR-28: 마지막 Reward 값을 표시한다.
- FR-29: Next State를 표시한다.
- FR-30: TD Target 계산식을 실제 값이 대입된 형태로 표시한다.
  - Q-Learning: `TD Target = r + γ · max_a' Q(s', a')`
  - SARSA: `TD Target = r + γ · Q(s', a')` (실제 선택된 a')
  - TD(0): `TD Target = r + γ · V(s')`
- FR-31: TD Error(`δ = TD Target - Q(s,a)` 또는 `- V(s)`)를 표시한다.
- FR-32: 선택된 State의 Value 또는 Q-value(4방향)를 숫자/막대그래프로 표시하고,
  갱신 시 강조 애니메이션(또는 색상 변화)을 보여준다.
- FR-33: 그리드 전체에 대한 Policy Overlay(최선 행동 화살표)를 토글로 표시한다.
- FR-34: 그리드 전체에 대한 Value/Q Heatmap(색상 농도)을 토글로 표시한다.
- FR-35: "왜 그 Action을 선택했는가"에 대한 근거를 표시한다
  (예: ε-greedy에서 탐험 vs 활용 여부, 활용이면 어떤 Q-value 비교로 선택되었는지).

### 4.6 통계
- FR-36: 현재 Episode 번호를 표시한다.
- FR-37: 현재 Episode의 누적 Reward(Total Reward)를 표시한다.
- FR-38: 현재/최근 Episode의 길이(Step 수)를 표시한다.
- FR-39: 전체 Episode에 대한 평균 Reward를 (이동평균 포함) 그래프로 표시한다.
- FR-40: Success Rate(Goal 도달 비율, 최근 N Episode 기준)를 표시한다.

### 4.7 비기능 요구사항
- NFR-1: 모든 상태 갱신은 최소 지연으로 UI에 반영되어야 한다(Step 단위 조작 시 체감 지연 없음).
- NFR-2: 고속 다중 Episode 실행 시에도 브라우저 탭이 멈추거나 응답 불가 상태가 되지 않아야 한다.
- NFR-3: RL 알고리즘/환경 로직은 React 및 DOM에 의존하지 않고 별도로 유닛 테스트 가능해야 한다.
- NFR-4: 새로운 환경/알고리즘 추가는 기존 Simulation Engine 코드 수정 없이 "등록"만으로
  가능해야 한다(플러그인/레지스트리 구조).
- NFR-5: 접근성 — 최소한 키보드로 Step/Run/Pause 조작이 가능해야 한다(향후 강화 가능).

---

## 5. 범위 밖 (Out of Scope, 최초 버전)

- Deep RL(함수 근사, 신경망 기반 알고리즘) — 향후 확장 여지는 남기되 최초 버전 미포함.
- 서버/백엔드, 사용자 계정, 클라우드 저장 — 최초 버전은 순수 프론트엔드(정적 호스팅) 기준.
- 멀티 에이전트 강화학습.
- 연속 State/Action space 환경(GridWorld류는 이산 공간 한정).

---

## 6. 용어 정리

| 용어 | 의미 |
|---|---|
| State (s) | Agent의 현재 위치/상황 |
| Action (a) | Agent가 취할 수 있는 행동 (상/하/좌/우 등) |
| Reward (r) | Action 결과로 받는 보상 |
| Next State (s') | Action 이후 도달한 State |
| TD Target | 갱신 목표값 (Q-Learning/SARSA/TD(0)마다 계산식 다름) |
| TD Error (δ) | TD Target과 현재 추정값의 차이 |
| Value (V) | State의 가치 추정값 |
| Q-value | (State, Action) 쌍의 가치 추정값 |
| Policy (π) | State별 Action 선택 규칙 (최초: Q-value 기반 greedy/ε-greedy) |
