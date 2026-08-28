# LEGACY_ANALYSIS.md — 레퍼런스 저장소 분석

대상: https://github.com/oyueo-mm/Reinforcement_Learning_Practice-

이 저장소는 **참고용(reference-only)**이며 수정하지 않는다. 이 문서는 실제 파일 내용을
근거로 "무엇이 실제로 구현되어 있는가"를 확정하기 위해 작성한다(추측 배제).

---

## 1. 저장소 구조

```
Reinforcement_Learning_Practice-/
├── MC/
│   ├── Env.py
│   ├── MC_READ.md
│   ├── Monte_Carlo.py
│   └── utils.py
├── TD/
│   ├── Env.py
│   ├── Q_Learning.py
│   ├── TD_Read.md
│   └── utils.py
└── README.md
```

- README: "강화학습을 공부하면서 구현하고 실험한 내용을 정리한 저장소입니다."
- **결론: `TD/` 폴더에는 Q-Learning만 구현되어 있다. SARSA, TD(0)는 이 저장소에 존재하지 않는다.**
  (`MC/`는 Monte Carlo 방식으로, 이 프로젝트의 "TD 기반 알고리즘 우선 지원" 방침과
  무관하여 상세 분석 대상에서 제외한다.)

---

## 2. TD/Env.py — GridWorld 환경 (원문 기준 요약)

```python
class GridWorld:
    def __init__(self, WIDTH, HEIGHT, CELL_SIZE):
        self.agent = [0, 0]
        self.goal = [6, 6]
        self.bombs = [[3,3],[3,4],[3,5],[2,3],[1,3],[5,5],[4,5],[1,6],[1,4],[3,0],[3,1],[5,2]]

    def reset(self):
        self.agent = [0, 0]
        return tuple(self.agent)

    def step(self, action):
        reward = -0.1
        done = False
        # 0,1,2,3 : 상,하,좌,우
        # action에 따라 self.agent 좌표 변경
        # 경계 이탈 시: reward = -1, 좌표를 clamp (탈출 불가, 위치 유지)
        # 도착(goal) 시: reward = 10, done = True
        # 폭탄(bomb) 도달 시: reward = -10, done = True
        return tuple(self.agent), reward, done
```

### 핵심 규칙 (재구현 시 그대로 따를 것)

| 항목 | 값/규칙 |
|---|---|
| Grid 크기 | 7×7 (WIDTH/HEIGHT/CELL_SIZE로 계산: `WIDTH // CELL_SIZE`) |
| Action 인코딩 | 0=상(y-1), 1=하(y+1), 2=좌(x-1), 3=우(x+1) |
| Start | (0, 0) 고정 |
| Goal | (6, 6) 고정, reward=+10, done=True |
| Bomb(폭탄) | 12개 고정 좌표, reward=-10, done=True |
| 기본 step reward | -0.1 (매 스텝 이동 비용) |
| 경계 이탈 | reward=-1, 좌표를 grid 범위 내로 clamp (agent는 그 자리에 머무름), done=False |
| State 표현 | `tuple(self.agent)` = `(x, y)` |

### 재구현 시 주의할 세부사항 (원문의 암묵적 동작)

1. **Reward 우선순위**: 코드 순서상 `경계 이탈 -1` → `Goal +10, done` → `Bomb -10, done`
   순으로 조건이 검사된다. Goal과 Bomb 좌표가 겹치지 않는 한 문제되지 않지만,
   재구현 시 "한 스텝에 여러 조건이 동시에 만족될 수 있는가"를 명시적으로 결정해야 한다
   (원문은 마지막에 검사된 조건이 최종 reward를 덮어씀 — Bomb 검사가 Goal보다 나중이라
   좌표가 겹치면 Bomb이 우선).
2. **경계 이탈은 Terminal이 아니다**: 벽/경계에 부딪혀도 `done=False`이며 위치만 clamp된다
   (원문에 별도 Wall 개념은 없고 "그리드 경계"만 있음 — 내부 Wall은 이 저장소에 없다,
   `PRODUCT_SPEC.md`의 Wall 배치 기능은 신규 요구사항이며 레퍼런스에 없던 기능이다).
3. **Bomb은 이 프로젝트의 "Trap"과 유사한 개념**이지만, 레퍼런스에서는 Terminal(즉시 종료 +
   음수 reward)로 동작한다. `PRODUCT_SPEC.md` FR-10의 "Trap"을 향후 지원할 때 이 Bomb 규칙을
   기본값으로 참고할 수 있다.
4. **render()는 Pygame 기반**이라 웹 이식 대상이 아니다. `getRenderModel()` 설계 시
   grid/agent/goal/bombs 좌표 데이터만 참고하고 렌더링 방식은 무관하다.

---

## 3. TD/Q_Learning.py — Q-Learning 학습 루프 (원문 기준 요약)

```
- Grid: 700x700px, cell 100px → 7x7 (Env.py와 동일 인스턴스 파라미터)
- Episodes: 2000
- Learning rate (α): 0.1
- Discount factor (γ): 0.9
- ε-greedy: ε 시작값 1.0, decay 0.995/episode, 최소값 0.01
- 매 스텝: ε-greedy로 action 선택 → env.step(action) → Bellman 갱신
- 400 episode마다 show_best()로 현재 정책 시연 (Pygame 렌더)
- 학습 종료 후 show_direction()으로 최종 정책을 화살표 텍스트로 출력
```

### Q-Learning 업데이트 규칙 (표준 Bellman, 원문 기준)

```
Q(s,a) ← Q(s,a) + α · [ r + γ · max_a' Q(s',a') − Q(s,a) ]
```

- `TD Target = r + γ · max_a' Q(s',a')`
- `TD Error = TD Target − Q(s,a)`
- `Q(s,a) ← Q(s,a) + α · TD Error`

이 프로젝트(`RL_Playground`)의 `computeUpdate`/`TDInfo`는 이 값들을 그대로 노출해야 한다
(ARCHITECTURE.md §4, §6.1 참고). 단, **terminal state에서는 `max_a' Q(s',a')` 항을 0으로
처리해야 하는지 원문에는 명시적 분기가 없다** — `done=True`인 transition에서도
`next_state`의 Q-table 항목이 `get_q()`에 의해 `np.zeros(4)`로 초기화되어 사실상 0이 되므로
결과적으로는 맞게 동작하지만, "terminal이면 bootstrap하지 않는다"는 규칙을 **명시적으로**
구현하지 않으면(예: next_state를 재방문해 학습이 진행되며 우연히 0이 아닌 값이 채워질 경우)
버그가 될 수 있는 잠재적 함정이다. → 이 프로젝트에서는 `done=True`인 경우
`TD Target = r` (bootstrap 항 제외)로 **명시적으로** 처리하도록 설계에 반영한다.

### utils.py

- `get_q(state, q_table)`: `dict[state] -> np.zeros(4)` 지연 초기화. → TS에서는
  `Map<StateKey, number[]>`에 대해 동일한 lazy-init 패턴(`getOrCreate`)으로 이식.
- `show_best`, `show_direction`: Pygame 콘솔 시연용, 웹 UI에서는 각각
  "Run Episode 시연"과 "Policy Overlay"로 대체된다 (직접 이식 대상 아님).

---

## 4. TD_Read.md — 환경 설명 (사람이 읽는 규칙 문서)

- 7×7 grid, 빨강=Agent, 검정=Bomb, 초록=Goal.
- Goal 도달 시 "+100점", Bomb 도달 시 "-100점"으로 문서에 기술되어 있으나,
  **실제 코드(Env.py)의 reward는 +10 / -10**이다. → 문서(README류)와 코드 값이 불일치.
  이 프로젝트는 **코드(Env.py) 값을 기준**으로 삼는다(문서는 설명 목적의 근사치로 판단).

---

## 5. 이 프로젝트에 대한 시사점 (Design Implications)

1. **Q-Learning은 "이식(port)"** — 위 §3의 업데이트 규칙, 하이퍼파라미터 기본값(α=0.1, γ=0.9,
   ε 1.0→0.01 decay 0.995)을 GridWorld 프리셋의 기본 하이퍼파라미터 초기값으로 채택한다.
2. **SARSA/TD(0)는 "신규 구현"** — 레퍼런스에 없으므로 알고리즘 설계·검증(단위 테스트 기대값)을
   이 프로젝트에서 처음부터 정의해야 한다. 참고할 기존 구현이 없다는 뜻이므로,
   `docs/DESIGN_REVIEW.md`에서 이 두 알고리즘, 특히 TD(0)의 아키텍처 적합성을
   더 엄격히 검증해야 한다.
3. **Wall은 레퍼런스에 없는 신규 개념**이다 (레퍼런스는 "경계"만 있고 내부 장애물은
   Bomb=Terminal뿐). `PRODUCT_SPEC.md`의 Wall(통과 불가, non-terminal)은 Bomb(Terminal,
   음수 보상)과 별개 개념으로 명확히 구분해 설계해야 한다 — 실제로 현재
   `ARCHITECTURE.md`의 GridWorldConfig가 이 둘을 구분하고 있는지 재확인 필요
   (`DESIGN_REVIEW.md`에서 점검).
4. **Terminal bootstrap 처리**를 Algorithm 설계에 명시적 규칙으로 포함해야 한다(§3 참고).
5. State는 `(x, y)` 튜플 → 문자열 키(`"x,y"`)로 직렬화하는 기존 `StateKey` 설계와 호환된다.
