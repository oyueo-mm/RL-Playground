# UI/UX 개선 및 알고리즘 가이드

> 이후 드래그·자동 연결·25개 프리셋·단일 가이드 스크롤을 추가했습니다. 현재 동작과 검증은 [복합 환경 개선 보고서](COMPLEX_ENVIRONMENT_UPGRADE.md)를 참고하세요.

검증일: 2026-10-25. 브랜치: `feat/home-redesign`. 시작 기준: 원격과 일치한 `c18ed4f`.

## 1. 전체 변경 사항

요청한 11개 항목을 기존 React/TypeScript 구조 위에 구현했다.

- 사이드바 ‘맵 프리셋’과 독립적인 오른쪽 패널.
- 한국어/영어 6단원 알고리즘 가이드 및 교육용 업데이트 계산기.
- 학습·편집 툴바 공통 설명형 Tooltip.
- 학습 에피소드 기본값 250, 학습/시각화 설정 탭 통합.
- 사이드바 장식·슬로건·상단 브랜딩 영역 제거.
- 편집 요소 11개 직접 표시, 기존 특수 요소 드롭다운과 툴바 맵 버튼 제거.
- 초안 Undo/Redo, 시계 방향 회전, Backspace/Delete 삭제 및 보호 규칙.

GridWorld 전이·상태 인코딩·Q-Learning/SARSA·SimulationEngine/Scheduler는 변경하지 않았다. 기존 16개 프리셋, 정책/가치 기본 활성화, 전체 화면·전체 맞춤·확대/패닝, JSON, 홈 자동 시연과 분석을 유지했다.

## 2. 사이드바 및 오른쪽 패널

메뉴 순서는 홈 → 학습 환경 → 맵 편집 → 맵 프리셋 → 결과 → 가이드다. 하단 언어 선택, 축소 상태와 모바일 드로어는 유지한다. ‘✳’, 작은 실험 슬로건, OPEN SOURCE 문구와 불필요한 빈 장식 영역을 렌더하지 않는다. 일반 데스크톱의 여섯 메뉴가 내부 스크롤 없이 표시되는지 검증했다.

App이 프리셋 패널의 열림 상태를 관리하고 Simulator는 같은 인스턴스를 유지한다. 홈/가이드/결과에서 프리셋을 열면 학습 환경으로 이동한다. 학습·편집 화면에서는 해당 화면을 유지한다. 같은 메뉴로 닫을 수도 있다.

데스크톱 프리셋 패널은 오른쪽 **350px**다. GridViewport의 기존 ResizeObserver가 줄어든 영역을 다시 측정한다. 모바일은 닫을 수 있는 오른쪽 드로어다. 미리보기와 목록을 분리하여 목록을 내려도 선택 맵의 큰 미리보기 영역을 유지하고, 패널 안에서만 스크롤한다. 작은 높이에서는 미리보기 자체도 내부 스크롤된다.

프리셋을 열면 분석은 숨기고 편집 속성도 가린다. 분석 또는 속성을 다시 열면 프리셋을 닫는다. 주요 오른쪽 패널이 겹쳐 표시되지 않으며, 숨긴 분석의 셀/에피소드 선택과 데이터는 지우지 않는다. Escape, 닫기 버튼, 닫은 뒤 포커스 복원을 제공한다.

## 3. 프리셋 불러오기 흐름

기존 MapGallery의 실제 GridSvg 썸네일·미리보기·선택 데이터를 재사용한다. 기존 16개 모두 이름, 크기, 설명, 난이도, 주요 요소를 제공한다. 기존 프리셋은 기존 번역 설명과 기본 지형 메타데이터를 사용한다.

**학습 환경:** 메뉴 열기 → 썸네일 선택 → 미리보기 → ‘맵 적용’ → 실험 초기화 확인 → engine.reset. 확인 취소와 미리보기는 현재 환경/Q-table을 변경하지 않는다.

**편집기:** 메뉴 열기 → 선택 → ‘편집기로 불러오기’ → 변경 초안이 있으면 교체 확인 → 초안만 교체. 확인에는 Undo 가능성과 학습 환경 유지 사실을 표시한다. 이 교체는 한 번의 이력으로 저장된다. 이후 ‘환경 적용’ 확인을 거쳐야 실제 환경을 초기화한다.

프리셋 전용 학습 툴바 ‘맵’ 버튼과 편집 툴바 ‘맵 프리셋’ 버튼은 제거했다. 기존 비전체 화면 편집기의 프리셋 select는 레거시 컴포넌트 사용 및 회귀 테스트를 위해 남아 있으며 실제 앱의 전체 화면 UI에는 표시되지 않는다.

## 4. 학습 설정 및 기본값

에피소드 초기 입력은 **250**이다. 양의 safe integer만 허용하고 0, 음수, 소수, 비정상 숫자는 거절한다. 250은 최대값이 아니다. 실행 중에는 기존처럼 횟수/알고리즘 입력을 비활성화하여 현재 실행을 중단하지 않는다.

‘설정’ 팝오버 안에 다음 두 탭을 둔다.

- 학습 설정: 알고리즘, 횟수, ε/α/γ, 중단 시 Q-table·완료 이력 보존 안내.
- 시각화 설정: 정책, 가치, 에피소드 경로 토글, 동률 ‘⋯’와 실제 탐욕 동률 처리 설명.

독립 ‘시각화’ 버튼을 제거했으며 값은 탭 변경·닫기·메뉴 이동·언어 변경으로 초기화하지 않는다. 최종 학습 툴바는 속도, 학습하기, 일시정지/재개, 중단, 결과 실행, 설정, 분석이다. Step/초기화는 다시 추가하지 않았다.

## 5. Tooltip 및 접근성

`TooltipButton.tsx`를 학습/편집 버튼에서 공유하며 설명은 `toolbarTips.ts`의 한국어·영어 사전에 둔다.

- hover **350ms** 후, 키보드 focus 시 즉시 표시.
- mouseleave/blur/click/Escape에 닫힘.
- React portal과 fixed 좌표로 패널 overflow에 잘리지 않도록 표시.
- 실제 팝업 크기를 측정하고 화면 경계 안으로 위치 보정.
- 설명은 `role=tooltip`, `aria-describedby`로 연결하며 팝업은 pointer-events:none.
- native disabled 버튼의 wrapper를 키보드로 포커스할 수 있어 사용 조건을 읽을 수 있음.
- Undo/Redo 설명에는 단축키·이력 필요 조건, 적용에는 오류 해결 조건, 실행 버튼에는 실행 가능 조건을 포함.

팝업이 떠 있을 때 Escape는 우선 Tooltip을 닫으며, 이후 Escape로 해당 패널을 닫을 수 있다. 지연·focus·닫기·비활성 설명을 단위 테스트하고 화면 경계 안에 배치되는지 브라우저에서 확인했다.

## 6. 편집 도구 구성

선택, 벽, 시작점, 목표, 폭탄, 포털, 단방향, 부서지는 바닥, 스위치, 토글 벽, 지우개를 각각 아이콘 버튼으로 직접 제공한다. 선택된 도구는 aria-pressed와 배경으로 표시한다. 그 뒤에 Undo, Redo, 속성/파일, 환경 적용을 둔다.

넓은 화면은 가능한 한 한 줄이고 공간이 줄면 툴바 내부에서 줄바꿈한다. 기존 FloatingToolbar가 실제 높이를 재고 GridViewport 상단 공간을 확보하므로 격자를 잘라내거나 본문 스크롤을 만들지 않는다. 특수 요소 드롭다운은 제거했고 ID/방향 직접 입력은 속성에 유지한다.

## 7. Undo/Redo 구조

`useDraftHistory.ts`가 전체 GridEditorDraft의 `past / present / future`를 보유한다. 과거는 **100단계**까지 저장한다. JSON 의미가 같은 변경은 이력을 만들지 않고, Undo 후 새 변경은 future를 비운다. 배열/객체는 기존 불변 갱신을 유지한다.

벽/목표/Bomb/Start 및 모든 특수 요소의 배치·삭제·방향·ID, 크기, 보상, 프리셋, JSON, 초안 초기화가 같은 commit 경로를 통과한다. 같은 속성 입력은 1초 이내의 연속 입력을 묶고 blur에서 그룹을 끊는다. 셀 클릭은 각각 독립 이력이다. 현재 편집기는 클릭·키보드 편집이며 드래그 페인팅을 새로 추가하지 않았다. 내부 패닝은 기존대로 유지한다.

Ctrl/Cmd+Z, Ctrl+Y, Ctrl/Cmd+Shift+Z는 편집 화면이 활성일 때만 처리한다. 입력·textarea·select·contenteditable에서는 브라우저의 텍스트 Undo를 유지한다. 선택 도구/패널 토글은 이력이 아니다. 메뉴 이동으로 EnvEditor를 언마운트하지 않아 이력이 유지된다.

환경 적용으로 내 초안을 승인한 경우 이력을 지우지 않는다. 적용 후 Undo는 초안만 복원하고 이미 초기화된 Q-table/실제 환경은 복원하지 않는다. 외부 환경 변경 시에는 기존처럼 미편집 초안만 새 환경을 따른다. Undo/Redo는 다시 미적용 편집으로 취급한다. 초안에서 계산하는 유효성 검사와 미리보기는 Undo 직후 함께 갱신된다.

## 8. 회전과 키보드 삭제

단방향 도구로 빈 셀에 배치한 뒤 같은 셀을 누르면 **위 → 오른쪽 → 아래 → 왼쪽 → 위**로 회전한다. 엔진 인덱스는 `0→3→1→2→0`이며 단순 증가를 사용하지 않는다. 각 클릭은 한 이력이고 속성 방향·화살표·Undo/Redo가 동기화된다. 기존 요소 중복 금지는 유지한다.

선택 도구에서 선택 셀에 Backspace/Delete를 적용하면 지우개와 같은 초안 삭제 경로를 사용한다. 시작점은 삭제 대신 이동을 안내하고, 마지막 Goal은 보호한다. 포털 한쪽이나 그룹 요소를 지워 불완전해지면 검증 오류와 적용 차단을 유지한다. Undo로 복원할 수 있다.

입력창, textarea, select, 편집 가능한 요소 또는 비활성 편집 화면에서는 삭제하지 않는다. 선택 셀이 없으면 처리하지 않으며 필요한 키 처리에만 preventDefault를 호출한다.

## 9. 알고리즘 가이드

Home의 기존 자동 시연을 보존하고 실제 가이드는 독립 `AlgorithmGuide`로 연결했다. 콘텐츠/프레젠테이션/계산을 분리했다. 6단원 목차로 이동하며 콘텐츠만 세로 스크롤한다. 데스크톱 목차는 왼쪽, 모바일 목차는 가로 스크롤이다. 메인 사이드바는 고정이다.

| 단원 | 내용 |
|---|---|
| 강화학습 기초 | Agent, Environment, State, Action, Reward, Policy, Episode, Return, 할인율, MDP/Markov, 실제 격자 사례와 전이 도식 |
| Q-table과 가치 | Vπ/Qπ 관계, 탐욕/ε-greedy, 탐험/활용, TD 오차, 최댓값을 강조한 실제 표, 미방문 0과 동률 표시 |
| Q-Learning | Off-policy TD Control, 변수 해설, 비종료/종료 수식, 단계 계산, 한국어/영어 의사코드, 장단점·실험 |
| SARSA | S–A–R–S–A, On-policy, 실제 a′ 재사용, 수식·계산·의사코드·탐험 영향·한계 |
| 비교 | 인터랙티브 업데이트 계산기, 정책/목표/탐험 비교표, 조건부 위험 경향 설명 |
| 하이퍼파라미터 | α/γ/ε 의미, 극단값, ε-greedy 확률 슬라이더, 실험 순서, 고정 ε와 구현 범위 |

일반적인 γ 해석은 0–1이지만 실제 도구는 0–2를 허용하므로 γ>1의 증폭/발산 가능성을 명시했다. 자동 ε decay를 제공한다고 설명하지 않는다. SARSA가 항상 더 안전하다는 단정을 하지 않으며 유한 실행의 수렴도 보장하지 않는다.

참고 문헌: Sutton & Barto, *Reinforcement Learning: An Introduction*, 2nd ed., Chapters 2, 3, 6 ([교재 PDF](https://msdnaa.eecs.berkeley.edu/~cs188/fa19/assets/files/SuttonBartoIPRLBook2ndEd.pdf)). 설명을 로컬 `qLearning.ts`, `sarsa.ts`, `epsilonGreedy.ts`, SimulationEngine과 대조했다. 예제·설명·의사코드는 이 도구에 맞춰 작성했다.

## 10. 수식과 계산 검증

비종료 업데이트:

`Q ← Q + α[r + γ max Q′ − Q]` (Q-Learning)

`Q ← Q + α[r + γ Q(s′,a′) − Q]` (SARSA)

종료 업데이트는 두 경우 모두 `Q ← Q + α[r − Q]`다.

기본 예제 `Q=2, r=−1, α=0.5, γ=0.9, max Q′=4, 선택 Q′=1`에서 목표/TD오차/결과는 각각 `2.6 / 0.6 / 2.30`, `−0.1 / −2.1 / 0.95`다. 종료를 선택하면 둘 다 **0.50**이다.

계산기는 여섯 입력을 즉시 반영하고 목표·오차·업데이트를 나누어 표시한다. 선택 Q′가 max보다 크면 예제의 불일치를 안내한다. 실제 실험을 바꾸지 않는 교육용 예제임을 표시한다. 순수 계산 결과를 실제 TabularQAgent와 두 알고리즘의 `computeUpdate`에 대조하는 테스트를 비종료/종료 양쪽에 작성했다.

## 11. 변경 파일

- `src/ui/App.tsx`: 사이드바, 프리셋 진입, 가이드 연결.
- `src/ui/Simulator.tsx`: 250 기본값, 설정 탭, 공통 Tooltip, 프리셋/분석/편집 연결.
- `src/ui/TooltipButton.tsx`, `toolbarTips.ts`: 공통 설명 UI와 번역.
- `src/ui/hooks/useDraftHistory.ts`: 초안 이력.
- `src/viz/controls/EnvEditor.tsx`: 도구·이력·회전·키보드·불러오기.
- `src/viz/controls/MapGallery.tsx`: 오른쪽 패널·미리보기·메타데이터.
- `src/ui/guide/{AlgorithmGuide.tsx,content.ts,UpdateCalculator.tsx,calculateUpdate.ts}`: 가이드.
- `src/index.css`: 패널·툴바·가이드·반응형.
- `src/ui/{Workflow.test.tsx,App.test.tsx,Home.test.tsx}`, `src/ui/guide/AlgorithmGuide.test.tsx`, `e2e/home.spec.ts`: 신규/회귀 검증.
- `vite.config.ts`: UI 테스트 간 자원 경합을 줄이는 maxWorkers=2.
- README, 이 보고서 및 `docs/screenshots/ux-*`: 안내·브라우저 증거.

## 12. 검증 결과

| 명령 | 최종 결과 |
|---|---|
| `npm run lint` | 통과, 오류·경고 없음 |
| `npm test -- --reporter=dot` | 56개 파일, **1,046개 통과**, 34.79초 |
| `npm run build` | TypeScript + Vite production build 통과; JS 352.87kB, gzip 108.93kB |
| `npm run test:e2e` | Edge desktop/mobile **20개 통과**, skip 없음, 59.7초 |
| `git diff --check` | 통과 |

기존 1,020개에서 26개 증가했다. 기존 테스트는 삭제하지 않았다. 기본값 100 assertion을 250으로 변경하고 기존 맵 버튼/특수 도구/시각화 버튼 경로를 새 사이드바·직접 도구·탭 경로로 갱신했다. 기존 16개 프리셋, 엔진 보존, 전이 규칙 검증은 유지한다.

초기 전체 실행에서는 홈 시연 검증이 과도한 병렬 JSDOM 실행 중 5초 timeout을 넘었다. 단독 실행은 약 0.9초였다. 제한 시간이나 assertion을 줄이지 않고 test maxWorkers를 2로 제한한 뒤 전체 통과했다. 샌드박스 안 Vite의 자식 프로세스 EPERM은 동일 명령을 허용된 실행 환경에서 재실행하여 해결했다.

신규 검증은 프리셋 미리보기/취소/실제 적용과 초안 적용의 차이, 두 설정 탭, Tooltip 지연/닫기/disabled, 100단계 이력, 모든 주요 요소의 배치 Undo/Redo, JSON/초기화/크기/보상/ID, 적용 후 초안 Undo, 키보드 회전/삭제 보호, 가이드 6단원과 실제 알고리즘 계산 대조를 포함한다.

Pages base `/RL-Playground/`를 사용한 production preview에서 브라우저 테스트했다. 기존 Pages workflow는 수정하거나 실행하지 않았다.

## 13. 실제 브라우저 캡처

최종 Playwright 실행의 실제 화면이다. 아래 크기를 모두 검사했고, 대표 데스크톱·모바일 캡처에서 패널·툴바·가이드·계산기를 육안으로 확인했다. 3×3, 20×20, 3×20, 20×3 격자의 전체 맞춤과 내부 패닝 회귀도 포함한다.

| 해상도 | 프리셋 패널 | 편집 툴바 | 알고리즘 가이드 |
|---|---|---|---|
| 1366×768 | [보기](screenshots/ux-presets-1366x768.png) | [보기](screenshots/ux-tools-1366x768.png) | [보기](screenshots/ux-guide-1366x768.png) |
| 1440×900 | [보기](screenshots/ux-presets-1440x900.png) | [보기](screenshots/ux-tools-1440x900.png) | [보기](screenshots/ux-guide-1440x900.png) |
| 1920×1080 | [보기](screenshots/ux-presets-1920x1080.png) | [보기](screenshots/ux-tools-1920x1080.png) | [보기](screenshots/ux-guide-1920x1080.png) |
| 768×1024 | [보기](screenshots/ux-presets-768x1024.png) | [보기](screenshots/ux-tools-768x1024.png) | [보기](screenshots/ux-guide-768x1024.png) |
| 390×844 | [보기](screenshots/ux-presets-390x844.png) | [보기](screenshots/ux-tools-390x844.png) | [보기](screenshots/ux-guide-390x844.png) |

추가: [데스크톱 설정](screenshots/ux-settings-1440x900.png), [모바일 설정](screenshots/ux-settings-390x844.png), [데스크톱 계산](screenshots/ux-calculator-1440x900.png), [모바일 계산](screenshots/ux-calculator-390x844.png), [모바일 Tooltip](screenshots/ux-tooltip-mobile.png).

## 14. 알려진 제한 사항

- 실제 브라우저는 Microsoft Edge이며 모바일은 터치/화면 에뮬레이션이다. 물리 iOS/Safari/Android 기기는 검증하지 않았다.
- Undo/Redo는 현재 세션의 초안 이력이다. 새로고침 후 복구와 Q-table/환경 적용 이전 실험 복원은 제공하지 않는다.
- 포인터 드래그 페인팅은 기존 기능에 없으며 이번에도 추가하지 않았다. 클릭/키보드 편집과 확대 후 내부 패닝을 사용한다.
- 높이가 작은 화면에서는 프리셋 미리보기, 가이드 표·콘텐츠가 자체 스크롤된다. 모바일 단원 목차는 가로 스크롤한다.
- 기존 동적 맵 예산/해결 불가능한 임의 편집 맵의 제한은 [환경 확장 보고서](ENVIRONMENT_EXPANSION.md)와 같다.
- 기존 20×20 동적 맵 고속 테스트도 다시 실행했다. 3초 표본이며 완료 에피소드는 양쪽 0개였다. Pause/Stop 응답과 화면 10회 왕복 후 GC를 확인했으나 장시간 누수나 학습 수렴을 보증하지 않는다. 최종 GC 후 heap은 desktop 약 6.70MB, mobile 약 6.89MB였다.

## 15. Git 및 푸시

작업 전 fetch로 최신 원격 일치를 확인했다. 기존 `feat/home-redesign`에서 이어서 작성했다.

- `c7feded`: bilingual algorithm curriculum and interactive TD calculator.
- 최종 코드 SHA **`9c6f31d76563709287dcfab32cba50b5925045b9`**: workspace panels/settings/editor history 및 신규/회귀 테스트.
- 위 두 커밋을 `origin/feat/home-redesign`에 푸시하여 원격 반영을 확인했다.
- 보고서와 캡처는 후속 문서 커밋으로 같은 브랜치에 기록·푸시한다. 문서 커밋을 포함한 최종 HEAD SHA와 원격 일치는 최종 응답에서 제공한다.

main과 origin/main은 모두 `987db7b0d9cf7f3ada6c735133ac30c0149dee1c`로 유지한다. main 병합, Production 배포, Pages workflow 호출은 하지 않았다.
