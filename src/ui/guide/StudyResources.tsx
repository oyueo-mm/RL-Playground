import type { Locale } from '../i18n'
import { ResourceLinks } from './ResourceLinks'

const silver = 'https://www.davidsilver.uk/teaching/'
const book = 'https://mitpress.mit.edu/9780262039246/reinforcement-learning/'
export function StudyResources({ chapter, locale }: { chapter: number; locale: Locale }) { return <ResourceLinks key={locale} chapter={chapter} locale={locale} /> }

export function LearningRoadmap({ locale, onStart }: { locale: Locale; onStart: () => void }) {
  const ko = locale === 'ko'
  const stages = ko ? [
    ['수학 기반', '확률·조건부확률·기댓값·선형대수·미분·최적화·Markov 성질', '작은 전이 행렬과 보상 기댓값을 손으로 계산하세요.', '외부 교재에서 벡터 곱과 미분을 연습하세요.'],
    ['MDP와 가치', '상태·행동·보상·정책·Bellman 방정식·정책 평가와 개선', '3×3 맵을 만들고 상태에 목표 수집 이력이 필요한 이유를 설명하세요.', '할인율을 바꾸고 미래 보상의 변화를 관찰하세요.'],
    ['표 기반 학습', 'DP → Monte Carlo → TD → SARSA / Q-Learning', '계산기로 한 번의 TD 업데이트를 검산하세요.', 'DP·MC는 외부 구현으로 비교하고, 두 TD 제어 방식은 실험실에서 비교하세요.'],
    ['구현과 실험', '탐험률·학습률·재현성·평가', '위험한 지름길에서 Q-Learning과 SARSA를 여러 번 실행하세요.', '동일한 설정과 반복 횟수·성공률·실패 원인을 기록하세요.', '외부 코드로 작은 GridWorld 환경과 Q-table 학습을 직접 구현하세요.'],
    ['Deep RL', '신경망 → DQN → Policy Gradient → Actor-Critic → PPO', '외부 Python / PyTorch 환경에서 작은 DQN을 구현하세요.', 'Spinning Up에서 PPO 목표식과 정책 평가 방법을 읽으세요. 이 앱에는 이 알고리즘들이 구현되어 있지 않습니다.'],
    ['연구로 확장', '논문 재현·환경 설계·비교·실패 분석', '논문 하나를 골라 설정·seed·평가 방법을 재현하세요.', '요소 하나만 바꾸는 비교 실험과 실패 사례를 보고하세요.'],
  ] : [
    ['Mathematical foundations', 'Probability, conditional probability, expectation, linear algebra, derivatives, optimization, Markov property', 'Calculate a small transition matrix and expected reward by hand.', 'Practice vector products and differentiation with an external textbook.'],
    ['MDPs and values', 'State, action, reward, policy, Bellman equations, policy evaluation and improvement', 'Build a 3×3 map and explain why collected-goal history belongs in the state.', 'Vary the discount factor and inspect future reward.'],
    ['Tabular learning', 'DP → Monte Carlo → TD → SARSA / Q-Learning', 'Check a TD update with the calculator.', 'Implement DP/MC externally; compare the two TD control methods in this lab.'],
    ['Implementation and experiments', 'Exploration, learning rate, reproducibility, evaluation', 'Repeat Q-Learning and SARSA on Risky Shortcut.', 'Record settings, repetitions, success rates and failure causes.', 'Implement a small GridWorld and Q-table learning loop in external code.'],
    ['Deep RL', 'Neural networks → DQN → Policy Gradient → Actor-Critic → PPO', 'Implement a small DQN externally in Python / PyTorch.', 'Read Spinning Up on PPO objectives and evaluation. These algorithms are not implemented in this app.'],
    ['Towards research', 'Reproduction, environment design, comparison, failure analysis', 'Reproduce one paper’s settings, seeds and evaluation procedure.', 'Run an ablation changing one element and report failures.'],
  ]
  return <section id="learning-roadmap" className="learning-roadmap" tabIndex={-1}><h2>{ko ? '다음 단계 · 학습 로드맵' : 'Next steps · Learning roadmap'}</h2><p>{ko ? '2–4단계의 GridWorld·TD 제어 실습은 이 앱에서, 수학·DP·MC·Deep RL 구현과 논문 재현은 외부 학습 환경에서 진행하세요.' : 'Use this app for GridWorld and TD control experiments in stages 2–4. Use external tools for mathematics, DP/MC, deep RL and paper reproduction.'}</p>
    <ol>{stages.map(([title, description, ...tasks], index) => <li key={title}><h3>{title}</h3><p>{description}</p><ul>{tasks.map(task => <li key={task}>{task}</li>)}</ul><ResourceLinks key={locale} locale={locale} stage={index} /></li>)}</ol>
    <p><a href={book} target="_blank" rel="noopener noreferrer">Sutton & Barto (2018), 2nd ed.</a> · {ko ? '입문 교재 · 2–6장' : 'Introductory textbook · Chapters 2–6'}</p>
    <p><a href={silver} target="_blank" rel="noopener noreferrer">David Silver · UCL Reinforcement Learning Course</a> · {ko ? '공개 강의 · 이론에서 제어까지' : 'Open lectures · theory to control'}</p>
    <p><a href="https://gymnasium.farama.org/introduction/train_agent/" target="_blank" rel="noopener noreferrer">Farama Foundation · Gymnasium, Training an Agent</a> · {ko ? '공식 외부 실습 · Blackjack Q-learning' : 'Official external practice · Blackjack Q-learning'}</p>
    <p><a href="https://docs.pytorch.org/tutorials/intermediate/reinforcement_q_learning.html" target="_blank" rel="noopener noreferrer">PyTorch · Reinforcement Learning (DQN) Tutorial</a> · {ko ? '심화 외부 실습 · 신경망 가치 근사' : 'Advanced external practice · neural value approximation'}</p>
    <p><a href="https://spinningup.openai.com/en/latest/spinningup/spinningup.html" target="_blank" rel="noopener noreferrer">Joshua Achiam (2018), Spinning Up as a Deep RL Researcher</a> · {ko ? '심화 로드맵·구현·연구 방법' : 'Advanced curriculum, implementation and research practice'}</p><button className="primary-button" onClick={onStart}>{ko ? 'GridWorld 실습 시작' : 'Start a GridWorld experiment'}</button>
  </section>
}
