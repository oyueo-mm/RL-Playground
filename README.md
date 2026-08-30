# RL Playground

강화학습의 학습 과정을 직접 보고, 조작하고, 이해하기 위한 **Interactive Reinforcement Learning Simulator**입니다.

[Live Demo](https://oyueo-mm.github.io/RL-Playground/)

---

# Why I Made This

강화학습을 공부하면서 가장 어려운 부분 중 하나는 **알고리즘이 실제로 어떻게 학습되는지 이해하는 것**이라고 생각했습니다.

Q-Learning이나 SARSA를 공부하면

* State
* Action
* Reward
* Q-value
* TD Target
* TD Error
* Policy

같은 개념과 수식을 배우게 됩니다.

하지만 수식만 보고 있으면,

> "그래서 이 값들이 실제 학습 과정에서 어떻게 변하는 거지?"

라는 생각이 들 수 있습니다.

실제로 강화학습을 어려워하는 사람을 보면서,

**"강화학습이 학습되는 과정을 직접 볼 수 있다면 조금 더 쉽게 이해할 수 있지 않을까?"**

라는 생각이 들었고, 그 아이디어에서 이 프로젝트를 시작했습니다.

Agent가 GridWorld를 돌아다니면서 어떤 행동을 선택하고, Reward를 받고, Q-value를 업데이트하고, 점점 더 나은 Policy를 만들어가는 과정을 직접 관찰할 수 있도록 만들었습니다.

그리고 사실 이것과 별개로,

**강화학습 시뮬레이터 자체가 굉장히 재미있어 보였습니다.**

Agent를 직접 움직여보고, 환경을 만들고, 보상과 패널티를 바꿔보고, 학습 과정을 눈으로 확인하는 것이 흥미로웠습니다.

그래서 단순히 강화학습 알고리즘을 구현하는 것보다,

> **"강화학습을 직접 가지고 놀면서 이해할 수 있는 공간을 만들어보자."**

라는 방향으로 프로젝트를 발전시켰습니다.

---

# How I Made This

이 프로젝트는 **Claude와 함께 개발했습니다.**

아이디어와 요구사항을 정리하고, 프로젝트 구조를 설계한 뒤 Claude와 함께 구현과 디버깅, 테스트, 리팩터링을 반복하는 방식으로 개발했습니다.

단순히 코드를 생성하는 데 그치지 않고,

**기획 → 설계 → 구현 → 테스트 → 문제 발견 → 수정 → 검증**

의 과정을 반복하면서 프로젝트를 만들어갔습니다.

특히 강화학습의 핵심 로직과 UI를 분리하는 것을 중요하게 생각했습니다.

전체 구조는 다음과 같습니다.

```text
Environment
      ↓
    Agent
      ↓
  Algorithm
      ↓
Simulation Engine
      ↓
Visualization
      ↓
     UI
```

강화학습의 핵심 로직은 React나 DOM에 의존하지 않는 **순수 TypeScript**로 구현했습니다.

이를 통해 RL 시뮬레이션 자체와 UI를 분리하고, 핵심 로직을 UI 없이 독립적으로 테스트할 수 있도록 구성했습니다.

React에서는 `useSyncExternalStore`를 이용하여 `SimulationEngine`의 상태를 구독하는 방식으로 연결했습니다.

## Tech Stack

### Frontend

* **React 19**
* **TypeScript**
* **Vite**
* **Tailwind CSS 4**

### Reinforcement Learning

* **Q-Learning**
* **SARSA**
* **ε-greedy Policy**
* **Temporal Difference Learning**
* **GridWorld Environment**

### Visualization

* **SVG**
* 별도의 Chart / Visualization Library 없이 직접 구현

Grid, Q-value Chart, Reward Chart, Learning Progress Chart, Policy Overlay, Value Heatmap 등을 SVG 기반으로 구현했습니다.

### State Management

* **SimulationEngine**
* **useSyncExternalStore**

별도의 상태관리 라이브러리를 사용하지 않고 Simulation Engine을 중심으로 시뮬레이션 상태를 관리합니다.

### Testing

* **Vitest**
* **Testing Library**
* **ESLint**

현재 `npm run test` 기준으로 **37개의 test files / 724개의 tests**를 포함하고 있습니다.

---

# Features

## 1. GridWorld Environment

강화학습을 실행할 환경을 직접 구성할 수 있습니다.

* Grid 크기 변경
* Start 지정
* Wall 배치
* 여러 개의 Goal 배치
* Bomb 배치
* Step Reward 설정
* Wall Penalty 설정
* Goal Reward 설정
* Bomb Penalty 설정

환경을 직접 만들어 Agent가 어떤 행동을 학습하게 될지 실험할 수 있습니다.

### Multiple Goals

하나의 Goal뿐만 아니라 여러 개의 Goal을 배치할 수 있습니다.

Agent가 모든 Goal을 방문하면 Episode가 종료되며, 이미 수집한 Goal은 해당 Episode 동안 Grid에서 사라집니다.

또한 State에는 Agent의 위치뿐만 아니라 **현재까지 수집한 Goal의 상태**도 포함됩니다.

따라서 같은 위치에 다시 도착하더라도 남아있는 Goal이 다르다면 서로 다른 State로 구분됩니다.

---

## 2. Environment Presets

환경을 직접 만드는 것뿐만 아니라 미리 구성된 Preset을 사용할 수도 있습니다.

* Simple Corridor
* Maze
* Bomb Field
* Multi Goal
* Treasure Hunt

Preset을 선택한 뒤에도 실제 적용하기 전에 자유롭게 수정할 수 있습니다.

---

## 3. Q-Learning & SARSA

현재 두 가지 대표적인 TD Control 알고리즘을 지원합니다.

* **Q-Learning**
* **SARSA**

두 알고리즘을 동일한 환경에서 실행하면서 On-Policy와 Off-Policy의 차이를 직접 관찰할 수 있습니다.

또한 다음 Hyperparameter를 직접 조절할 수 있습니다.

* **Epsilon** — Exploration Rate
* **Alpha** — Learning Rate
* **Gamma** — Discount Factor

---

## 4. Step-by-Step Learning

학습을 단순히 자동으로 돌리는 것뿐만 아니라 Agent의 행동을 하나씩 확인할 수 있습니다.

* Step
* Run
* Run Episode
* Pause
* Resume
* Reset
* Stop & Restart

또한 학습 속도를

**Slow → Normal → Fast → Very Fast**

로 변경할 수 있습니다.

---

## 5. Greedy Policy

학습이 끝난 뒤 현재 Q-table을 이용해 Agent가 어떤 행동을 선택하는지 확인할 수 있습니다.

`Run Greedy Policy`를 실행하면 Exploration 없이 현재 학습된 Q-value를 기반으로 가장 좋은 Action을 선택합니다.

이를 통해

> **"지금까지 학습한 결과만 가지고 Agent가 실제로 어떻게 행동하는가?"**

를 확인할 수 있습니다.

---

## 6. RL Inspector

현재 Transition에서 강화학습 알고리즘 내부에서 어떤 계산이 일어났는지 확인할 수 있습니다.

* State
* Action
* Reward
* TD Target
* TD Error
* Q-value Before
* Q-value After

특히 TD Target과 TD Error를 함께 보여주기 때문에 Q-value가 왜 변화했는지 단계별로 확인할 수 있습니다.

---

## 7. Q-value Visualization

현재 State에서 Agent가 각각의 Action을 얼마나 좋게 평가하고 있는지 막대그래프로 확인할 수 있습니다.

이를 통해

**"Agent가 지금 이 State에서 어떤 행동을 가장 좋다고 생각하고 있는가?"**

를 직관적으로 확인할 수 있습니다.

---

## 8. Policy Overlay

Grid 위에 현재 Policy가 선택하는 Greedy Action을 방향 화살표로 표시합니다.

학습이 진행될수록 각각의 State에서 Agent가 어떤 행동을 선택하게 되는지 한눈에 확인할 수 있습니다.

---

## 9. Value Heatmap

각 State의 Value를

`V(s) = max Q(s, a)`

로 계산하여 Grid 위에 Heatmap으로 표시합니다.

이를 통해 Agent가 학습하면서 어떤 State를 가치 있는 위치로 인식하게 되는지 확인할 수 있습니다.

---

## 10. Episode Statistics

각 Episode의 학습 결과를 기록하고 분석할 수 있습니다.

주요 통계:

* Episode
* Total Reward
* Episode Length
* Success Rate
* Steps
* Termination
* Exploration / Exploitation
* Exploration Rate
* Average Reward
* Unique States

Episode History에서 특정 Episode를 선택하면 해당 Episode의 상세 정보를 확인할 수 있습니다.

---

## 11. Reward Chart

Episode가 진행될수록 Total Reward가 어떻게 변화하는지 SVG Line Chart로 확인할 수 있습니다.

이를 통해 Agent의 학습이 실제로 진행되고 있는지 시각적으로 확인할 수 있습니다.

---

## 12. Learning Progress

학습 과정에서

* Total Reward
* Steps

두 지표의 변화를 함께 확인할 수 있습니다.

Episode History와 연동되어 특정 Episode의 데이터를 직접 확인할 수도 있습니다.

---

## 13. Termination Analysis

Episode가 어떤 이유로 종료되었는지 전체 History를 기반으로 분석합니다.

* Goal
* Bomb
* Other

이를 통해 Agent가 목표를 얼마나 잘 달성하고 있는지, 위험한 State에서 얼마나 자주 종료되는지 등을 확인할 수 있습니다.

---

## 14. Episode Trajectory

특정 Episode에서 Agent가 실제로 어떤 경로를 이동했는지 확인할 수 있습니다.

Grid 위에 실제 이동 경로를 표시하고 각 Step의

`State → Action → Reward`

를 확인할 수 있습니다.

반복해서 방문한 State 역시 실제 방문 순서 그대로 기록됩니다.

또한 Grid 위의 Episode Path Overlay는 별도로 켜고 끌 수 있습니다.

---

# Project Goal

이 프로젝트의 목표는 복잡한 강화학습 알고리즘을 단순히 구현하는 것이 아닙니다.

강화학습을 공부할 때 흔히 볼 수 있는

**수식 → 코드 → 결과**

사이의 간극을 줄이고,

**Agent가 행동하고 → Reward를 받고 → 값을 업데이트하고 → Policy를 변화시키는 과정**

전체를 직접 관찰할 수 있도록 만드는 것이 목표입니다.

그리고 무엇보다,

**강화학습을 어렵게 공부하는 것이 아니라 직접 실험하면서 가지고 놀 수 있는 환경**

을 만드는 것을 목표로 했습니다.

---

# Project

**RL Playground**

Interactive Reinforcement Learning Simulator

[GitHub Repository](https://github.com/oyueo-mm/RL-Playground)
[Live Demo](https://oyueo-mm.github.io/RL-Playground/)
