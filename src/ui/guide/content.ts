import type { Locale } from '../i18n'

export const chapterTitles = {
  ko: ['강화학습 기초', 'Q-Table과 상태·행동 가치', 'Q-Learning', 'SARSA', '두 알고리즘 비교', '하이퍼파라미터와 학습 전략'],
  en: ['Reinforcement learning basics', 'Q-table and state/action values', 'Q-Learning', 'SARSA', 'Compare the algorithms', 'Hyperparameters and strategy'],
}
export const lessons: Record<Locale, { intro: string; paragraphs: string[] }[]> = {
  ko: [
    { intro: '강화학습은 에이전트가 환경과 상호작용하며 장기적인 누적 보상을 높이는 행동 정책을 배우는 방법입니다.', paragraphs: [
      'Agent(에이전트)는 행동을 선택하는 주체, Environment(환경)는 행동에 대한 다음 상태와 보상을 제공하는 세계입니다. State(상태)는 의사결정에 필요한 정보이며 Action(행동)은 이 격자에서 위·아래·왼쪽·오른쪽 이동입니다.',
      'Reward(보상)는 한 번의 전이에 대한 피드백입니다. Policy π(a|s)는 상태에서 각 행동을 선택할 확률입니다. Episode(에피소드)는 시작부터 종료까지의 경험이며, 여기서는 모든 Goal 수집이 정상 완료이고 Bomb 진입은 실패 종료입니다.',
      'Return Gₜ는 지금부터 얻을 할인 누적 보상입니다. Discount factor γ는 나중 보상을 얼마나 반영할지 정합니다. 보상은 한 걸음의 피드백이고 Return은 여러 걸음의 합이라는 차이를 기억하세요.',
      'MDP는 상태·행동·전이 확률·보상·할인율로 의사결정 문제를 표현합니다. Markov 성질은 현재 상태와 행동이 주어지면 미래가 과거 경로에 추가로 의존하지 않는다는 뜻입니다. 따라서 이 도구의 상태에는 위치뿐 아니라 수집 Goal, 붕괴 바닥, 열린 벽 그룹도 포함됩니다.',
      '예: 오른쪽 행동 → 벽이면 제자리와 wallPenalty, 통과 가능하면 다음 셀과 stepReward, 처음 방문한 Goal이면 goalReward. 포털은 최종 위치를 바꾸고 단방향 타일은 출발을 제한합니다. 경험 (s,a,r,s′)으로 Q값을 갱신합니다.',
    ] },
    { intro: 'Q-table의 한 행은 상태, 한 열은 행동입니다. 숫자는 그 행동 이후 얻을 누적 보상의 추정치입니다.', paragraphs: [
      'Vπ(s)는 정책 π를 따를 때 상태 s에서 기대되는 Return이고, Qπ(s,a)는 s에서 먼저 a를 실행한 뒤 π를 따를 때 기대되는 Return입니다. Vπ(s)=Σₐπ(a|s)Qπ(s,a). 탐욕 정책에서는 V(s)=maxₐQ(s,a)로 볼 수 있습니다.',
      '아래 표의 강조된 값이 탐욕 행동입니다. 활용(Exploitation)은 현재 최대 Q값을 선택하고, 탐험(Exploration)은 다른 행동도 경험합니다. ε-greedy는 확률 ε로 전체 행동 중 무작위 선택, 나머지 확률로 탐욕 선택합니다. 무작위 선택도 탐욕 행동을 고를 수 있습니다.',
      '이 프로젝트는 미방문 상태의 Q값을 모두 0으로 시작합니다. 실제 탐욕 실행의 동률 처리는 가장 낮은 행동 인덱스(위→아래→왼쪽→오른쪽)입니다. 정책 오버레이의 ⋯는 동률을 의미하며 방문/미방문을 단독으로 구별하지 않습니다. 유일한 최대값에만 화살표를 그립니다.',
      '가치 히트맵은 현재 동적 상태에 해당하는 max Q 추정값입니다. 실제 Return이나 최적 가치가 확정되었다는 뜻은 아닙니다. TD 오차 δ = 목표값 − 현재 Q값은 이번 경험이 기존 예측과 얼마나 다른지 나타냅니다.',
    ] },
    { intro: 'Q-Learning은 행동 정책과 다른 탐욕 목표를 사용하는 Off-policy Temporal-Difference Control입니다.', paragraphs: [
      'ε-greedy로 탐험하더라도 학습 목표는 다음 상태에서 가능한 가장 큰 Q값입니다. 경험한 보상과 현재 추정을 함께 사용하므로 환경 전이 모델 없이 한 걸음씩 학습할 수 있습니다.',
      's는 현재 상태, a는 실행 행동, r은 즉시 보상, s′는 다음 상태, α는 학습률, γ는 할인율입니다. max는 다음 상태의 네 행동을 비교합니다. 아래 수식의 대괄호가 TD 오차 δ입니다.',
      '예: Q=2, r=−1, α=0.5, γ=0.9, max Q′=4. 목표는 −1+0.9×4=2.6, 오차는 0.6, 새 Q는 2+0.5×0.6=2.30입니다. 종료 전이는 목표가 r뿐이므로 같은 입력이면 0.50입니다.',
      '장점은 실제 탐험 행동과 별도로 탐욕 목표를 학습한다는 점입니다. 한계는 표가 상태 수에 따라 커지고 최대값 추정의 오차가 목표에도 반영될 수 있다는 점입니다. 유한 MDP에서의 수렴 조건에는 충분한 방문과 적절한 학습률 조건이 필요하며 고정 α·유한 실행만으로 수렴을 보장하지 않습니다.',
      '실험: 동일한 맵에서 ε를 유지하고 Bomb 주변 경로의 Q값과 실제 탐험 실패를 비교해 보세요. 목표 정책의 가치와 탐험 중 성과는 다를 수 있습니다.',
    ] },
    { intro: 'SARSA는 State–Action–Reward–State–Action을 사용하는 On-policy TD Control입니다.', paragraphs: [
      '다음 상태 s′에서 현재 ε-greedy 정책으로 실제 선택한 a′의 Q값을 목표에 사용합니다. Q-Learning의 max와 달리 탐험으로 선택한 행동도 업데이트에 직접 반영합니다.',
      '엔진은 목표 계산에 사용한 a′를 보관하고 다음 걸음에 그대로 실행합니다. 목표 계산 후 새로운 행동을 다시 추첨하면 같은 SARSA 전이를 설명할 수 없습니다. 종료 전이에서는 이후 행동의 Q값을 사용하지 않습니다.',
      '예: Q=2, r=−1, α=0.5, γ=0.9, 선택된 Q′=1. 목표는 −0.1, 오차는 −2.1, 새 Q는 0.95입니다. 종료 전이는 Q-Learning과 같이 0.50입니다.',
      '장점은 탐험을 포함해 실제 수행하는 정책을 평가하고 개선한다는 점입니다. 한계는 결과가 탐험 정책과 ε에 의존하며, 계속 탐험하는 정책의 가치가 순수 탐욕 정책의 가치와 다를 수 있다는 점입니다. SARSA가 모든 맵에서 더 안전하거나 우수한 것은 아닙니다.',
      '실험: 같은 위험 맵·보상·α·γ·ε·학습 횟수에서 여러 번 비교하세요. 확률적인 행동 선택 때문에 한 번의 결과만으로 알고리즘의 우열을 판단하지 마세요.',
    ] },
    { intro: '같은 경험도 다음 Q값을 어떻게 고르느냐에 따라 업데이트가 달라집니다.', paragraphs: [
      '아래 계산기는 교육용 숫자 예제입니다. 실행 중 실험이나 Q-table에 연결되지 않습니다. Q-Learning은 max Q′, SARSA는 실제 선택된 Q′를 사용합니다. 비교를 위해 선택 Q′가 최대 Q′보다 크지 않도록 입력하세요.',
      '위험 주변의 탐험 행동이 나쁜 결과를 낳는 조건에서 SARSA는 그 탐험 비용을 가치에 반영할 수 있습니다. 실제 경로는 ε, 보상, 학습량, 동률 처리에 따라 달라집니다. ε=0이고 다음 행동이 탐욕이면 두 목표가 같을 수도 있습니다.',
    ] },
    { intro: '한 번에 하나의 설정을 바꾸고, 경로·성공률·보상을 함께 관찰하세요.', paragraphs: [
      'α(학습률, 0–1)는 새 목표가 현재 Q값을 바꾸는 비율입니다. 0이면 학습하지 않고 1이면 이번 목표로 대체합니다. 큰 값은 빨리 반응하지만 변동이 크며 작은 값은 천천히 반영합니다.',
      'γ(할인율)는 미래 보상의 중요도입니다. 보통 0≤γ≤1로 해석하며, 0이면 즉시 보상만 고려합니다. γ=1은 종료하는 과제에서 할인 없이 합산하는 경우입니다. 이 실험 도구의 입력 범위는 0–2지만 γ>1은 미래를 증폭하고 값의 발산이나 비표준 Return을 만들 수 있어 일반적인 할인 MDP 해석과 구별해야 합니다.',
      'ε(탐험 확률, 0–1)가 크면 무작위 행동이 늘고 작으면 현재 가치의 활용이 늘어납니다. 0은 순수 탐욕, 1은 완전 무작위입니다. 이 도구는 고정 ε를 사용하며 자동 ε decay 기능은 제공하지 않습니다.',
      '추천 실험 순서: 작은 맵 → 기본 α=0.1, γ=0.9, ε=0.1 → 250 에피소드 → 통계와 Q값 확인 → 한 변수만 변경. 250은 기본 입력값이며 학습 성공이나 최대 실행 횟수를 보장/제한하지 않습니다. 중단하면 진행 에피소드만 취소하고 Q값과 완료 이력을 보존합니다.',
    ] },
  ],
  en: [
    { intro: 'Reinforcement learning learns a policy through interaction to improve long-term return.', paragraphs: [
      'An Agent chooses actions. The Environment supplies next states and rewards. State contains the information needed for decisions. Actions here are up, down, left and right.',
      'Reward is feedback for one transition. A policy π(a|s) assigns action probabilities. An episode runs from a reset to termination: all goals collected means success; a bomb means failure.',
      'Return Gₜ sums discounted future rewards. The discount factor γ controls their weight. A reward describes one step; a return combines many steps.',
      'An MDP describes states, actions, transition probabilities, rewards and a discount factor. The Markov property means the current state and action contain the information needed for the next transition. Here state includes collected goals, collapsed floors and open wall groups as well as position.',
      'Example: move right. A wall gives wallPenalty and no movement; a free cell gives stepReward; a new goal gives goalReward. Portals change the destination and one-way tiles restrict departure. The transition (s,a,r,s′) supplies a Q update.',
    ] },
    { intro: 'Each Q-table row is a state and each column an action. Values estimate return after taking that action.', paragraphs: [
      'Vπ(s) is expected return from s following π. Qπ(s,a) first takes a, then follows π. Vπ(s)=Σₐπ(a|s)Qπ(s,a). For a greedy policy, V(s)=maxₐQ(s,a).',
      'Highlighted entries are greedy choices. Exploitation selects a current maximum; exploration tries alternatives. With probability ε, ε-greedy samples uniformly from all actions; otherwise it chooses greedily. Random selection can also select the greedy action.',
      'Unvisited states start with zero Q-values. Actual greedy ties use the lowest action index: up, down, left, right. The policy overlay shows ⋯ for ties, which alone does not distinguish visited from unvisited states. Only a unique maximum receives an arrow.',
      'The heatmap shows max Q for the current dynamic state, an estimate rather than a measured return or a certified optimum. TD error δ = target − current Q measures the discrepancy in this experience.',
    ] },
    { intro: 'Q-Learning is off-policy temporal-difference control: a greedy target can differ from the behavior policy.', paragraphs: [
      'Even when ε-greedy behavior explores, the target uses the highest next-state Q-value. A model-free update combines a sampled reward with the current estimate of future value.',
      's is state, a the executed action, r immediate reward and s′ next state. α is learning rate and γ discount. The maximum compares four next actions. The bracketed difference is TD error δ.',
      'Example: Q=2, r=−1, α=0.5, γ=0.9, max Q′=4. Target=2.6; error=0.6; new Q=2.30. At termination the target is only r, giving 0.50 for these inputs.',
      'Its strength is learning a greedy target separately from exploration. Limits include a table that grows with state count and estimation errors in the maximum. Convergence needs sufficient visits and suitable learning-rate conditions; finite training with fixed α does not guarantee it.',
      'Try inspecting values near bombs while exploration remains enabled. The value of the target policy and the performance of exploratory behavior can differ.',
    ] },
    { intro: 'SARSA means State–Action–Reward–State–Action. It is on-policy TD control.', paragraphs: [
      'At s′, use the Q-value of a′ actually selected by the current ε-greedy policy. Exploratory actions therefore affect the update directly, rather than being replaced by a maximum.',
      'The engine caches a′ and executes that same action on the following step. Resampling it after computing the target would break this link. Terminal updates omit future action values.',
      'Example: Q=2, r=−1, α=0.5, γ=0.9, selected Q′=1. Target=−0.1; error=−2.1; new Q=0.95. At termination it becomes 0.50, like Q-Learning.',
      'It learns about the policy actually followed, including exploration. Results depend on ε and behavior; the value of a policy that keeps exploring can differ from a purely greedy policy. SARSA is not universally safer or better.',
      'Compare repeated runs under the same map, rewards, α, γ, ε and episode count. Random choices make a single run insufficient to rank algorithms.',
    ] },
    { intro: 'The next Q-value used in the target can change the update for the same experience.', paragraphs: [
      'This is an educational calculator, independent of the live experiment and Q-table. Q-Learning uses max Q′; SARSA uses selected Q′. For a consistent example, selected Q′ should not exceed max Q′.',
      'When exploration near hazards is costly, SARSA can reflect that cost. Paths still depend on ε, rewards, training and ties. With ε=0 and a greedy next action, both targets may coincide.',
    ] },
    { intro: 'Change one setting at a time and inspect paths, success rates and rewards together.', paragraphs: [
      'α (0–1) controls the fraction of a new target incorporated into Q. Zero makes no update; one replaces the estimate. Larger values react faster but fluctuate; smaller values adapt gradually.',
      'γ weights future rewards, conventionally between zero and one. Zero considers immediate reward only; one gives an undiscounted return for terminating tasks. This app permits 0–2: values above one amplify the future and can cause diverging values, outside the conventional discounted-MDP interpretation.',
      'ε (0–1) controls uniform exploration: zero is greedy, one is fully random. This app uses a fixed ε and does not implement automatic ε decay.',
      'Try a small map with α=0.1, γ=0.9, ε=0.1 for 250 episodes. Inspect Q-values and statistics before changing one variable. 250 is a default, not a success guarantee or upper limit. Stop cancels the current episode but keeps Q-values and completed history.',
    ] },
  ],
}

export function pseudocode(ko: boolean, sarsa: boolean) {
  return ko ? [
    'Q(s,a)를 모두 0으로 초기화',
    '각 에피소드마다: 환경을 초기화하여 s 관측',
    ...(sarsa ? ['  ε-greedy로 a 선택'] : []),
    '  종료할 때까지 반복:',
    ...(sarsa ? [] : ['    ε-greedy로 a 선택']),
    '    a 실행 → 보상 r, 다음 상태 s′, 종료 여부 관측',
    sarsa ? '    종료가 아니면 ε-greedy로 a′ 선택 (다음에 그대로 실행)' : '    종료가 아니면 다음 상태의 최대 Q값 계산',
    sarsa ? '    목표 ← 종료이면 r, 아니면 r + γQ(s′,a′)' : '    목표 ← 종료이면 r, 아니면 r + γ max Q(s′,·)',
    '    Q(s,a) ← Q(s,a) + α[목표 − Q(s,a)]',
    sarsa ? '    s ← s′; 종료가 아니면 a ← a′' : '    s ← s′',
  ].join('\n') : [
    'Initialize all Q(s,a) to zero', 'For each episode: reset environment to state s',
    ...(sarsa ? ['  Select a using ε-greedy'] : []), '  Repeat until terminal:',
    ...(sarsa ? [] : ['    Select a using ε-greedy']), '    Execute a → observe r, s′ and termination',
    sarsa ? '    If nonterminal: select a′ using ε-greedy; cache it' : '    If nonterminal: find max Q(s′,·)',
    sarsa ? '    target ← r if terminal, else r + γQ(s′,a′)' : '    target ← r if terminal, else r + γ max Q(s′,·)',
    '    Q(s,a) ← Q(s,a) + α[target − Q(s,a)]', sarsa ? '    s ← s′; if nonterminal: a ← a′' : '    s ← s′',
  ].join('\n')
}
