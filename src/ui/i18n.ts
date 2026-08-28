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
  }
  stats: {
    heading: string
    episode: string
    totalReward: string
    episodeLength: string
    successRate: string
  }
  rewardChart: {
    empty: string
    heading: string
    ariaLabel: string
  }
  envEditor: {
    heading: string
    width: string
    height: string
    modeWall: string
    modeStart: string
    modeGoal: string
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
  qvalues: { empty: 'Select a State in the Grid.', heading: 'Q-values' },
  stats: {
    heading: 'Statistics',
    episode: 'Episode',
    totalReward: 'Total Reward',
    episodeLength: 'Episode Length',
    successRate: 'Success Rate',
  },
  rewardChart: { empty: 'No reward history yet.', heading: 'Reward History', ariaLabel: 'Reward history chart' },
  envEditor: {
    heading: 'Environment Editor',
    width: 'Width',
    height: 'Height',
    modeWall: 'wall',
    modeStart: 'start',
    modeGoal: 'goal',
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
  },
  stats: {
    heading: '통계',
    episode: '에피소드',
    totalReward: '총 보상',
    episodeLength: '에피소드 길이',
    successRate: '성공률',
  },
  rewardChart: { empty: '보상 기록이 아직 없습니다.', heading: '보상 기록', ariaLabel: '보상 기록 차트' },
  envEditor: {
    heading: '환경 편집기',
    width: '너비',
    height: '높이',
    modeWall: '벽',
    modeStart: '시작',
    modeGoal: '목표',
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
}

export function translateValidationError(message: string, locale: Locale): string {
  if (locale === 'en') return message
  return VALIDATION_ERROR_TRANSLATIONS[message] ?? message
}
