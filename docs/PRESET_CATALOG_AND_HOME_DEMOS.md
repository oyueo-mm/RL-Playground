# 공식 프리셋 20종과 랜덤 홈 시연

> 이 문서는 `4e63dd1`의 20종 구현 기록입니다. 현재 공식 30종은 [최신 개선 보고서](PRESET_30_AND_UX_UPGRADE.md)를 참조하세요. 이전 수치와 원본은 역사적 기록으로 유지합니다.

검증일: 2026-10-25. 기준: `4a4b80c`, 브랜치: `feat/home-redesign`.

## 1. 최종 변경 사항

공식 프리셋 25개를 사용자 ZIP의 20개 맵으로 교체했다. 홈은 같은 카탈로그와 성공 경로를 사용해 서로 다른 4개 환경을 순환한다. 카드별 자동 교체·전체 Pause/Resume·맵 섞기·확대 경로 탐색·확인 후 실험 적용을 제공한다. 직접 플레이의 키보드/포인터 길게 누르기와 구조화된 한국어 무료 학습 자료도 추가했다.

학습 알고리즘, 기본 GridWorld, 기본 250 에피소드, 실제 상태 표현과 모든 Goal 수집 종료, 희소 Q-table, 자원 보호·bounded history·분석·편집·JSON·Undo/Redo를 유지했다. main 병합이나 배포는 하지 않았다.

## 2. ZIP 파일 검증

입력은 `RL_Playground_20_Custom_Presets.zip`(823,605 bytes)이다. ZIP SHA-256: `7b46eef2b0bd5b386352cb6a4bda0accb3378407c7ef3237fdb33bf70d955c26`. [원본별 SHA-256 목록](preset-source/inventory.json)과 [ZIP 해시·CRC 검증](preset-source/provenance.json)을 보관한다.

- 68개 파일 전체를 읽고 CRC와 SHA-256을 확인했다.
- 환경 JSON 20개, 성공 경로 JSON 20개, 목록 JSON과 README를 확인했다.
- PNG 25개를 모두 디코딩/검증하고 [20개 원본 미리보기 모음](preset-source/contact-sheet.png)을 확인했다.
- 제공 HTML의 내장 환경·행동 배열이 별도 JSON 20쌍과 모두 일치함을 확인했다. HTML의 별도 전이 구현을 앱 엔진 대신 사용하지 않았다.
- 앱의 맵/경로 40개와 목록 JSON의 원본 바이트도 자동 해시 테스트로 대조한다. `.gitattributes`로 플랫폼별 줄바꿈 변환을 막았다.

ZIP README의 ‘검토용 초안’은 자료 설명이다. 이번 사용자 요청의 공식 교체 지시에 따라 등록했으며, 문서 안의 설명을 별도 작업 지시나 승인 조건으로 취급하지 않았다. 맵 좌표나 경로를 재생성하지 않았다.

## 3. 25개에서 20개로 변경한 구조

`src/data/presets/maps/`와 `solutions/`에 원본 JSON을 각각 20개 보관한다. 원본 목록은 `catalog.json`, 공용 등록/메타데이터는 `manifest.ts`다. 기존 `environmentPresets.ts`는 공용 목록을 재수출한다. 구 `complexPresets.ts`와 구 프리셋 번역/정의는 제거했다.

갤러리와 홈은 동일한 `ENVIRONMENT_PRESETS`를 사용한다. ID·원본 파일·경로 파일·한영 이름/설명·난이도·크기·Goal 수·요소·학습 포인트를 중앙 관리한다. 자료 보존용 `docs/preset-source/`는 ZIP 원본의 불변 보관본이며 별도 런타임 카탈로그가 아니다.

기존 고정 홈 시나리오는 제품 코드에서 제거했다. 기존 세부 전이 회귀 테스트를 유지하기 위한 작은 fixture만 `src/test/homeScenarioFixtures.ts`로 옮겼다.

## 4. 최종 프리셋 목록

| 번호 | 한국어 / English | 난이도 | 크기 | Goal | 검증 경로 |
| --- | --- | --- | --- | --- | --- |
| 01 | 초원 산책 / Meadow Walk | 쉬움 | 8×8 | 2 | 10 step · 성공 |
| 02 | 첫 포털 수업 / First Portal Lesson | 쉬움 | 8×8 | 2 | 15 step · 성공 |
| 03 | 문 하나의 비밀 / One Switch, One Door | 쉬움 | 9×9 | 2 | 15 step · 성공 |
| 04 | 조심조심 다리 / Fragile Bridge | 쉬움 | 9×9 | 2 | 15 step · 성공 |
| 05 | 화살표 골목 / Arrow Alley | 쉬움 | 8×10 | 3 | 17 step · 성공 |
| 06 | 갈림길 마을 / Forked Village | 보통 | 10×10 | 4 | 33 step · 성공 |
| 07 | 습지 우회로 / Marsh Detour | 보통 | 10×10 | 3 | 21 step · 성공 |
| 08 | 이중 포털 광장 / Twin Portal Plaza | 보통 | 10×10 | 4 | 25 step · 성공 |
| 09 | 연구소 동선 / Lab Corridors | 보통 | 11×11 | 4 | 38 step · 성공 |
| 10 | 유적 회수 작전 / Ruin Retrieval | 보통 | 11×11 | 4 | 24 step · 성공 |
| 11 | 교차로 원정 / Crossroads Expedition | 어려움 | 20×20 | 7 | 114 step · 성공 |
| 12 | 포털 도시 / Portal City | 어려움 | 18×18 | 6 | 48 step · 성공 |
| 13 | 전력 제어 구역 / Power Control Zone | 어려움 | 18×18 | 6 | 88 step · 성공 |
| 14 | 붕괴 협곡 / Crumbling Canyon | 어려움 | 16×18 | 5 | 58 step · 성공 |
| 15 | 편도 순환선 / One-Way Circuit | 어려움 | 17×17 | 6 | 66 step · 성공 |
| 16 | 다중 목표 원정대 / Multi-Goal Expedition | 매우 어려움 | 20×20 | 10 | 81 step · 성공 |
| 17 | 봉인된 연구기지 / Sealed Research Base | 매우 어려움 | 20×20 | 8 | 152 step · 성공 |
| 18 | 붕괴하는 군도 / Collapsing Archipelago | 매우 어려움 | 20×20 | 7 | 78 step · 성공 |
| 19 | 왜곡된 차원문 / Warp Nexus | 매우 어려움 | 20×20 | 8 | 50 step · 성공 |
| 20 | 최종 시험장 / Final Proving Grounds | 매우 어려움 | 20×20 | 8 | 116 step · 성공 |

## 5. 난이도 및 메타데이터

쉬움/Easy, 보통/Medium, 어려움/Hard, 매우 어려움/Very Hard가 각각 5개다. 크기로 난이도를 추측하지 않고 원본 분류를 사용한다. 기존 Introductory/Intermediate/Experimental 등의 공식 카탈로그 분류는 제거했다.

ID는 원본 번호와 파일명에서 만들되 쉼표를 제거한다. 예를 들어 `03_one_switch_one_door`는 원본 파일 `03_one_switch,_one_door.json`을 참조한다. 파일명과 원본 내용은 그대로다. 영어 설명은 원본 한국어 전략 설명을 번역한 것이며 지형을 바꾸지 않는다.

## 6. 성공 경로 검증

`validateSolutions.test.ts`가 20개 전체를 `parseEnvImport()` → `validateDraft()` → 실제 `GridWorldEnv`로 검증한다. 각 행동이 0–3 범위인지, Bomb에 진입하지 않는지, 마지막 행동에서만 종료되는지, 모든 Goal이 사라졌는지 확인한다.

원본 `steps`, `goalOrder`, `events`의 Goal·포털·스위치·붕괴 횟수가 모두 실제 재생과 일치했다. 수정하거나 새로 탐색한 대체 경로는 없다. 성공 경로는 해결 가능성의 증거이며 최단 경로나 Q-Learning/SARSA 수렴의 증거가 아니다.

구조·크기·좌표 중복·기본 지형 충돌·목표 접근·안전 우회·JSON 왕복과 동적 환경의 기존 회귀 검증도 새 공식 맵에 맞춰 유지했다. 기하 감사는 포털 연결을 고려하는 잠재 영역 검사이며 붕괴/방향의 전체 상태 공간 최적 탐색이 아니다. 실제 동적 성공은 별도 행동 재생으로 증명한다.

## 7. 갤러리 UI와 작업 흐름

사이드바 메뉴와 우측 독립 패널을 유지한다. 20개 전체와 난이도별 5개, 한영 이름/설명 검색, 크기·환경 요소·유형 필터가 동작한다. 카드에는 이름·난이도·크기·Goal 수·요소를, 선택 미리보기에는 전략 설명을 표시한다. 난이도 선택 상자에 명확한 접근성 이름을 추가했다.

단순 미리보기는 학습 상태를 변경하지 않는다. 학습 환경 적용은 기존 초기화 확인을 거친다. 편집기 불러오기는 초안만 교체하며 Undo로 이전 초안을 복구할 수 있다. 환경 적용 전에는 실제 학습 환경을 바꾸지 않는다. 사용자의 JSON과 기본 환경을 삭제하거나 자동 교체하지 않았다.

## 8. Shuffle Bag

`ShuffleBag`은 주입 가능한 난수로 ID 대기열을 섞는다. 최초 20개 추출은 중복 없이 전체를 순회하고 각 난이도 5개를 포함한다. 선택 시 현재 표시 중인 ID를 제외한다. 새 순환에서는 이미 보이는 카드들을 노출된 carry-over로 취급해 중복 표시를 막는다.

‘맵 섞기’는 이전 4개와도 겹치지 않는 새 조합을 고른다. 첫 bag 전체 순회·난이도 빈도·동일 seed 재현·100회 섞기의 중복 방지·180초 모의 순환의 전체 노출을 테스트한다. 경로 길이에 따라 실제 화면 체류 시간은 다르므로 매 분의 시작 횟수가 정확히 5:5:5:5라는 뜻은 아니다.

## 9. 4개 독립 동시 시연

`DemoPlayback`은 현재 4개 슬롯의 환경·행동 인덱스·다음 시각·현재 모델·짧은 진행 경로만 보관한다. 20개 전체의 프레임을 미리 계산하지 않는다. 환경을 매 프레임 재생성하지 않으며 하나의 80ms 공통 타이머가 서로 다른 슬롯별 마감 시각을 처리한다.

React에는 변경된 슬롯의 새 view만 발행한다. 카드 memo와 지형/에이전트 분리로 단순 이동은 작은 원 마커를 갱신하며, Goal/문/붕괴 변화 때만 지형을 다시 렌더링한다. 비교에서 제외하는 필드는 지형과 무관한 `agentPos`뿐이다.

## 10. 완료 및 교체

모든 Goal을 수집한 실제 종료 상태를 1,100ms 유지한 뒤 해당 슬롯만 다음 ID로 교체한다. 다른 슬롯은 계속 진행한다. 한 tick에 여러 슬롯을 교체해도 새 슬롯을 즉시 active 집합에 반영해 중복을 막는다.

전체 일시정지·재개·한 칸 이동·맵 섞기를 제공한다. 확대 미리보기를 열면 배경 시연을 잠시 멈추고, 닫으면 기존 진행 상태로 돌아온다. 확대 화면의 슬라이더는 선택한 경로만 실제 전이로 재생해 관찰하며 실제 실험을 건드리지 않는다. ‘이 맵으로 실험하기’만 초기화 확인 후 학습 환경으로 이동한다.

## 11. 실제 전이와 시연 의미

각 step은 실제 `GridWorldEnv.step()`이다. 포털 1회 점프, 출발 방향 제약, 스위치 재진입 시 문 전환, 떠난 바닥 붕괴, 모든 Goal 수집 종료를 공유한다. 중간 행동을 생략하거나 좌표만 계산해 이동시키지 않는다.

기본 간격은 `clamp(12000 / steps, 80, 450)`ms다. 포털·Goal·문·붕괴 변화에 260ms를 더 머문다. 80ms tick의 양자화와 이벤트 정지 때문에 실제 총 재생 시간은 정확히 12초가 아니다. 마커 보간은 다음 step 이전에 끝나도록 64–250ms로 맞추고 포털은 보간하지 않는다.

작은 ‘설명용 시연’ 표시와 접힌 안내를 제공한다. 실제 Q-Learning/SARSA 결과라고 표현하지 않는다. 맵 크기에 맞는 viewBox와 비율을 유지하고, 데스크톱 소개/갤러리는 약 40:60이다. 큰 지도의 세부 요소는 확대 화면에서 확인할 수 있다.

## 12. 직접 플레이 연속 이동

`HeldMovement`가 눌린 키/포인터를 순서 있는 Map으로 관리한다. 처음 누르면 즉시 이동, 200ms 후 반복, 이후 100ms 간격이다. OS `keydown.repeat`는 새 루프를 만들지 않는다. 새 방향이 우선이며 이를 놓으면 아직 누른 이전 방향으로 돌아간다. 같은 방향 별칭을 함께 눌러도 루프는 하나다.

키 해제·Pointer Up/Cancel/Lost Capture·창 blur·탭 비활성·텍스트 입력 focus·Pause·Restart·화면 비활성·언마운트·성공/Bomb에서 타이머와 입력 상태를 정리한다. 입력/textarea/select/contenteditable에서는 단축키를 처리하지 않는다. R/Escape는 종료 상태에서도 사용할 수 있다.

각 이동은 독립 플레이 환경의 `env.step()`을 호출한다. 학습 Q-table·보상·에피소드를 변경하지 않는다. 편집기 초안·선택·도구·Undo/Redo는 기존처럼 유지한다. 모바일 방향 버튼도 Pointer Capture로 길게 누르기를 지원하고 실제 touchCancel을 브라우저에서 검증했다.

## 13. 한국어 학습 자료와 확인 상태

`learningResources.json`과 `ResourceLinks`가 언어·유형·난이도·접근 조건·관련 단원/로드맵 단계·확인일을 관리한다. 한국어 UI는 한국어 무료를 우선하며 영어 무료, 논문/심화, 이용 조건 확인으로 구분한다. 기존 영어 교재·공식 강의·논문·외부 실습과 6단원/계산기/장 탐색을 유지했다. 출판사 서지 링크를 무료 원문으로 표시하지 않는다.

- [건양대학교 · 정원식 · KOCW, 2025-1](https://www.kocw.net/home/search/kemView.do?kemId=1534717): 소개, MDP/할인율, Bellman, TD를 해당 단원에 연결한다.
- [영남대학교 · 최규상 · KOCW, 2025-2](https://www.kocw.net/home/search/kemView.do?kemId=1536047): 정확한 [SARSA 차시](https://www.kocw.net/home/cview.do?lid=3a577ef03953e2a6), [Q-Learning 차시](https://www.kocw.net/home/cview.do?lid=c130b77c3de0a514), DQN/Policy Gradient/Actor-Critic/분류 자료를 연결한다.
- [김성훈 · 모두를 위한 머신러닝/딥러닝](https://hunkim.github.io/ml/): 공개 RL 강의 목록·Q-table·탐색/할인·DQN·미분 자료를 연결한다. 실습은 역사적 TensorFlow 1.x 자료라고 안내한다.
- [한양대학교 ERICA · 박태준 · K-MOOC](https://www.kmooc.kr/view/course/detail/8010): 소개와 청강 신청 표시만 확인했다. 표시 운영 기간은 2023-11-06~12-17이며 현재 무료 청강은 **미검증**으로 분류한다.

KOCW는 검색 도구의 redirect loop가 있어 게스트 Edge로 직접 확인했다. [대표 차시 6개 재생 확인 결과](korean-resource-verification.json)와 [공식 차시 링크 목록](kocw-lecture-links.json)을 보관하며 `node scripts/verify-korean-resources.mjs`로 재현할 수 있다. 강의 원본/영상/HTML을 복제해 배포하지 않는다. 모든 차시를 끝까지 시청했거나 앞으로도 항상 무료라고 주장하지 않는다.

## 14. 테스트 및 E2E

| 명령 | 최종 결과 |
| --- | --- |
| `npm run lint` | 오류/경고 0 |
| `npm test` | 69 파일, 1,240 테스트 통과 (41.50초) |
| `npm run build` | TypeScript 및 Vite 성공; JS 486.39 kB / gzip 132.20 kB, CSS 59.19 kB |
| `npm run test:e2e` | desktop/mobile 38개 통과 (1.5분) |
| `npm run benchmark` | 기존 성능 벤치마크 3개 통과 (1.3분) |
| 홈 비교 표본 재실행 | desktop 단독 1개 통과 (8.3초) |
| `git diff 4a4b80c --check` | 기준 커밋 대비 공백 검사 통과 |

신규 검증에는 원본 41개 JSON 해시, 20개 실제 성공 경로, 모든 난이도 빈도와 seed 재현, 카드별 실제 이동/독립 교체, 입력 상태 해제, 6단원/로드맵 자료 조건 구분이 포함된다. E2E는 카드 존재뿐 아니라 각 에이전트의 위치 변화와 완료 후 해당 슬롯의 ID 교체를 검증한다.

기존 테스트를 임의 삭제하지 않았다. 구 프리셋 ID에 결합된 적용/구조/왕복/미리보기 기대를 새 공식 맵의 동등한 기능으로 옮겼다. 기하 감사의 벽 비율·도달률·갈림길·목표 조건은 유지하고 ZIP 대조를 추가했다. 전체 테스트 파일 교체 시도는 자동 승인 검토가 검증 약화를 이유로 거부했고, 해당 조건을 유지하는 방식으로 해결했다.

201회 학습 테스트는 8ms Scheduler가 GC/부하에 따라 다음 프레임으로 양보할 수 있으므로 완료를 기다린 뒤 같은 201회/요약 수를 검증하도록 고쳤다. 학습 제한을 바꾸지 않았다. 초기 벤치마크 하나는 개발 중 HMR 재로딩으로 중단되어 수치에서 제외했고, 소스를 고정해 전체 3개를 다시 통과했다.

## 15. 성능 측정

Windows, Node 24.19.0 / npm 11.17.0, Edge 156 headless다. 변경 전/후 데스크톱 5초 표본은 동일 Playwright viewport에서 별도 실행했다. **4개 고정 작은 맵과 새 랜덤 맵은 작업량이 다르므로 속도 향상 배수로 해석하지 않는다.**

| 5초 desktop 표본 | 변경 전 `4a4b80c` | 변경 후 |
| --- | --- | --- |
| 렌더링 셀 수 | 120 | 550 |
| 평균 rAF 간격 | 16.87 ms | 16.64 ms |
| p95 rAF 간격 | 17.20 ms | 17.20 ms |
| 활성 interval | 1 | 1 |
| 시작 GC heap | 2,448,296 bytes | 4,218,644 bytes |
| 5회 화면 왕복 후 GC heap | 4,047,792 bytes | 4,735,904 bytes |

[이전 원시 표본](../benchmarks/results/before-catalog-4a4b80c-home-desktop.json) / [이후 원시 표본](../benchmarks/results/after-catalog-home-desktop.json). 이후 표본의 navigation 포함 CDP 비용: Script 69.264ms, Layout 56.885ms, RecalcStyle 44.441ms, Task 451.919ms. 이전 버전에는 같은 CPU 계측값이 없어 CPU 개선 비교 수치를 주장하지 않는다.

| 30초 홈 | 노출된 서로 다른 맵 | 시작 → 30초 GC heap | interval / 이탈 후 |
| --- | --- | --- | --- |
| desktop | 11 | 4,463,768 → 5,493,448 bytes | 1 / 0 |
| mobile | 11 | 4,498,008 → 4,882,716 bytes | 1 / 0 |

새 랜덤 맵의 크기·동적 상태가 달라 heap은 일정하지 않으며 30초 desktop 표본은 증가했다. 무한 누적이 없다고 단정하지 않는다. 자동 교체와 GC 후 변동 추세를 원시 결과로 제공한다.

500,100 step 장시간 기록 표본의 최종 시험장(20번)은 Q 상태 2,541개, 보관 step 334,379개였으며 성공 0회(Bomb 110 / 시간 제한 48)였다. 이는 기록 한도·조작 가능성을 검증하는 표본이며 학습 성공을 주장하지 않는다. 제공된 성공 경로의 정상 완료 검증과 별개다. [엔진 처리량](../benchmarks/results/after-catalog.json), [스냅샷 비용](../benchmarks/results/after-catalog-retained-costs.json), [장시간 보관](../benchmarks/results/after-catalog-long-run.json), [UI desktop](../benchmarks/results/after-catalog-ui-desktop.json), [UI mobile](../benchmarks/results/after-catalog-ui-mobile.json)을 보관한다.

30초 실제 홈 실행의 [desktop](../benchmarks/results/after-catalog-home-30s-desktop.json)/[mobile](../benchmarks/results/after-catalog-home-30s-mobile.json)에서 5초마다 현재 4개 ID·진행·GC heap·타이머를 기록했다. 자동 교체와 단일 interval을 확인하고 홈 이탈 시 0개를 확인했다. 이는 짧은 관찰이지 수 시간 실행의 메모리 무누수 증명은 아니다.

기존 엔진 벤치마크 3개도 실행했다. 7/14/20 환경의 10초×2 처리량, 전체/가벼운 Q 스냅샷, GC 후 보관량, 새 카탈로그 중 01–08 및 20의 500,100 step을 검증한다. 장시간 상세 보관 테스트는 Q 예산 1,000,000으로 기록 정책을 분리해 시험하며 앱의 기본 100,000 Q 안전장치는 유지한다. 동기 CPU step 처리율을 UI 처리율로 혼용하지 않는다.

## 16. 브라우저 스크린샷

1366×768, 1440×900, 1920×1080, 768×1024, 390×844에서 확인했다. 고정 RNG와 제어 가능한 시계로 4개 마커의 이동과 첫 카드만 교체되는 시점을 검증하고, 큰 맵 비율·확대 경로 탐색·중복 없는 섞기·난이도별 5개·교차 언어 검색·확인 취소/적용·모바일 터치 해제를 확인했다.

| 해상도 | 홈 4개 시연 | 20×20 확대 | 프리셋 | 자료 |
| --- | --- | --- | --- | --- |
| 1366x768 | [홈](screenshots/catalog-home-1366x768.png) | [확대](screenshots/catalog-preview-1366x768.png) | [갤러리](screenshots/catalog-presets-1366x768.png) | [가이드](screenshots/catalog-resources-1366x768.png) |
| 1440x900 | [홈](screenshots/catalog-home-1440x900.png) | [확대](screenshots/catalog-preview-1440x900.png) | [갤러리](screenshots/catalog-presets-1440x900.png) | [가이드](screenshots/catalog-resources-1440x900.png) |
| 1920x1080 | [홈](screenshots/catalog-home-1920x1080.png) | [확대](screenshots/catalog-preview-1920x1080.png) | [갤러리](screenshots/catalog-presets-1920x1080.png) | [가이드](screenshots/catalog-resources-1920x1080.png) |
| 768x1024 | [홈](screenshots/catalog-home-768x1024.png) | [확대](screenshots/catalog-preview-768x1024.png) | [갤러리](screenshots/catalog-presets-768x1024.png) | [가이드](screenshots/catalog-resources-768x1024.png) |
| 390x844 | [홈](screenshots/catalog-home-390x844.png) | [확대](screenshots/catalog-preview-390x844.png) | [갤러리](screenshots/catalog-presets-390x844.png) | [가이드](screenshots/catalog-resources-390x844.png) |

[직접 플레이 desktop](screenshots/catalog-held-desktop.png) / [직접 플레이 mobile](screenshots/catalog-held-mobile.png). 총 22장.

## 17. 변경 파일

데이터: `src/data/presets/{maps,solutions}/*.json` 각 20개, `catalog.json`, `manifest.ts`, 원본 해시/전이 검증 테스트. 공식 목록 wrapper와 갤러리/편집기/i18n을 갱신하고 구 complex preset 정의를 제거했다.

홈: `App.tsx`, `Home.tsx`, `GridDemo.tsx`, `demoPlayback.ts`, `index.css`. 직접 플레이: `ManualPlay.tsx`, `heldMovement.ts`. 자료: `guide/ResourceLinks.tsx`, `learningResources.json`, `StudyResources.tsx`. `Simulator.tsx`는 외부의 명시적 환경 초기화 후 오래된 분석 선택을 정리한다.

관련 기존/신규 unit·통합·E2E, `benchmarks/performance.spec.ts`, 원시 결과 JSON, `.gitattributes`, 자료 확인 스크립트, README, 이 보고서, 원본 68개와 스크린샷 22개를 포함한다. [원본 파일 전체 목록](preset-source/inventory.json)을 제공한다. 의존성을 추가하지 않았다.

## 18. 알려진 제한 사항

K-MOOC의 현재 청강은 미검증이다. 공개 강의/영상 제공 상태는 확인일 이후 달라질 수 있다. 큰 미니맵의 세밀한 요소는 확대 기능을 사용한다. 모바일은 Chromium 에뮬레이션과 실제 Touch 이벤트 검증이며 물리 iOS Safari 기기 검증은 아니다.

원본 성공 경로는 최단 경로나 학습 수렴 보장이 아니다. 복잡한 실제 학습은 Q 예산에 도달하거나 많은 경험이 필요할 수 있다. 홈은 학습 모델이 아닌 검증 경로 시연이다. 자료·지도·입력 기능을 추가하면서 기존 bounded history의 오래된 경로 복구 불가와 새로고침 시 메모리 실험 소실 정책은 바꾸지 않았다.

## 19. 검증 대상 커밋

| SHA | 내용 |
| --- | --- |
| `3ed5cfa95ede664f33eb8b557327b5f6ba3a2dab` | 원본 20종 카탈로그 교체 및 실제 경로 검증 |
| `0f4d8ab6da202adcef6bc1bf4cfc17fef7c69acd` | 공용 프리셋 기반 4개 독립 홈 시연 |
| `cba99e873a04f6641cd17a1ed42ede8f6cf2c4fd` | 직접 플레이 키보드/터치 반복 이동 |
| `ec286d42091f7f7ae676856538b4e67281d2a33d` | 검증 상태를 구분한 한국어 학습 자료 |
| `55f1ead58f70eebd8b52e0a3bc7483969ffc6079` | 워크플로·홈 순환·자원 해제 E2E와 성능 결과 |

문서 자체의 SHA를 문서 안에 재귀적으로 기록할 수 없으므로, 위 구현/검증 대상 SHA와 별도 문서 커밋을 구분한다. 문서까지 포함한 최종 SHA는 최종 사용자 보고와 `git rev-parse HEAD`로 확인할 수 있다.

## 20. 원격 푸시 및 배포 상태

2026-10-26 `git push origin feat/home-redesign` 성공. 원격 구현/검증 HEAD는 `55f1ead58f70eebd8b52e0a3bc7483969ffc6079`로 확인했다. 이 보고서·README·스크린샷은 별도 마지막 문서 커밋으로 추가 푸시하며 최종 SHA와 원격 일치는 사용자 최종 보고에 기록한다.

최종 단계에서 로컬 HEAD와 `git ls-remote --heads origin main feat/home-redesign`을 비교한다. main은 `987db7b0d9cf7f3ada6c735133ac30c0149dee1c`를 보존한다. GitHub Pages workflow, Vite의 `/RL-Playground/` base와 정적 배포 호환성을 유지하며 main 병합·Pages/Production 배포는 실행하지 않는다.
