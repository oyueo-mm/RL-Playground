// Phase 13 — minimal, dependency-free i18n. A plain lookup dictionary (Locale ->
// Dictionary), not a library: every component that displays translatable text takes an
// optional `t: Dictionary` prop that defaults to `translations.en`, so existing callers/
// tests that don't pass `t` keep rendering exactly the current English text unchanged.
//
// Deliberately NOT translated (see Phase 13 report "번역 범위" for the full list):
// data-testid values, the "RL Playground" app title and "GridWorld" environment name
// (proper nouns), StateKey/action-index internals, and algorithm/environment ids.

import { MAX_SIZE, MIN_SIZE } from '../viz/controls/envEditorDraft'

export type Locale = 'en' | 'ko'

export interface Dictionary {
  language: {
    selectorLabel: string
  }
  playback: {
    step: string
    run: string
    runEpisode: string
    pause: string
    resume: string
    reset: string
    /** Phase 15 — label for the Episode count input, next to Run Episode. */
    episodeCount: string
  }
  overlay: {
    policy: string
    value: string
  }
  envToggle: {
    show: string
    hide: string
  }
  speed: {
    label: string
    slow: string
    normal: string
    fast: string
    veryFast: string
  }
  epsilon: {
    /** e.g. "Epsilon (ε)" — the dynamic "About 10% exploration" part is built by
     * describeEpsilon() below, kept out of the plain-string Dictionary since its content
     * depends on the current value, not just the locale. */
    label: string
  }
  /** Phase 22 — same pattern as epsilon above: label is a plain string, the dynamic
   * description text is built by describeAlpha()/describeGamma() below. */
  alpha: {
    label: string
  }
  gamma: {
    label: string
  }
  /**
   * Phase 23 — "Q-Learning"/"SARSA" themselves are proper algorithm names and are
   * deliberately NOT translated (kept as literal English in both locales, alongside the
   * displayName lookup in AlgorithmSelector.tsx); only the surrounding label and the
   * short per-algorithm description are localized.
   */
  algorithm: {
    label: string
    qLearningDescription: string
    sarsaDescription: string
  }
  inspector: {
    empty: string
    state: string
    action: string
    exploration: string
    exploitation: string
    candidates: string
    reward: string
    tdTarget: string
    tdError: string
    estimate: string
  }
  qvalues: {
    empty: string
    heading: string
    /** Phase 19 — argmax_a Q(s,a)'s action, for the selected State. */
    greedyAction: string
    /** Phase 19 — max_a Q(s,a) itself (same quantity ValueHeatmap.tsx already renders as
     * color), for the selected State. */
    greedyValue: string
  }
  stats: {
    heading: string
    episode: string
    totalReward: string
    episodeLength: string
    successRate: string
    /** Phase 21 — Episode Statistics additions. */
    latestEpisodeHeading: string
    latestEpisodeEmpty: string
    episodeHistoryHeading: string
    episodeHistoryEmpty: string
    steps: string
    termination: string
    terminationGoal: string
    terminationBomb: string
    terminationOther: string
    exploration: string
    exploitation: string
    explorationRate: string
    /** Phase 24 — exploitationCount / steps, derived in StatsPanel.tsx (never stored in
     * Core — the invariant explorationCount + exploitationCount === steps, already
     * established by Phase 21, makes this 1 - explorationRate). */
    exploitationRate: string
    averageReward: string
    uniqueStates: string
    /** Phase 24 — detail card for whichever Episode History row is selected. */
    episodeDetailHeading: string
    episodeDetailEmpty: string
  }
  rewardChart: {
    empty: string
    heading: string
    /** Phase 19 — axis explanations, e.g. "X: Episode". */
    xAxisLabel: string
    yAxisLabel: string
    /** Phase 19 — one short sentence under the chart. */
    description: string
    ariaLabel: string
    /** Phase 24 — label shown next to the highlighted point's Episode number, when
     * StatsPanel's Episode History has a selected row. */
    selectedEpisodeLabel: string
  }
  /**
   * Phase 25 — three small trend charts (Total Reward / Steps / Exploration Rate) over
   * `episodeStatsHistory`, complementing (not replacing) the single Reward Chart above.
   * `xAxisLabel`/`totalRewardYAxisLabel`/`stepsYAxisLabel`/`explorationRateYAxisLabel`
   * intentionally reuse existing strings (rewardChart.xAxisLabel/yAxisLabel, stats.steps,
   * stats.explorationRate) rather than duplicating them — see LearningProgress.tsx.
   */
  learningProgress: {
    heading: string
    empty: string
    totalRewardDescription: string
    totalRewardAriaLabel: string
    stepsDescription: string
    stepsAriaLabel: string
    explorationRateDescription: string
    explorationRateAriaLabel: string
  }
  /**
   * Phase 26 — the selected Episode's full step-by-step trajectory (state → action →
   * reward → nextState). Column headers reuse `inspector.state`/`inspector.action`/
   * `inspector.reward` (same meaning, already established in Phase 4); `stats.episode`/
   * `stats.steps`/`stats.termination`/`stats.terminationGoal`/`terminationBomb`/
   * `terminationOther` are reused for the summary line — only truly new strings live here.
   */
  episodeTrajectory: {
    heading: string
    empty: string
    start: string
    step: string
    nextState: string
    ariaLabelPrefix: string
    showAll: string
    showFewer: string
  }
  envEditor: {
    heading: string
    width: string
    height: string
    modeWall: string
    modeStart: string
    modeGoal: string
    /** Phase 20 — Bomb edit mode button label. */
    modeBomb: string
    /** Phase 20 — label for the Bomb penalty reward number input. */
    bombPenalty: string
    draftPreview: string
    apply: string
    applyConfirm: string
  }
}

const en: Dictionary = {
  language: { selectorLabel: 'Language' },
  playback: {
    step: 'Step',
    run: 'Run',
    runEpisode: 'Run Episode',
    pause: 'Pause',
    resume: 'Resume',
    reset: 'Reset',
    episodeCount: 'Episodes',
  },
  overlay: { policy: 'Policy', value: 'Value' },
  envToggle: { show: 'Edit Environment', hide: 'Hide Environment Editor' },
  speed: { label: 'Speed:', slow: 'Slow', normal: 'Normal', fast: 'Fast', veryFast: 'Very Fast' },
  epsilon: { label: 'Epsilon (ε)' },
  alpha: { label: 'Alpha (α)' },
  gamma: { label: 'Gamma (γ)' },
  algorithm: {
    label: 'Algorithm',
    qLearningDescription: 'Off-policy — learns from the best possible next action',
    sarsaDescription: 'On-policy — learns from the action actually taken next',
  },
  inspector: {
    empty: 'Run Step to see the update details.',
    state: 'State',
    action: 'Action',
    exploration: 'exploration',
    exploitation: 'exploitation',
    candidates: 'candidates:',
    reward: 'Reward',
    tdTarget: 'TD Target',
    tdError: 'TD Error',
    estimate: 'Estimate',
  },
  qvalues: {
    empty: 'Select a State in the Grid.',
    heading: 'Q-values',
    greedyAction: 'Greedy Action',
    greedyValue: 'Greedy Value',
  },
  stats: {
    heading: 'Statistics',
    episode: 'Episode',
    totalReward: 'Total Reward',
    episodeLength: 'Episode Length',
    successRate: 'Success Rate',
    latestEpisodeHeading: 'Latest Episode',
    latestEpisodeEmpty: 'No Episode completed yet.',
    episodeHistoryHeading: 'Episode History',
    episodeHistoryEmpty: 'No Episode completed yet.',
    steps: 'Steps',
    termination: 'Termination',
    terminationGoal: 'Goal',
    terminationBomb: 'Bomb',
    terminationOther: 'Other',
    exploration: 'Exploration',
    exploitation: 'Exploitation',
    explorationRate: 'Exploration Rate',
    exploitationRate: 'Exploitation Rate',
    averageReward: 'Average Reward',
    uniqueStates: 'Unique States',
    episodeDetailHeading: 'Episode Detail',
    episodeDetailEmpty: 'Select an Episode from the History to see details.',
  },
  rewardChart: {
    empty: 'No reward history yet.',
    heading: 'Reward History',
    ariaLabel: 'Reward history chart',
    xAxisLabel: 'Episode',
    yAxisLabel: 'Total Reward',
    description: "Each point is one completed Episode's Total Reward.",
    selectedEpisodeLabel: 'Selected Episode',
  },
  learningProgress: {
    heading: 'Learning Progress',
    empty: 'No Episode completed yet.',
    totalRewardDescription: "Each point is one completed Episode's Total Reward.",
    totalRewardAriaLabel: 'Total Reward per Episode chart',
    stepsDescription: 'Each point is the number of Steps taken in one completed Episode.',
    stepsAriaLabel: 'Steps per Episode chart',
    explorationRateDescription:
      'Each point is the fraction of Steps that were Exploration in one completed Episode.',
    explorationRateAriaLabel: 'Exploration Rate per Episode chart',
  },
  episodeTrajectory: {
    heading: 'Episode Trajectory',
    empty: 'Select an Episode from the History to see its trajectory.',
    start: 'Start',
    step: 'Step',
    nextState: 'Next State',
    ariaLabelPrefix: 'Trajectory for Episode',
    showAll: 'Show all steps',
    showFewer: 'Show fewer steps',
  },
  envEditor: {
    heading: 'Environment Editor',
    width: 'Width',
    height: 'Height',
    modeWall: 'wall',
    modeStart: 'start',
    modeGoal: 'goal',
    modeBomb: 'bomb',
    bombPenalty: 'Bomb Penalty',
    draftPreview: 'Draft preview (not applied yet)',
    apply: 'Apply Environment',
    applyConfirm: 'Applying this environment will reset the current Q-table, episode count, and statistics. Continue?',
  },
}

const ko: Dictionary = {
  language: { selectorLabel: '언어' },
  playback: {
    step: '스텝',
    run: '실행',
    runEpisode: '에피소드 실행',
    pause: '일시정지',
    resume: '재개',
    reset: '초기화',
    episodeCount: '에피소드 수',
  },
  overlay: { policy: '정책', value: '가치' },
  envToggle: { show: '환경 편집', hide: '환경 편집기 닫기' },
  speed: { label: '속도:', slow: '느림', normal: '보통', fast: '빠름', veryFast: '매우 빠름' },
  epsilon: { label: '엡실론 (ε)' },
  alpha: { label: '알파 (α)' },
  gamma: { label: '감마 (γ)' },
  algorithm: {
    label: '알고리즘',
    qLearningDescription: '오프-정책 — 다음에 가능한 최선의 Action을 기준으로 학습',
    sarsaDescription: '온-정책 — 실제로 선택한 다음 Action을 기준으로 학습',
  },
  inspector: {
    // Pre-existing text (unchanged) — was already the hardcoded default before Phase 13.
    empty: 'Step을 실행하면 업데이트 정보가 표시됩니다.',
    state: '상태',
    action: '행동',
    exploration: '탐험',
    exploitation: '활용',
    candidates: '후보 값:',
    reward: '보상',
    tdTarget: 'TD 목표값',
    tdError: 'TD 오차',
    estimate: '추정값',
  },
  qvalues: {
    // Pre-existing text (unchanged) — was already the hardcoded default before Phase 13.
    empty: 'Grid에서 State를 선택하세요.',
    heading: 'Q-값',
    greedyAction: '탐욕적 행동',
    greedyValue: '탐욕적 가치',
  },
  stats: {
    heading: '통계',
    episode: '에피소드',
    totalReward: '총 보상',
    episodeLength: '에피소드 길이',
    successRate: '성공률',
    latestEpisodeHeading: '최근 Episode',
    latestEpisodeEmpty: '아직 완료된 Episode가 없습니다.',
    episodeHistoryHeading: 'Episode 기록',
    episodeHistoryEmpty: '아직 완료된 Episode가 없습니다.',
    steps: 'Step 수',
    termination: '종료 원인',
    terminationGoal: 'Goal',
    terminationBomb: 'Bomb',
    terminationOther: '기타',
    exploration: '탐험',
    exploitation: '활용',
    explorationRate: '탐험 비율',
    exploitationRate: '활용 비율',
    averageReward: '평균 보상',
    uniqueStates: '고유 State 수',
    episodeDetailHeading: 'Episode 상세',
    episodeDetailEmpty: 'History에서 Episode를 선택하면 상세 정보가 표시됩니다.',
  },
  rewardChart: {
    empty: '보상 기록이 아직 없습니다.',
    heading: '보상 기록',
    ariaLabel: '보상 기록 차트',
    xAxisLabel: '에피소드',
    yAxisLabel: '총 보상',
    description: '각 점은 완료된 한 Episode의 총 보상을 나타냅니다.',
    selectedEpisodeLabel: '선택된 Episode',
  },
  learningProgress: {
    heading: '학습 진행 상황',
    empty: '아직 완료된 Episode가 없습니다.',
    totalRewardDescription: '각 점은 완료된 한 Episode의 총 보상을 나타냅니다.',
    totalRewardAriaLabel: 'Episode별 총 보상 차트',
    stepsDescription: '각 점은 완료된 한 Episode에서 진행된 Step 수를 나타냅니다.',
    stepsAriaLabel: 'Episode별 Step 수 차트',
    explorationRateDescription: '각 점은 완료된 한 Episode에서 탐험(Exploration)이 차지한 Step 비율을 나타냅니다.',
    explorationRateAriaLabel: 'Episode별 탐험 비율 차트',
  },
  episodeTrajectory: {
    heading: 'Episode 경로',
    empty: 'History에서 Episode를 선택하면 이동 경로가 표시됩니다.',
    start: '시작',
    step: 'Step',
    nextState: '다음 State',
    ariaLabelPrefix: 'Episode 경로 — Episode',
    showAll: '모든 Step 보기',
    showFewer: 'Step 접기',
  },
  envEditor: {
    heading: '환경 편집기',
    width: '너비',
    height: '높이',
    modeWall: '벽',
    modeStart: '시작',
    modeGoal: '목표',
    modeBomb: '폭탄',
    bombPenalty: '폭탄 페널티',
    draftPreview: '초안 미리보기 (아직 적용되지 않음)',
    apply: '환경 적용',
    applyConfirm: '이 환경을 적용하면 현재 Q-table, 에피소드 수, 통계가 초기화됩니다. 계속하시겠습니까?',
  },
}

export const translations: Record<Locale, Dictionary> = { en, ko }

// GRIDWORLD_ACTION_LABELS ('Up'/'Down'/'Left'/'Right', src/viz/grid/actionLabels.ts) stay
// untranslated at the source — they double as data-testid suffixes (`qvalue-row-up`, ...)
// and must never change. This is a purely-for-display translation layered on top; when a
// label isn't recognized (shouldn't happen for GridWorld) it falls back to the original.
const ACTION_LABEL_TRANSLATIONS: Record<Locale, Record<string, string>> = {
  en: { Up: 'Up', Down: 'Down', Left: 'Left', Right: 'Right' },
  ko: { Up: '위', Down: '아래', Left: '왼쪽', Right: '오른쪽' },
}

export function translateActionLabel(label: string, locale: Locale): string {
  return ACTION_LABEL_TRANSLATIONS[locale][label] ?? label
}

// envEditorDraft.ts's validateDraft() intentionally keeps returning plain English
// messages unchanged (it's a Core-adjacent pure-function module with its own tests
// asserting those exact strings) — this maps those exact strings to a Korean display
// string. Falls back to the original English message for any unmapped/unknown string.
const VALIDATION_ERROR_TRANSLATIONS: Record<string, string> = {
  [`Width must be a whole number between ${MIN_SIZE} and ${MAX_SIZE}.`]: `너비는 ${MIN_SIZE}에서 ${MAX_SIZE} 사이의 정수여야 합니다.`,
  [`Height must be a whole number between ${MIN_SIZE} and ${MAX_SIZE}.`]: `높이는 ${MIN_SIZE}에서 ${MAX_SIZE} 사이의 정수여야 합니다.`,
  'Start is outside the grid.': 'Start가 grid 밖에 있습니다.',
  'Goal is outside the grid.': 'Goal이 grid 밖에 있습니다.',
  'Start and Goal cannot be the same cell.': 'Start와 Goal은 같은 칸일 수 없습니다.',
  'Start cannot be a wall.': 'Start는 벽이 될 수 없습니다.',
  'Goal cannot be a wall.': 'Goal은 벽이 될 수 없습니다.',
  'One or more walls are outside the grid.': '하나 이상의 벽이 grid 밖에 있습니다.',
  'Start cannot be a bomb.': 'Start는 폭탄이 될 수 없습니다.',
  'Goal cannot be a bomb.': 'Goal은 폭탄이 될 수 없습니다.',
  'One or more bombs are outside the grid.': '하나 이상의 폭탄이 grid 밖에 있습니다.',
  'Bomb penalty must be a number.': '폭탄 페널티는 숫자여야 합니다.',
}

export function translateValidationError(message: string, locale: Locale): string {
  if (locale === 'en') return message
  return VALIDATION_ERROR_TRANSLATIONS[message] ?? message
}

/**
 * Phase 18 — a short, beginner-friendly sentence explaining what the current epsilon
 * value means (PRODUCT_SPEC-adjacent UX goal: don't just show a bare number). Kept as a
 * function rather than a Dictionary string since its content depends on the current
 * value, not just the locale — same reasoning as translateActionLabel/
 * translateValidationError above.
 */
export function describeEpsilon(epsilon: number, locale: Locale): string {
  if (epsilon <= 0) return locale === 'ko' ? '탐험 없음 — 완전히 Greedy' : 'No exploration — fully greedy'
  if (epsilon >= 1) return locale === 'ko' ? '항상 Exploration' : 'Always exploring'
  const percent = Math.round(epsilon * 100)
  return locale === 'ko' ? `약 ${percent}% 확률로 Exploration` : `About ${percent}% exploration`
}

/**
 * Phase 22 — same reasoning/pattern as describeEpsilon() above: α (learning rate)
 * controls how strongly a new experience overwrites the current Q-value estimate
 * (Q_new = Q_old + α·(target - Q_old), unchanged in qLearning.ts/sarsa.ts — this
 * function only describes that existing rule, it doesn't implement anything new).
 */
export function describeAlpha(alpha: number, locale: Locale): string {
  if (alpha <= 0) return locale === 'ko' ? '새로운 경험을 학습에 반영하지 않음' : 'New experience is not learned at all'
  if (alpha >= 1) return locale === 'ko' ? '새로운 경험이 이전 추정값을 완전히 대체함' : 'New experience fully overwrites the old estimate'
  const percent = Math.round(alpha * 100)
  return locale === 'ko' ? `새로운 경험을 약 ${percent}% 반영` : `New experience blended in at about ${percent}%`
}

/**
 * Phase 22 — γ (discount factor) controls how much a future reward counts toward the
 * current TD target (target = r + γ·max/Q(s',·), unchanged in qLearning.ts/sarsa.ts —
 * again, description only, no new computation).
 */
export function describeGamma(gamma: number, locale: Locale): string {
  if (gamma <= 0) return locale === 'ko' ? '현재 보상만 고려' : 'Only the immediate reward matters'
  if (gamma >= 1) return locale === 'ko' ? '미래 보상을 현재 보상만큼 중요하게 취급' : 'Future reward matters as much as immediate reward'
  const percent = Math.round(gamma * 100)
  return locale === 'ko' ? `미래 보상을 약 ${percent}% 반영` : `About ${percent}% weight on future reward`
}

/**
 * Phase 26 — same reasoning/pattern as describeEpsilon/Alpha/Gamma above: the count of
 * steps actually shown in the Episode Trajectory detail table depends on the current
 * value (how long the selected Episode was), not just the locale.
 */
export function describeTrajectoryTruncation(shown: number, total: number, locale: Locale): string {
  return locale === 'ko'
    ? `전체 ${total} Step 중 처음 ${shown}개를 표시하고 있습니다.`
    : `Showing the first ${shown} of ${total} steps.`
}
