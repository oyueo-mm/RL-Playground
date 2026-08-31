## 목적
**강화학습의 알고리즘이 실제로 어떻게 학습하고 행동하는지 직접 관찰할 수 있다면, 강화학습을 더 쉽고 재미있게 이해할 수 있지 않을까?** 라는 생각에서 시작했습니다.

RL Playground는 강화학습의 학습 과정을 시각적으로 보여주고, 다양한 환경과 알고리즘을 직접 실험해볼 수 있도록 만든 프로젝트입니다.

https://oyueo-mm.github.io/RL-Playground/

---

## 주요 기능
### 환경 구성
* GridWorld 환경 직접 구성
* Agent, Wall, Goal, Bomb 배치
* Reward / Penalty 설정
* 다양한 환경 Preset 제공

### 강화학습
* Q-Learning
* SARSA
* Epsilon, Learning Rate, Discount Factor 조절

### 학습 제어
* Step 단위 학습
* Episode 단위 실행
* 학습 일시정지 / 재개 / 초기화

### 학습 과정 시각화
* Q-value
* Policy
* Value Heatmap
* Episode Trajectory
* Reward Chart
* Learning Progress

### 학습 결과 분석
* State, Action, Reward 확인
* TD Target / TD Error 확인
* Episode별 학습 결과 확인
* 학습된 Q-table을 이용한 Greedy Policy 실행
