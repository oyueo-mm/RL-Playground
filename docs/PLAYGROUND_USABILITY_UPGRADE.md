# 학습 안정화·직접 플레이·프리셋·교육 UX 통합 개선

검증일: 2026-10-25. Windows, Node.js 24.19.0 / npm 11.17.0, Microsoft Edge 156 / Playwright headless Chromium. 작업 브랜치 `feat/home-redesign`, 시작 기준 `535c33d`.

## 1. 변경 요약

상세 기록 보관량과 누적 학습량을 분리했다. 오래된 경로만 정리하고 학습은 계속한다. 공통 닫기 가능한 알림, 초안의 독립 직접 플레이, 개방형 복합 프리셋, 가이드 이전/다음 탐색·출처·로드맵, 홈 2×2 동시 시연을 추가했다.

Q-Learning/SARSA 식, SARSA 다음 행동 캐시, 희소 Q-table, 상태 키, 실제 환경 전이, 기본 250회 학습, 기존 16개 프리셋, JSON v1/v2와 실험 화면 전환 상태 보존을 유지했다.

## 2. 500,000 step 중단 원인

기존 `SimulationEngine.atResourceBoundary()`는 Q 상태 예산 외에 `recordedSteps >= maxRecordedSteps`를 중단 조건으로 사용했다. 상세 기록을 제거하는 구조가 없어서 기본 500,000개의 전이를 저장하면 Scheduler가 종료되고 상태가 `paused`가 됐다. 이는 학습 알고리즘의 수렴 조건이나 에피소드 수 제한이 아니었다.

해당 중단 조건을 제거하고 실제 Q 상태 경계만 일시정지 조건으로 유지했다. 기본 제한값을 늘리는 방식으로 우회하지 않았다.

## 3. 상세 기록 보존 구조

- `totalSteps`, 누적 보상·성공 수·성공률·탐험/활용 수·종료 원인 집계는 기록 정리와 독립적이다. Stop으로 현재 에피소드를 중단해도 이미 실행한 누적 step은 감소하지 않는다.
- 기본 상세 보관량은 **500,000 step**, 완료 에피소드 상세 경로는 **최근 최대 100회**다. 두 값은 고급 설정에서 변경할 수 있다.
- 완료 기록 큐는 head cursor를 가진 FIFO다. 오래된 경로를 정리할 때 매 step마다 `Array.shift()`하지 않는다. cursor가 충분히 진행하면 큐를 일괄 압축한다.
- 보관량에는 진행 중 에피소드의 상세 전이도 포함한다. 완료 경로부터 정리하고, 단일 에피소드 자체가 한도를 넘으면 앞부분만 보관하고 `partial`로 표시한다. 학습·보상 집계·TD 업데이트는 계속한다.
- 이전에 발행한 스냅샷을 변경하지 않도록 정리된 에피소드는 빈 경로와 `evicted` 상태를 가진 새 요약 객체로 교체한다.
- 최근 요약은 최대 10,000회다. 10,001회에서 1,000개씩 일괄 정리해 배열 재배치 비용을 분산한다. 따라서 9,001–10,000개 요약을 보관한다. 누적 총계는 별도로 유지한다.

이는 엔진이 소유한 기록의 상한이다. 사용자가 외부 전체 스냅샷을 계속 저장하면 그 외부 메모리까지 제한할 수는 없다. React의 숨긴 패널은 이전 불변 창을 잠시 참조할 수 있으며, 실제 브라우저 GC 계측을 별도로 제공한다.

## 4. 분석 및 경로 재생 호환성

Reward Chart와 Learning Progress는 실제 에피소드 번호를 사용한 최근 요약 창이다. 이를 전체 세션의 개별 기록이라고 표시하지 않는다. 종료 원인 그래프는 누적 집계, 성공률은 누적 성공 수/완료 수다. 탐험/활용 누적 수도 분석 패널에 표시한다.

에피소드의 목표 수집 수를 요약에 저장해 상세 경로가 없어져도 0개로 잘못 표시하지 않는다. Step Viewer의 목표 마스크 계산은 BigInt로 바꿔 32비트 이후의 목표도 정확하게 센다.

만료/부분 경로에는 재생 불가 메시지를 표시하고 Step Viewer와 격자 경로 오버레이를 제공하지 않는다. 요약까지 보관 창을 벗어나면 별도 안내를 표시한다. 선택된 에피소드 번호는 유지하며 없는 경로를 복원하거나 만든 것처럼 보여주지 않는다. 숨긴 분석 화면의 방향키가 직접 플레이 입력에 반응하지 않도록 했다.

## 5. 장시간 실행 벤치마크

[브라우저 원시 결과](../benchmarks/results/after-usability-long-run.json), [반복 성능 측정](../benchmarks/results/after-usability.json), [GC 보관 비용](../benchmarks/results/after-usability-retained-costs.json).

9개 맵 모두 기본 Q 예산 100,000, 상세 step 500,000, 상세 에피소드 100, 에피소드 최대 10,000으로 500,100 step을 실행했다. α=.1, γ=.9, ε=.3, 재현 가능한 LCG seed 42다. Vitest는 실제 Scheduler를 제어 가능한 시계로 진행하고 Pause/Resume/Stop도 확인한다. 브라우저 측정은 UI 구독 없이 동기 엔진 step을 실행한 CPU/GC 측정이다. 두 측정의 초당 step을 대화형 UI 처리량으로 혼용하지 않는다.

| 맵 | 실행 / 보관 step | Q 행 | CPU ms | GC 증가 MiB |
|---|---:|---:|---:|---:|
| spiralMaze | 500,100 / 6,565 | 1,401 | 719.7 | 2.25 |
| portalNetwork | 500,100 / 905 | 429 | 784.4 | 1.98 |
| oneWayCity | 500,100 / 3,538 | 102 | 705.7 | 2.09 |
| switchFactory | 500,100 / 2,225 | 4,197 | 853.8 | 2.47 |
| collapsingRuins | 500,100 / 490,100 | 16,907 | 741.0 | 32.40 |
| multiGoalExpedition | 500,100 / 168,994 | 94,451 | 907.3 | 20.49 |
| riskyShortcut | 500,100 / 2,338 | 335 | 737.5 | 2.09 |
| giantMixedMaze | 500,100 / 4,422 | 29,492 | 864.2 | 4.03 |
| finalChallenge | 500,100 / 490,100 | 7,118 | 660.1 | 31.24 |

Q-Learning 9종 외에 SARSA도 Final Challenge에서 500,100 step을 검증한다. 작은 보관량/큰 보관량의 동일 seed 실행에서 두 알고리즘의 Q 스냅샷·TD 정보·현재 상태·누적 보상·집계가 같음을 비교한다.

Final Challenge는 이 설정의 500,100 step에서 목표 완료가 없고 시간 제한 에피소드가 발생했다. **연속 실행 성공과 학습 수렴은 다른 결과다.** 유효한 성공 행동 경로는 별도 전이 테스트로 확인했다. Multi-goal Expedition은 Q 예산에 근접하므로 더 오래 실행하면 실제 Q 경계에서 정지할 수 있다.

## 6. 자원 안전장치

실제 Q 행 예산과 현재/다음 행 예약 검사, 기본 에피소드 최대 10,000 step, 별도 `truncated` 분류, 시간 제한 전이에서의 TD bootstrapping, 8ms Scheduler 작업 구간, 가벼운 UI 투영과 갱신 제한을 유지한다. Q 예산 정지 후 값을 늘려 Resume할 수 있다. 이론 상태 조합이 크다는 이유로 적용이나 직접 플레이를 거부하지 않는다.

## 7. 공통 알림

`Notice`가 success/info/warning/error 표시와 닫기 버튼, 상태/오류 ARIA 역할을 제공한다. 자원 정지, 고급 Q 사용량 경고, 이론 복잡도 안내, 편집 오류와 JSON 오류가 이를 사용한다. 전역 큐를 만들지 않고 화면별 현재 알림 슬롯을 사용해 알림이 무제한 쌓이지 않는다. 속성 안의 안내는 문서 흐름에 배치한다.

플로팅 알림은 실험 작업 영역에 종속된다. 편집 오류는 좌하단에 표시해 우측 속성 입력과 상단 툴바·하단 확대 제어를 피한다. 사이드바 펼침/접힘은 부모 작업 영역 폭에 반영된다. 작은 화면에서는 폭과 최대 높이를 제한한다.

## 8. 닫기 및 중복 방지

같은 `eventKey`는 닫은 뒤 부모가 갱신돼도 다시 표시하지 않는다. 자원 알림 키는 정지 원인·예산·해당 step에 연결되고 닫기는 엔진 명령을 호출하지 않는다. JSON은 파일 선택 횟수를 포함해 같은 잘못된 파일을 다시 선택해도 새 사건으로 안내한다. 오류 메시지를 닫아도 검증 결과와 Apply/Play 비활성화는 유지된다. 속성에서 적용 불가 이유를 다시 읽을 수 있다.

닫기 버튼은 한국어/영어 이름을 가진 기본 button이며 Tab/Enter로 사용할 수 있다. 구조적 오류, 지원하지 않는 버전, 좌표·포털·그룹 검증은 기존 parser와 validator를 유지한다.

## 9. 직접 플레이 구조

편집 툴바의 **직접 플레이**는 검증된 미적용 초안을 복사해 새 `GridWorldEnv`를 만든다. `ManualPlay`에는 엔진·Q agent·Apply callback을 전달하지 않는다. 이동은 실제 `env.step()`을 사용하므로 Goal/Bomb/Portal/One-way/Fragile/Switch 규칙을 공유한다.

이동 수·보상·목표 수·진행/성공/Bomb, 다시 시작, 편집으로 복귀를 제공한다. 방향키/WASD, R, Escape와 4방향 터치 버튼을 지원한다. 반복 keydown, modifier 조합, 입력 필드 안의 조작은 무시한다. 키보드는 활성 화면에서만 연결한다. 모바일 메뉴가 상태 표시를 덮지 않도록 여백을 확보했다.

## 10. 학습·플레이 상태 분리

편집 컴포넌트를 언마운트하지 않고 편집 세션의 visibility만 바꾼다. 복귀 시 초안·도구·선택·100단계 Undo/Redo가 유지된다. 플레이 중 목표 수집, 붕괴, 문 개폐는 플레이 환경에만 반영된다. 재시작도 플레이 환경만 초기화한다. 실제 엔진의 상태·Q-table·보상·에피소드 기록을 건드리지 않는다.

이미 진행 중인 실제 학습을 직접 플레이가 자동 중지하지도 않는다. 그 경우 실제 학습의 독립적인 진행에 따른 수치는 계속 바뀔 수 있다. 직접 플레이 입력이 그 수치를 갱신하는 것은 아니다.

## 11. 프리셋 개선

기존 16개 정의는 변경하지 않았다. 총 25개를 유지하며 복합 9개를 감사했다. Spiral/Ruins/Giant/Final의 좁은 통로 외벽을 열린 구역과 장애물 군집으로 바꿨다. Portal은 경계 우회로, Switch는 문을 우회하는 통로, One-way는 넓어진 블록을 제공한다. Risky Shortcut은 두 목표와 위험한 직선/안전한 우회 선택을 유지한다. 이미 넓은 Multi-goal Expedition의 지형은 유지한다.

난이도를 중급·고급·실험 고난도로 구분하고 다중 목표를 요소 필터에 반영했다. 포털은 먼 구역 이동을 줄이고, 문은 짧은 통로를 열며, 붕괴 타일은 재진입할 수 없는 선택을 만든다. 우회로와 목표 방문 순서가 다른 정책을 허용한다.

참조 파일 `rl-playground-env-20x20 (2).json`은 작업 폴더와 첨부 파일에서 찾지 못했다. 이를 읽었다고 가정하거나 새 프리셋으로 등록하지 않았다. 요청에 기술된 넓은 공간·분산 장애물·복수 목표의 방향을 반영했다.

## 12. 품질 감사와 성공 경로

[전후 감사 JSON](../benchmarks/results/preset-audit-usability.json)의 baseline은 `535c33d`다. 벽 비율, 시작점 잠재 도달 영역, 갈림길, 막다른 길 비율, 목표 수와 목표 간 정적 최단 거리 행렬을 기록한다.

| 맵 | 벽 비율 전 → 후 | 잠재 도달 전 → 후 | 변경 후 갈림길 / 목표 | 성공 경로 step |
|---|---:|---:|---:|---:|
| spiralMaze | 41.7% → 6.2% | 84 → 135 | 130 / 4 | 83 |
| portalNetwork | 13.3% → 11.6% | 60 → 199 | 191 / 2 | 5 |
| oneWayCity | 56.2% → 25.0% | 112 → 192 | 175 / 2 | 27 |
| switchFactory | 19.9% → 16.8% | 157 → 163 | 138 / 4 | 13 |
| collapsingRuins | 74.7% → 14.7% | 57 → 192 | 175 / 4 | 56 |
| multiGoalExpedition | 11.2% → 11.2% | 355 → 355 | 336 / 4 | 77 |
| riskyShortcut | 6.9% → 6.9% | 298 → 298 | 288 / 2 | 29 |
| giantMixedMaze | 91.2% → 14.2% | 4 → 343 | 327 / 3 | 40 |
| finalChallenge | 88.2% → 12.0% | 9 → 352 | 337 / 4 | 44 |

표의 도달/갈림길은 **정적 벽만 고려하는 잠재 기하 구조**다. 포털 점프·닫힌 문·붕괴·방향 제약을 포함한 실제 상태 탐색 결과와 다르다. 예를 들어 이전 Portal/Giant/Final은 포털로 연결되므로 작은 정적 도달 숫자만으로 해결 불가라고 판정하지 않는다.

동적 해결 가능성은 `complexPresets.test.ts`에서 제공된 행동 경로를 실제 GridWorldEnv로 재생하고 마지막 행동에서만 모든 목표를 완료함을 확인한다. 모든 맵은 구조 검증과 JSON 왕복을 통과한다. 무한 상태 탐색을 하지 않으며, 제한된 탐색 예산 초과는 기존처럼 unknown으로 취급한다. 개별 포털·스위치·붕괴의 반사실적 최적 경로 차이까지 전수 최적화한 것은 아니다.

## 13. 가이드 탐색·출처·로드맵

6개 단원과 계산기를 유지하고 참고 자료 뒤에 이전/다음 버튼을 추가했다. 전환 시 상단으로 이동하고 단원 제목에 초점을 준다. 목차를 불투명한 일반 흐름에 배치해 본문 위 sticky 겹침을 제거했다. 마지막 단원에서 독립 로드맵으로 이동할 수 있다.

각 단원은 해당 주제의 Sutton/Barto 장과 다른 공식 강의 PDF를 연결한다. Q-learning에는 Watkins/Dayan 원 논문 서지·출판사 링크, 비교 단원에는 알고리즘 분류 자료를 추가했다. 링크는 새 탭 및 `noopener noreferrer`를 사용한다.

확인한 출처는 [MIT Press 서지](https://mitpress.mit.edu/9780262039246/reinforcement-learning/), [출판사 목차](https://mitpress.ublish.com/book/reinforcement-learning-an-introduction-2), [Silver 공식 강의 및 PDF](https://www.davidsilver.uk/teaching/), [Watkins & Dayan (1992) 대학 서지](https://pure.royalholloway.ac.uk/en/publications/q-learning/), [Spinning Up 분류](https://spinningup.openai.com/en/latest/spinningup/rl_intro2.html), [Achiam 연구 로드맵](https://spinningup.openai.com/en/latest/spinningup/spinningup.html), [Farama Q-learning 실습](https://gymnasium.farama.org/introduction/train_agent/), [PyTorch DQN 실습](https://docs.pytorch.org/tutorials/intermediate/reinforcement_q_learning.html)이다. 일부 책 원문 PDF와 저자 사이트는 크기 제한/timeout으로 가져오지 못해 전체 원문을 읽었다고 주장하지 않는다. 서지와 목차 및 연결한 공식 강의·문서의 관련성을 확인했다.

로드맵은 수학 → MDP/Bellman/정책 평가·개선 → DP/MC/TD/두 제어 알고리즘 → 구현·반복 실험 → DQN/PG/AC/PPO → 논문 재현·실험 설계·실패 분석의 6단계다. 단계당 2–3개 과제와 앱 안/외부 도구 실습 구분, 입문 교재·공개 강의·공식 실습·심화 자료를 양 언어로 제공한다. 미구현 알고리즘을 앱 기능으로 소개하지 않는다.

## 14. 홈 동시 시연

기본 탐색·포털·스위치·붕괴를 2×2로 동시에 표시한다. 각 시나리오는 별도 GridWorldEnv의 검증된 전이 프레임과 독립 반복 인덱스를 가진다. 공유 650ms 타이머 하나가 각 경로를 진행시키고 완료 후 잠시 머물렀다가 각각 재시작한다. 포털 점프는 격자를 가로지르는 이동 보간을 하지 않는다.

전역 Pause/Play/Step/Reset과 탐색/경로 활용 비교를 유지한다. 긴 설명은 기본적으로 닫힌 접근 가능한 도움말로 옮기고 작은 설명용 시연 배지를 남겼다. 실제 학습 결과로 표시하지 않는다. reduced motion은 처음부터 정지하며, 문서 비활성·관찰 영역 밖에서는 타이머를 중단하고 홈에서 나가면 listener/observer/timer를 해제한다. 실제 학습 엔진은 사용하지 않는다.

## 15. UI 성능과 반응형

기존 7/14/20 격자의 10초×2회 브라우저 벤치마크를 재실행했다. 약 6,000 step/s의 프레임 제한 실행을 유지한다. 50,000 Q 행에서 전체 스냅샷 약 5.06ms, 400셀 UI 투영 약 .069ms가 측정됐으며 이를 전체 학습 속도 향상 배수로 해석하지 않는다.

기존 100,000 실행 step의 기록 유지 측정은 100,000개 전이, GC 증가량 7,711,532 bytes였다. 새 측정은 동일 실행 수에서 최근 100회 정책으로 1,205개 전이와 최근 요약을 보관하며 증가량 1,253,772 bytes였다. 이는 **다른 보관 정책의 실제 비용** 비교이며 전이 객체 하나의 메모리가 줄었다는 뜻이 아니다. `bytesPerInputItem`의 분모도 실행 입력 수다. 이전 결과는 과거 측정이며 완전한 동일 시점 대조군은 아니다.

프로덕션 UI에서는 데스크톱/모바일 30초 실행, 5초 간격 heap·행·step 표본, rAF 간격, Pause/Resume/Stop 응답과 화면 10회 왕복 후 GC를 기록한다. UI 동작 측정과 동기 CPU 벤치마크를 분리했다. 실행 중 읽은 Q 행 수는 Stop 클릭 전 추가될 수 있으므로 정지 후 값이 감소하지 않고 안정적인지 검증하며, 값 자체의 정확한 보존은 동기 코어 테스트로 비교한다.

1366×768, 1440×900, 1920×1080, 768×1024, 390×844에서 홈·가이드·직접 플레이·오류 알림과 기존 실험 격자/도구 동작을 확인한다. 모바일은 Edge Chromium 에뮬레이션이며 실제 iOS Safari 기기 검증은 아니다.

## 16. 테스트 결과

- `npm run lint`: 오류/경고 0.
- `npm test`: **64개 파일, 1,207개 테스트 통과**, 약 39초. skip 없음.
- `npm run build`: TypeScript + Vite 성공. JS 398.19 kB / gzip 124.32 kB, CSS 57.04 kB / gzip 13.19 kB.
- `npm run test:e2e`: **30개 통과**, 약 56.5초. 데스크톱/모바일.
- `npm run benchmark`: **3개 통과**, 약 1.3분. Risky Shortcut 최종 수정 후 9종 장시간 측정도 추가로 재실행해 1개 통과(약 12.8초).
- `git diff --check`: 통과.

브라우저 UI 원시 표본: [desktop](../benchmarks/results/after-usability-ui-desktop.json), [mobile](../benchmarks/results/after-usability-ui-mobile.json). 제어 가능한 시계의 Scheduler 결과: [별도 JSON](../benchmarks/results/after-usability-scheduler.json).

신규 테스트는 보관 정책에 무관한 Q/SARSA 결과, 불변 과거 스냅샷, 최근 요약/누적 총계, 상세 경로 만료 후 선택, 50만 step 초과 Scheduler/브라우저 실행, 직접 플레이 모든 지형과 Bomb/키보드/초안/Undo 보존, 오류 닫기 후 차단 유지와 같은 파일 재시도, BigInt 목표, 네 동시 시연과 reduced motion, 프리셋 구조 감사/실제 해결 경로를 포함한다.

기존 테스트를 삭제하지 않았다. 과거의 500개 상세 경로 무제한 보관 기대, 기록 예산 강제 정지 기대, 단일 시연 선택자를 새 요구에 맞춰 변경했다. 장시간 E2E에서 실행 중 Q 수를 읽은 시점과 Stop 시점 사이의 증가를 동일 값으로 비교하던 경쟁도 수정했다.

## 17. 브라우저 스크린샷

| Viewport | 홈 동시 시연 | 직접 플레이 | 오류 알림 | 로드맵 |
|---|---|---|---|---|
| 1366x768 | [보기](screenshots/usability-gallery-1366x768.png) | [보기](screenshots/usability-manual-1366x768.png) | [보기](screenshots/usability-notice-1366x768.png) | [보기](screenshots/usability-roadmap-1366x768.png) |
| 1440x900 | [보기](screenshots/usability-gallery-1440x900.png) | [보기](screenshots/usability-manual-1440x900.png) | [보기](screenshots/usability-notice-1440x900.png) | [보기](screenshots/usability-roadmap-1440x900.png) |
| 1920x1080 | [보기](screenshots/usability-gallery-1920x1080.png) | [보기](screenshots/usability-manual-1920x1080.png) | [보기](screenshots/usability-notice-1920x1080.png) | [보기](screenshots/usability-roadmap-1920x1080.png) |
| 768x1024 | [보기](screenshots/usability-gallery-768x1024.png) | [보기](screenshots/usability-manual-768x1024.png) | [보기](screenshots/usability-notice-768x1024.png) | [보기](screenshots/usability-roadmap-768x1024.png) |
| 390x844 | [보기](screenshots/usability-gallery-390x844.png) | [보기](screenshots/usability-manual-390x844.png) | [보기](screenshots/usability-notice-390x844.png) | [보기](screenshots/usability-roadmap-390x844.png) |

격자 실제 SVG 크기와 viewport 크기 일치, 화면 밖 넘침, 상단 도구·사이드바와 알림 겹침, 모바일 입력과 복귀를 자동 검사한다. 대표 데스크톱/모바일 이미지를 육안으로 확인하고 직접 플레이 SVG 확대 누락과 모바일 메뉴 겹침을 수정했다.

## 18. 변경 파일

- `README.md`
- `benchmarks/performance.spec.ts`
- `benchmarks/results/after-usability-long-run.json`
- `benchmarks/results/after-usability-retained-costs.json`
- `benchmarks/results/after-usability-scheduler.json`
- `benchmarks/results/after-usability-ui-desktop.json`
- `benchmarks/results/after-usability-ui-mobile.json`
- `benchmarks/results/after-usability.json`
- `benchmarks/results/preset-audit-usability.json`
- `docs/PLAYGROUND_USABILITY_UPGRADE.md`
- `e2e/complex.spec.ts`
- `e2e/home.spec.ts`
- `e2e/usability.spec.ts`
- `src/core/engine/SimulationEngine.test.ts`
- `src/core/engine/SimulationEngine.ts`
- `src/core/engine/complexResources.test.ts`
- `src/core/engine/resources.ts`
- `src/core/engine/retention.test.ts`
- `src/core/engine/types.ts`
- `src/index.css`
- `src/ui/GridDemo.tsx`
- `src/ui/Home.test.tsx`
- `src/ui/ManualPlay.tsx`
- `src/ui/Notice.tsx`
- `src/ui/ResourceInfo.tsx`
- `src/ui/Simulator.tsx`
- `src/ui/guide/AlgorithmGuide.test.tsx`
- `src/ui/guide/AlgorithmGuide.tsx`
- `src/ui/guide/StudyResources.tsx`
- `src/ui/homeScenarios.test.tsx`
- `src/ui/usability.test.tsx`
- `src/viz/controls/EnvEditor.tsx`
- `src/viz/controls/complexPresets.ts`
- `src/viz/controls/presetAudit.test.ts`
- `src/viz/controls/presetAudit.ts`
- `src/viz/grid/TrajectoryOverlay.tsx`
- `src/viz/panels/EpisodeStepViewer.test.tsx`
- `src/viz/panels/EpisodeStepViewer.tsx`
- `src/viz/panels/EpisodeTrajectory.tsx`
- `src/viz/panels/StatsPanel.tsx`
- `src/viz/panels/TerminationChart.tsx`
- `docs/screenshots/usability-*.png`: 위 20개 실제 브라우저 캡처.

## 19. 제한 사항

상세 기록 정리는 영구 삭제이며 오래된 경로 전체를 재생하거나 서버에서 복구하지 않는다. 최근 요약 창 밖의 개별 에피소드도 복구하지 않는다. 세션을 새로고침하면 기존처럼 메모리의 실험 상태가 사라진다. 자원 예산은 엔진 자료구조 정책이며 브라우저 전체 heap의 hard byte 제한이 아니다.

직접 플레이는 단일 에이전트의 수동 환경 검사다. 실험의 학습 진행 상태를 자동 정지하거나 Q-table을 수정하지 않는다. 홈은 미리 정한 시연 경로이며 온라인 학습이 아니다. 큰 동적 상태 공간의 수렴이나 250회 내 성공, 모든 프리셋의 최적 정책을 보장하지 않는다. 정적 지도 감사는 잠재 기하 지표이고 동적 최적 경로의 증명이 아니다.

## 20. Git 및 원격 상태

| 커밋 | 변경 |
|---|---|
| `4db6e3e` | bounded 상세 기록·누적 통계·자원 알림 |
| `1d52b59` | 독립 직접 플레이·편집 복귀·알림 검증 |
| `f2a1370` | 개방형 복합 프리셋·정적 감사 및 경로 검증 |
| `d1c4c5a` | 단원 탐색·공식 출처·학습 로드맵 |
| `409c295` | 4개 독립 홈 시연·기존 테스트 갱신 |
| `3c41d38` | 장시간 브라우저·반응형 E2E·성능 원시 결과 |

위 기능/검증 커밋과 별도 보고서·스크린샷 커밋을 `origin/feat/home-redesign`에 푸시한다. 최종 단계에서 `git ls-remote --heads origin main feat/home-redesign`과 로컬 HEAD를 비교해 실제 원격 반영을 확인하며, 최종 문서 커밋 해시는 사용자 보고에 명시한다.

`main`과 `origin/main`은 `987db7b0d9cf7f3ada6c735133ac30c0149dee1c`를 유지한다. GitHub Pages workflow는 main push 또는 수동 실행만 배포하며 이번에는 둘 다 수행하지 않는다. Vite의 `/RL-Playground/` base와 정적 번들 빌드를 유지한다. 최종 원격 해시는 사용자 보고에 첨부한다.
