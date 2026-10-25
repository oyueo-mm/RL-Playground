# 프리셋 30종 및 실험·퍼즐 UX 개선

작업일: 2026-10-26. 브랜치 `feat/home-redesign`, 기준 `4e63dd101e814ca8ee7f56f8f6dfab71ead76f3e`.

## 1. 결과와 중요한 제한

사용자 ZIP의 공식 환경 30종으로 교체하고, 각 6개인 다섯 난이도를 제공한다. 좌표·보상·행동 경로는 원본 그대로다. 64×64, 전체 화면 갤러리, 이름을 표시하는 도구 팔레트, 적용 후 학습 화면 이동, 카메라 조작과 분석 패널 크기 조절을 구현했다. 기존 홈 4개 독립 시연·Shuffle Bag·직접 플레이·가이드·희소 Q-table 및 기록 한도를 재사용한다.

**해결 가능한 맵이라는 사실과 모든 플레이 상태가 안전하다는 사실은 다르다.** 30개 모두 실제 TypeScript 성공 경로를 통과했다. 그러나 11번 유적 회수 작전은 붕괴 후 남은 Goal 회수가 불가능한 상태가 발견됐다. 이 원본은 변경하지 않았고 갤러리에 경고한다. 큰 상태 공간은 한도 때문에 동적 안전성 검증이 미완료다. 성공이나 미완료를 난이도·학습 수렴·무감옥 보장으로 표현하지 않는다.

## 2. 원본 ZIP 확인

[원본 파일 목록 및 해시](preset30-source/inventory.json), [ZIP 검증 기록](preset30-provenance.json), [사용자가 제공한 감사 보고서](preset30-source/reports/30종_전수감사_리디자인_보고서.md)를 보관한다.

- ZIP: `RL_Playground_30_Reworked_Presets.zip`, 826,694 bytes.
- SHA-256: `df3b07ce5e6b49a9a078b216b6816c579477beb40ad40e7ee620cf3192e8bbcc`.
- 102개 원본 파일 전체 CRC 및 SHA 확인. 환경 30개·경로 30개·manifest와 원본 바이트를 대조했다.
- PNG 36개를 디코딩 검증하고 [전체 미리보기](preset30-source/00_전체_30종_미리보기.png)를 확인했다.
- HTML의 내장 환경/경로 30쌍과 별도 JSON이 일치한다. HTML의 독립 전이 코드를 앱 엔진 대신 사용하지 않았다.
- 원본 보고서 JSON은 이전 감사 20건, 개편 후 검사 30건이다. 원본의 정적 검사 가정과 한계를 그대로 구분했다.

원본 감사 Markdown의 의도적인 두 칸 줄바꿈도 보존한다. 해당 불변 보고서 경로만 Git 공백 검사에서 제외하며 앱 코드와 새 문서는 그대로 검사한다.

첨부 README/보고서는 데이터 및 설계 설명으로 읽었다. 별도 실행 지시나 승인 조건으로 취급하지 않았다. 현재 사용자 요청에 따라 구현·검증하며 main 병합과 배포는 하지 않았다.

## 3. 카탈로그 교체와 데이터 보존

`src/data/presets/{maps,solutions}`의 구 공식 20종을 제거하고 원본 30종을 등록한다. `catalog.json`은 원본 `manifest.json`, `manifest.ts`는 한영 메타데이터와 원본 파일/경로/미리보기 연결이다. 크기로 난이도를 추측하지 않는다. 원본 PNG를 lazy 이미지 썸네일로 사용해 갤러리에서 30개 전체 SVG를 동시에 만들지 않는다. 선택한 큰 미리보기 하나만 SVG다.

기존 사용자 JSON·편집 초안·기본 7×7 GridWorld는 유지한다. 기존 원본/보고서와 측정값은 역사적 자료로 보관하며 공식 런타임 카탈로그에 혼합하지 않는다. 이전 맵 번호에 연결된 테스트는 같은 이름의 새 공식 ID로 갱신했다.

## 4. 공식 30종 및 실제 경로 검증

| 번호 | 이름 / English | 난이도 | 크기 | Goal | TS 검증 경로 |
| --- | --- | --- | --- | --- | --- |
| 01 | 초원 산책 / Meadow Walk | 쉬움 | 8×8 | 2 | 10 step · 성공 |
| 02 | 첫 포털 수업 / First Portal Lesson | 쉬움 | 8×8 | 2 | 15 step · 성공 |
| 03 | 문 하나의 비밀 / One Switch, One Door | 쉬움 | 9×9 | 2 | 15 step · 성공 |
| 04 | 조심조심 다리 / Fragile Bridge | 쉬움 | 9×9 | 2 | 15 step · 성공 |
| 05 | 화살표 골목 / Arrow Alley | 쉬움 | 8×10 | 3 | 17 step · 성공 |
| 06 | 수정 정원 / Garden of Choices | 쉬움 | 10×9 | 2 | 20 step · 성공 |
| 07 | 갈림길 마을 / Forked Village | 보통 | 10×10 | 4 | 33 step · 성공 |
| 08 | 습지 우회로 / Marsh Detour | 보통 | 10×10 | 3 | 21 step · 성공 |
| 09 | 이중 포털 광장 / Twin Portal Plaza | 보통 | 10×10 | 4 | 25 step · 성공 |
| 10 | 연구소 동선 / Lab Corridors | 보통 | 11×11 | 4 | 38 step · 성공 |
| 11 | 유적 회수 작전 / Ruin Retrieval | 보통 | 11×11 | 4 | 24 step · 성공 |
| 12 | 시계탑 마을 / Clockwork Village | 보통 | 12×12 | 4 | 35 step · 성공 |
| 13 | 교차로 원정 / Crossroads Expedition | 어려움 | 20×20 | 7 | 114 step · 성공 |
| 14 | 포털 도시 / Portal City | 어려움 | 18×18 | 6 | 48 step · 성공 |
| 15 | 전력 제어 구역 / Power Control Zone | 어려움 | 18×18 | 6 | 88 step · 성공 |
| 16 | 붕괴 협곡 / Crumbling Canyon | 어려움 | 16×18 | 5 | 47 step · 성공 |
| 17 | 편도 순환선 / One-Way Circuit | 어려움 | 17×17 | 6 | 66 step · 성공 |
| 18 | 격자 없는 폐허 / Shattered Quarter | 어려움 | 20×18 | 6 | 76 step · 성공 |
| 19 | 다중 목표 원정대 / Multi-Goal Expedition | 매우 어려움 | 20×20 | 10 | 81 step · 성공 |
| 20 | 봉인된 연구기지 / Sealed Research Base | 매우 어려움 | 20×20 | 8 | 152 step · 성공 |
| 21 | 붕괴하는 군도 / Collapsing Archipelago | 매우 어려움 | 20×20 | 7 | 89 step · 성공 |
| 22 | 왜곡된 차원문 / Warp Nexus | 매우 어려움 | 20×20 | 8 | 50 step · 성공 |
| 23 | 최종 시험장 / Final Proving Grounds | 매우 어려움 | 20×20 | 8 | 90 step · 성공 |
| 24 | 봉인된 관측소 / The Sealed Observatory | 매우 어려움 | 20×20 | 7 | 112 step · 성공 |
| 25 | 흑요석 성채 / Obsidian Citadel | 극악 | 24×24 | 8 | 165 step · 성공 |
| 26 | 심연의 요새 / Abyssal Fortress | 극악 | 28×24 | 8 | 189 step · 성공 |
| 27 | 무너진 대도시 / Fractured Metropolis | 극악 | 32×32 | 9 | 201 step · 성공 |
| 28 | 네메시스 연구단지 / Nemesis Complex | 극악 | 36×32 | 9 | 234 step · 성공 |
| 29 | 망각의 제국 / Empire of Oblivion | 극악 | 40×40 | 10 | 331 step · 성공 |
| 30 | 끝없는 회랑 / The Endless Labyrinth | 극악 | 48×40 | 10 | 312 step · 성공 |

JSON은 기존 `parseEnvImport()`/`validateDraft()`를 사용한다. 각 행동을 실제 `GridWorldEnv.step()`으로 실행하고, Bomb 실패 없음·마지막 행동에서만 종료·모든 Goal 수집·행동 수·수집 순서·이벤트 집계를 확인한다. [맵별 기계 판독 결과](preset30-audit.json)의 witness 필드에도 성공과 최종 전체 상태를 기록한다.

원본 이벤트 집계의 `goal`은 이미 수집한 Goal 재방문도 포함한다. 실제 보상/수집 순서는 첫 방문만 기록하며 마지막 이동은 `success`로 집계한다. 6개 파일에서 보였던 1–2회 차이는 이 집계 규약으로 설명되며 규약에 맞춰 비교하면 30개 모두 일치한다. 좌표·보상·원본 경로를 수정하지 않았다.

## 5. 감옥 및 우회로 감사

`audit.ts`는 두 검사를 구분한다.

1. 완화된 정적 방향 그래프: 모든 문 열림, 모든 붕괴 바닥 온전함, Bomb을 통과 가능한 위치로 취급. 벽/경계 방향 화살표와 시작점 역도달성을 검사한다. 30종 모두 막힌 화살표와 정적 귀환 불가 칸이 0개다. 이는 동적 안전 증명이 아니다.
2. 실제 전체 상태 그래프: 위치·Goal mask·붕괴 mask·스위치 그룹 mask를 보존하는 `GridWorldEnv.fork()`와 실제 `step()`으로 탐색한다. Bomb/비성공 종료는 성공 후보에서 제외한다. 성공 종료점의 역방향 도달성을 계산해 성공 불가능 상태를 구분한다. 검사당 최대 5,000개 상태이며 한도 초과는 `incomplete`, losingStates는 `null`이다.

| 맵 | 전체 상태 감사 | 탐색 상태 | 목표 회수 불가 상태 | 필수/우회 검사 |
| --- | --- | --- | --- | --- |
| 01_meadow_walk | 완료 | 172 | 0 | 해당 없음 |
| 02_first_portal_lesson | 완료 | 169 | 0 | 포털: 선택 경로 |
| 03_one_switch_one_door | 완료 | 318 | 0 | 스위치: 필수 확인 |
| 04_fragile_bridge | 완료 | 856 | 0 | 붕괴: 선택 경로 |
| 05_arrow_alley | 완료 | 502 | 0 | 해당 없음 |
| 06_garden_of_choices | 완료 | 247 | 0 | 해당 없음 |
| 07_forked_village | 완료 | 1,262 | 0 | 해당 없음 |
| 08_marsh_detour | 완료 | 600 | 0 | 해당 없음 |
| 09_twin_portal_plaza | 완료 | 1,352 | 0 | 포털: 선택 경로 |
| 10_lab_corridors | 한도 초과 · 미완료 | 5,000 | 미판정 | 스위치: 필수 확인 |
| 11_ruin_retrieval | 완료 | 4,887 | 624 | 붕괴: 필수 확인 |
| 12_clockwork_village | 완료 | 2,643 | 0 | 스위치: 필수 확인 |
| 13_crossroads_expedition | 한도 초과 · 미완료 | 5,000 | 미판정 | 스위치: 미검증 / 포털: 미검증 / 붕괴: 미검증 |
| 14_portal_city | 한도 초과 · 미완료 | 5,000 | 미판정 | 포털: 미검증 |
| 15_power_control_zone | 한도 초과 · 미완료 | 5,000 | 미판정 | 스위치: 필수 확인 |
| 16_crumbling_canyon | 한도 초과 · 미완료 | 5,000 | 미판정 | 붕괴: 선택 경로 |
| 17_one_way_circuit | 한도 초과 · 미완료 | 5,000 | 미판정 | 포털: 미검증 |
| 18_shattered_quarter | 한도 초과 · 미완료 | 5,000 | 미판정 | 스위치: 필수 확인 / 포털: 미검증 / 붕괴: 미검증 |
| 19_multi_goal_expedition | 한도 초과 · 미완료 | 5,000 | 미판정 | 포털: 미검증 / 붕괴: 미검증 |
| 20_sealed_research_base | 한도 초과 · 미완료 | 5,000 | 미판정 | 스위치: 미검증 / 포털: 미검증 |
| 21_collapsing_archipelago | 한도 초과 · 미완료 | 5,000 | 미판정 | 스위치: 미검증 / 포털: 미검증 / 붕괴: 미검증 |
| 22_warp_nexus | 한도 초과 · 미완료 | 5,000 | 미판정 | 포털: 미검증 |
| 23_final_proving_grounds | 한도 초과 · 미완료 | 5,000 | 미판정 | 스위치: 필수 확인 / 포털: 미검증 / 붕괴: 미검증 |
| 24_the_sealed_observatory | 한도 초과 · 미완료 | 5,000 | 미판정 | 스위치: 필수 확인 / 포털: 미검증 / 붕괴: 미검증 |
| 25_obsidian_citadel | 한도 초과 · 미완료 | 5,000 | 미판정 | 스위치: 필수 확인 / 포털: 미검증 / 붕괴: 미검증 |
| 26_abyssal_fortress | 한도 초과 · 미완료 | 5,000 | 미판정 | 스위치: 필수 확인 / 포털: 미검증 / 붕괴: 미검증 |
| 27_fractured_metropolis | 한도 초과 · 미완료 | 5,000 | 미판정 | 스위치: 필수 확인 / 포털: 미검증 / 붕괴: 미검증 |
| 28_nemesis_complex | 한도 초과 · 미완료 | 5,000 | 미판정 | 스위치: 미검증 / 포털: 미검증 / 붕괴: 미검증 |
| 29_empire_of_oblivion | 한도 초과 · 미완료 | 5,000 | 미판정 | 스위치: 필수 확인 / 포털: 미검증 / 붕괴: 미검증 |
| 30_the_endless_labyrinth | 한도 초과 · 미완료 | 5,000 | 미판정 | 스위치: 필수 확인 / 포털: 미검증 |

완전 검사에서 목표 회수 불가 상태가 없는 맵 10개, 문제 발견 1개(11번, 624개 상태), 한도로 미완료 19개다. Bomb에 의한 의도된 실패는 안전 상태라는 뜻이 아니며 이 수치에서는 별도 종료로 제외한다.

11번의 `losingWitness`를 원본 엔진에서 재생하고 그 상태부터 다시 완전 탐색해 성공 불가능함을 확인하는 자동 테스트를 포함했다. 기존 정적 화살표 문제를 수정한 원본 설계는 유지한다. 이 동적 반례를 해결하려고 임의로 안전 통로를 추가하거나 성공 경로를 바꾸지 않았다.

## 6. 필수 기믹과 선택 경로

같은 실제 상태 탐색에서 스위치·포털·붕괴 바닥 진입을 각각 금지하고 성공 가능성을 검사한다. 금지한 기믹 없이도 성공 경로가 있으면 이를 실제 원본 환경에서 다시 재생한다. 완전 탐색으로 성공 없음이 확인된 경우만 사용 필수로 표시한다. 성공 미발견과 한도 초과가 함께 있으면 미검증이다.

갤러리는 확인된 필수 사용, 사용하지 않는 성공 경로가 있는 선택 요소, 필수 여부 미검증을 구분한다. 첫 포털 수업/이중 포털 광장의 포털, 조심조심 다리/붕괴 협곡의 붕괴 경로는 우회 가능한 선택 요소다. 원본 보고서도 일부 다리를 위험한 지름길로 설명한다. 모든 특수 요소를 강제로 밟아야 한다고 가정하지 않는다. 봉인 구역 우회는 전체 상태 탐색 한도를 넘는 맵에서 완전 부재를 증명하지 못했다.

사람 대상 난이도 플레이 테스트는 별개다. 성공 경로 길이, 맵 크기, 정적 검사만으로 극악 난이도를 확정하지 않았다.

## 7. 64×64 확장

편집기 `MAX_SIZE`, 실제 feature 검증, 가로·세로 HTML 입력 상한을 64로 확장했다. 각 축은 독립적이다. 32×20·40×32·48×40·64×64의 실제 이동·Goal 종료·JSON 왕복과 65 초과 거부를 테스트한다. 엔진의 기존 1–2칸 테스트 환경은 유지하고 사용자 편집기 최소 크기는 3이다.

크기를 줄이면 기존 crop 처리로 경계 밖 요소를 제거한다. 일부만 남은 포털/그룹은 자동 재연결하지 않고 명확한 검증 오류로 표시해 사용자가 수정하거나 Undo할 수 있게 한다. 시작점/Goal이 잘려 유효하지 않으면 적용을 차단한다. 원본을 조용히 ‘수리’하지 않는다.

4096개 셀의 상태 키는 기존 문자열 및 BigInt mask 표현을 유지한다. 전체 Q 스냅샷을 요청할 때 불필요한 셀별 visible-key 배열을 만들지 않게 했다. 실제 대형 SVG·정책·가치 오버레이 비용은 아래 측정에 기록한다. Canvas/Worker로 재작성하지 않았다.

## 8. 전체 화면 프리셋 갤러리

화면 전체를 차지하는 모달 영역으로 바꿨다. 제목/닫기, 전체 30개와 난이도별 6개 탭, 기존 검색/크기/요소/유형 필터, 큰 선택 미리보기, 기믹과 감사 상태를 제공한다. 데스크톱은 3열(1600px 이상 4열), 모바일은 2열 카드와 위쪽 상세 미리보기다.

미리보기는 실험을 변경하지 않는다. 학습 적용은 기존 초기화 확인, 편집기 불러오기는 초안 변경과 Undo를 유지한다. Escape·Tab 순환·닫기 후 포커스 복원을 제공한다. 배경의 Simulator는 언마운트하지 않는다.

## 9. 편집 팔레트와 환경 적용

기본 요소/특수 요소/보조 도구로 묶고, 모든 도구에 실제 요소를 닮은 기존 SVG 아이콘과 짧은 이름을 함께 표시한다. 선택 강조와 한 줄 사용법, 44px 이상의 모바일 터치 높이를 제공한다. 긴 설명 때문에 보상 설정을 숨기거나 삭제하지 않았다. 드래그·덮어쓰기·자동 연결·방향 회전·Delete/Backspace·Undo/Redo를 유지한다.

확인 후 환경 적용은 한 번만 `engine.reset()`을 호출하고 학습 환경으로 이동한다. 카메라를 화면 맞춤으로 돌리고 닫을 수 있는 완료 메시지를 표시한다. 편집기를 숨길 뿐 언마운트하지 않으므로 자체 적용으로 Undo 기록을 지우지 않는다. 자동 이동 후 다시 편집기로 돌아와 Undo하는 통합 테스트를 추가했다.

## 10. PC 카메라

`CameraViewport`/`camera.ts`가 화면 맞춤 배율을 기준으로 카메라를 관리한다. 커서 중심 wheel 줌, 학습 화면 왼쪽 드래그, 가운데 버튼 드래그, 편집기 Space+왼쪽 드래그, 트랙패드 이동, 기존 ±/맞춤 버튼을 제공한다. 에이전트 중심 이동과 따라가기도 지원한다. 큰 맵에는 전체 범위 대비 현재 시야와 에이전트를 표시하는 작은 내비게이터가 있다.

커서 중심 확대는 `newPan = cursor - (cursor - oldPan) × scaleRatio`로 같은 맵 좌표를 유지한다. 범위는 맞춤 기준 25%–2400%다. 편집 pan 시작 시 배치 드래그를 취소하고 카메라 제스처가 요소를 배치하지 않게 한다.

WheelEvent는 기기 종류를 확정할 수 없어 작은 pixel delta/수평 delta는 트랙패드 이동으로, 큰 delta/line delta는 줌으로 분류한다. Ctrl+wheel/pinch는 줌이다. 일부 마우스/트랙패드 설정에서는 의도와 다른 분류가 가능하며 ±/맞춤/드래그를 항상 사용할 수 있다.

## 11. 모바일 및 분석 패널

남는 가로/세로 공간을 ResizeObserver로 측정해 전체 맵을 최대 맞춤한다. 맵 크기·화면 방향·분석 패널 크기 변경 시 재계산한다. 두 손가락 확대/이동, 취소 시 포인터 상태 해제를 지원하며 편집 동작과 분리한다.

분석 패널의 손잡이는 모바일에서 위/아래 높이, 데스크톱에서 좌우 너비를 조절한다. 키보드 방향키로도 조절하고 Home/더블클릭으로 기본 크기를 복원한다. 닫기 버튼으로 완전히 접어 맵 공간을 돌려준다. 드로어 visibility와 크기만 변경하므로 데이터/셀/에피소드 상태는 유지한다.

모바일 언어 선택기는 별도 상단 공간에 배치했다. 실행 컨트롤/직접 플레이/분석 위에 겹치지 않는다. 줌 컨트롤과 내비게이터는 지도 모서리에 둔다. 48×40 직접 플레이와 64×64 전체 표시를 브라우저에서 검사한다.

## 12. 학습 중 낭비와 결과 실행의 구분

일반 학습은 기존 최대 에피소드 스텝과 Q/기록 한도를 유지한다. 연속 16회 상태가 변하지 않을 때만 네 행동의 실제 fork 전이를 검사한다. **어떤 행동도 전체 상태를 바꾸지 못하는 경우만** 물리적 이동 불가로 확정해 조기 truncation하고 `trapped`로 기록한다. 일반 재방문, 탈출 경로가 있는 정책 반복, 다중 셀 영역을 임의 오류로 간주하지 않는다. 증명하지 못한 구조적 감옥에는 기존 스텝 제한이 적용된다.

이 조기 중단은 환경의 목표/Bomb terminal 규칙을 바꾸지 않는 시간 절단이다. `done=false, truncated=true`로 TD bootstrap을 보존하고 통계에 실패 에피소드를 일관되게 기록한다. 단순히 수십 번 재방문했다는 이유로 종료하지 않는다.

## 13. 고정 정책 재생

학습 결과 실행은 250ms/step으로 별도 설정하고, 학습 속도 슬라이더에는 실제 250ms를 표시하며 변경을 비활성화한다. Pause/Resume에서도 유지하고 성공·반복 종료·중단·초기화 시 이전 설정을 정확히 복원한다.

전체 상태 재등장은 Q가 고정된 결정적 argmax 정책에서 같은 다음 행동과 전이를 보장하므로 반복을 확정한다. ‘학습된 정책이 반복 경로에 진입했습니다.’를 표시하고 `policy-loop`로 기록한다. 성공으로 집계하지 않는다. Q의 읽기 전용 조회를 추가해 미방문 상태의 영벡터 행조차 만들지 않으며 Q 값·행 수·버전이 그대로다. SARSA의 이전 pending action도 결과 실행 시작 시 제거한다.

## 14. 학습 처리량 변경

기존 프로파일의 100 step/frame 상한은 60Hz에서 약 6000 step/s로 제한됐다. 배치 100 이상은 `setTimeout(0)`으로 작업 사이에 이벤트 루프를 양보한다. 작은 배치는 기존 rAF, interval 모드는 그대로다. 배치당 8ms CPU 양보·generation 토큰·속도 변경 시 올바른 API로 취소·UI 전달 빈도 제한·Q/기록 예산을 유지한다. 필드명 `stepsPerFrame`은 기존 API 호환을 위해 유지하지만 UI는 ‘스텝/배치’라고 표시한다.

단계마다 전이·TD 업데이트·기록을 생략하지 않는다. 같은 seed의 5,000 step에서 수동/배치 실행의 전체 Q값·상태·통계·마지막 전이가 Q-Learning/SARSA 모두 동일함을 테스트한다.

[같은 조건의 원시 비교](../benchmarks/results/paired-training-30.json): 기준 커밋을 워크스페이스 안의 임시 detached worktree로 준비했다. 두 버전 모두 홈을 떠나 시연을 끄고 1366×768 Edge, seed 12345, α=.1/γ=.9/ε=.3, batch=100, 기본 Q 100,000/기록 500,000/에피소드 10,000 예산, 같은 UI 구독과 5,000 step 워밍업으로 비교했다. 맵/버전별 5초×2회, 실행 순서를 반대로 교대했다. 체크아웃과 서버는 측정 후 제거했다.

| 환경 | 이전 평균 step/s | 이후 평균 step/s | 비율 | rAF p95 이전 → 이후 | 직접 Pause 비용 범위 |
| --- | --- | --- | --- | --- | --- |
| 7×7 | 6,002 | 12,385 | 2.06× | 22.2 → 21.9ms | 0.2–0.4ms |
| 20×20 | 6,039 | 12,370 | 2.05× | 20.9 → 22.5ms | 0.4–0.7ms |

이 표는 해당 PC의 짧은 재현 표본이며 모든 기기/환경에서 같은 비율을 보장하지 않는다. 처리량은 증가했지만 프레임 지연이 개선됐다고 주장하지 않는다. 직접 API Pause 비용과 실제 버튼 클릭 지연은 별도다. 본 UI의 30초 학습 측정은 아래 원시 결과에 별도로 기록한다. 이전 `before-30.json`은 홈 애니메이션이 켜진 초기 탐색 표본이므로 위 개선 비율 계산에는 사용하지 않았다.

[대형 맵 원시 결과](../benchmarks/results/large-30-render.json)는 정책/가치 오버레이를 켠 실제 SVG의 초기 렌더, 100,000회 전이+상태 키 호출, 2초 학습을 측정한다. 48×40은 공식 30번의 실제 지형이며 나머지는 크기별 기본 환경이다.

| 환경 | 초기 표시 | 100,000 전이/키 조회 | 학습 중 rAF p95 | 직접 Pause | 2초 구간 학습 step |
| --- | --- | --- | --- | --- | --- |
| 20×20 | 35.4ms | 107.2ms | 44.9ms | 0.5ms | 20,100 |
| 32×20 | 92.9ms | 248.1ms | 83.8ms | 0.6ms | 11,400 |
| 48×40 | 124.2ms | 366.8ms | 96.0ms | 1.4ms | 8,630 |
| 64×64 | 356.5ms | 177.0ms | 88.3ms | 2.1ms | 9,100 |

64×64의 첫 SVG 표시는 약 357ms였고, 오버레이를 켠 큰 맵의 p95 프레임 간격은 약 84–96ms였다. 이 구간을 60fps라고 주장하지 않는다. 기존 정적 지형 memo를 유지하고 썸네일은 PNG로 분리했다. 더 큰 렌더링 구조 변경은 편집 접근성/기능과 함께 후속 검토할 수 있다.

[전체 엔진 벤치마크](../benchmarks/results/after-30.json), [GC 후 Q/기록 비용](../benchmarks/results/after-30-retained-costs.json), [9개 대응 맵 500,100 step 보관 시험](../benchmarks/results/after-30-long-run.json)을 보관한다. 9개는 기존 01–05·갈림길 마을·습지 우회로·이중 포털 광장·최종 시험장의 새 대응 ID다. 장시간 기록 시험의 Q 예산만 1,000,000으로 분리했고 앱 기본은 100,000이다. 학습 성공률을 보장하는 시험이 아니다.

| 실제 UI 30초 | Pause / Resume / Stop 클릭 | rAF p95 | 종료 GC heap → 화면 10회 왕복 후 |
| --- | --- | --- | --- |
| desktop | 82 / 79 / 83ms | 25.9ms | 11,631,216 → 12,259,968 bytes |
| mobile | 301 / 203 / 52ms | 26.6ms | 11,524,200 → 12,312,308 bytes |

[UI desktop](../benchmarks/results/after-30-sustained_ui_sample-desktop.json) / [UI mobile](../benchmarks/results/after-30-sustained_ui_sample-mobile.json), [동적 맵 desktop](../benchmarks/results/after-30-dynamic_memory_sample-desktop.json) / [동적 맵 mobile](../benchmarks/results/after-30-dynamic_memory_sample-mobile.json). E2E는 2 worker로 수행했다. 짧은 표본의 heap 증가/변동을 그대로 공개하며 장기 무누수를 증명했다고 표현하지 않는다.

[홈 desktop 30초](../benchmarks/results/after-30-home-30s-desktop.json) / [홈 mobile 30초](../benchmarks/results/after-30-home-30s-mobile.json)는 4개 독립 진행/교체와 interval 1개, 홈 이탈 후 0개를 확인한다. 큰 지도와 경로 길이에 따라 heap과 표시 맵 수가 달라진다.

## 15. 홈과 직접 플레이 보존

기존 `DemoPlayback`/Shuffle Bag의 데이터 소스를 새 30종으로 바꿨다. 중복 없는 4개·카드별 완료 교체·전체 일시정지/재개·섞기·확대 경로 탐색·확인 후 실험 연결을 유지한다. 길이별 간격/이벤트 정지, 현재 4개의 환경만 보관, 한 개 타이머, 탭 숨김/화면 이탈/reduced-motion 처리도 유지한다.

48×40 원본 viewBox와 실제 전이를 홈에서 확인한다. 작은 카드에서 자세한 셀이 작아지는 한계는 확대 미리보기로 보완한다. 이것은 검증 경로 시연이며 Q-Learning/SARSA 성과라고 표시하지 않는다.

직접 플레이의 200ms 지연/100ms 반복·다중 키 우선순위·키 해제·blur/탭 숨김/이탈/재시작/종료 정리·터치 방향 버튼은 그대로다. 대형 맵에서는 카메라의 중심 이동/따라가기와 내비게이터, 기존 목표 수/이동 횟수/보상을 함께 사용한다. 별도 환경이므로 학습 Q-table을 변경하지 않는다.

## 16. 테스트 및 브라우저 결과

| 검증 | 결과 |
| --- | --- |
| `npm run lint` | 오류/경고 0 |
| `npm test` | 73 파일 / 1,368개 통과 (68.85초) |
| `npm run build` | TypeScript 및 Vite 성공; JS 644.40kB / gzip 148.34kB, CSS 63.26kB / gzip 14.36kB |
| `npm run test:e2e -- --workers=2` | 44개 통과 (3.3분) |
| `npm run benchmark` | 기존 3개 및 대형 SVG 1개, 총 4개 통과 (2.0분) |
| `node scripts/compare-training30.mjs` | 기준/현재 8개 동일 조건 표본 저장 |
| `git diff 4e63dd1 --check` | 공백 검사 통과; 원본 Markdown 줄바꿈 제외는 2절 참조 |

빌드는 성공했지만 단일 minified JS가 500kB를 넘어 Vite의 chunk 크기 경고가 남는다. 한도를 올려 숨기지 않았다. gzip 크기는 148.34kB이며, 배포 전 요청/캐시 특성을 고려한 분할은 후속 최적화 여지다. [lint 로그](validation/preset30-lint.txt), [전체 테스트 로그](validation/preset30-test.txt), [빌드 로그](validation/preset30-build.txt), [E2E 로그](validation/preset30-e2e.txt), [벤치마크 로그](validation/preset30-benchmark.txt)를 보관한다.

기존 테스트를 삭제하지 않았다. 번호가 바뀐 공식 맵 테스트는 새 ID로 대응하고, 이전 ‘개방형 지형’ 기하 조건은 변경 없는 역사적 원본 20개에 계속 적용한다. 새 퍼즐의 안전성은 별도 전체 상태 감사로 검증한다. 이전에 ‘무한히 실행 중’이던 정책 테스트는 새 자동 종료와 읽기 전용 행 보존을 검증하도록 강화했다.

스케줄러는 8ms에서 양보하므로 동기 한 프레임에 학습이 끝날 것이라고 가정한 기존 테스트는 실제 완료를 기다리게 했다. 홈 lifecycle 테스트는 난수를 고정해 거대한 랜덤 SVG와 JSDOM의 우연한 시간 초과를 피하고, 전체 30개 순환/큰 맵 이동은 별도 테스트에서 유지한다. 4개 해상도를 순회하는 긴 E2E는 충분한 시간 한도를 부여했다.

## 17. 스크린샷

| 해상도 | 홈 48×40 | 전체 갤러리 | 편집 팔레트 | 64×64 학습 화면 | 48×40 직접 플레이 |
| --- | --- | --- | --- | --- | --- |
| 1366x768 | [홈](screenshots/preset30/upgrade30-home-1366x768.png) | [갤러리](screenshots/preset30/upgrade30-gallery-1366x768.png) | [편집](screenshots/preset30/upgrade30-editor-1366x768.png) | [64×64](screenshots/preset30/upgrade30-large-1366x768.png) | [플레이](screenshots/preset30/upgrade30-manual-1366x768.png) |
| 1440x900 | [홈](screenshots/preset30/upgrade30-home-1440x900.png) | [갤러리](screenshots/preset30/upgrade30-gallery-1440x900.png) | [편집](screenshots/preset30/upgrade30-editor-1440x900.png) | [64×64](screenshots/preset30/upgrade30-large-1440x900.png) | [플레이](screenshots/preset30/upgrade30-manual-1440x900.png) |
| 1920x1080 | [홈](screenshots/preset30/upgrade30-home-1920x1080.png) | [갤러리](screenshots/preset30/upgrade30-gallery-1920x1080.png) | [편집](screenshots/preset30/upgrade30-editor-1920x1080.png) | [64×64](screenshots/preset30/upgrade30-large-1920x1080.png) | [플레이](screenshots/preset30/upgrade30-manual-1920x1080.png) |
| 768x1024 | [홈](screenshots/preset30/upgrade30-home-768x1024.png) | [갤러리](screenshots/preset30/upgrade30-gallery-768x1024.png) | [편집](screenshots/preset30/upgrade30-editor-768x1024.png) | [64×64](screenshots/preset30/upgrade30-large-768x1024.png) | [플레이](screenshots/preset30/upgrade30-manual-768x1024.png) |
| 390x844 | [홈](screenshots/preset30/upgrade30-home-390x844.png) | [갤러리](screenshots/preset30/upgrade30-gallery-390x844.png) | [편집](screenshots/preset30/upgrade30-editor-390x844.png) | [64×64](screenshots/preset30/upgrade30-large-390x844.png) | [플레이](screenshots/preset30/upgrade30-manual-390x844.png) |

[패널 조절 desktop](screenshots/preset30/upgrade30-resize-desktop.png) / [mobile](screenshots/preset30/upgrade30-resize-mobile.png), [정책 반복 안내 desktop](screenshots/preset30/upgrade30-policy-desktop.png) / [mobile](screenshots/preset30/upgrade30-policy-mobile.png). 총 29장. 스크린샷은 CSS 전환을 완료해 닫히는 사이드바가 겹쳐 찍히지 않게 했다.

모바일은 Edge/Chromium의 기기 에뮬레이션과 실제 CDP Touch 이벤트 검증이다. 물리 iOS Safari나 사용자 대상 난이도 연구를 수행한 것은 아니다.

## 18. 주요 변경 파일

- 데이터: `src/data/presets/{catalog.json,manifest.ts,audit.ts,auditSummary.json,validateSolutions.test.ts,maps,solutions,previews}`.
- 엔진: `GridWorldEnv.ts`, `features.ts`, `TabularQAgent.ts`, `SimulationEngine.ts`, `Scheduler.ts`, 관련 타입과 통계 종료 원인 UI.
- UI: `CameraViewport.tsx`, `GridViewport.tsx`, `camera.ts`, `PanelResizeHandle.tsx`, `App.tsx`, `Simulator.tsx`, `ManualPlay.tsx`, `GridDemo.tsx`, `MapGallery.tsx`, `EnvEditor.tsx`, `SpeedControl.tsx`, `i18n.ts`, `index.css`, 편집 drag hook.
- 검증: `scripts/audit30.test.ts`, `scripts/compare-training30.mjs`, 기존/신규 unit·통합·E2E, `benchmarks/largeMap.spec.ts`와 원시 JSON 결과.
- 문서: 이 보고서, README, 원본 102개/해시/검증 기록, 브라우저 스크린샷. 외부 의존성을 추가하지 않았다. [정확한 변경 파일 목록](preset30-change-files.txt)을 제공한다.

## 19. 알려진 제한과 미해결 사항

11번의 일부 동적 상태는 실제로 모든 목표 회수가 불가능하다. 원본 보존 요구에 따라 임의 수정하지 않았다. 19개 맵의 5,000 상태 한도 감사는 미완료이며 안전 판정을 내리지 않았다. 동적 상태를 전부 탐색하지 못한 맵의 기믹 우회 부재도 단정하지 않는다. 큰 맵의 human 난이도, tabular RL의 성공률/수렴은 미검증이다.

4096개 셀의 SVG와 정책/가치 오버레이는 비용이 있으며 측정은 짧은 관찰이다. 수 시간 무누수나 모든 저사양 기기 성능을 보장하지 않는다. 휠/트랙패드 구분에는 위의 heuristic 한계가 있다. 기존 가이드의 K-MOOC 현재 무료 청강 미검증 표시는 유지한다. 빌드/성능 경고와 실제 수치는 검증 결과에 그대로 기록한다.

## 20. 커밋과 푸시

| SHA | 내용 |
| --- | --- |
| `ad7be91e593eb8ccaaf040cc4e72dd6ba933a288` | 원본 30종 교체·64×64 검증·전체 상태 감사 |
| `e76ec0b58c01d62b63e6c9761d2c06ecb904002d` | 확정 반복/감옥 처리·읽기 전용 고정 정책 재생·협력적 스케줄링 |
| `9e5d6e6e104412bed8c08ead4ea6f57fb04dcc46` | 전체 화면 갤러리·카메라·편집 팔레트·적용 후 이동·패널 조절 |
| `5eef307dafcf99504a3951a10b96ff5e67e4bc6c` | 44개 E2E·대형 SVG·동일 조건 비교 및 원시 결과 |

2026-10-26 위 구현/검증 커밋을 `origin/feat/home-redesign`에 푸시했고 원격 HEAD `5eef307dafcf99504a3951a10b96ff5e67e4bc6c`와 일치를 확인했다. 이 보고서·스크린샷·로그는 마지막 문서 커밋으로 추가 푸시한다. 최종 문서 포함 HEAD와 푸시 검증은 사용자 최종 보고에 기록한다.

문서 자체의 SHA는 문서 안에 재귀적으로 포함할 수 없어 구현/검증 커밋과 마지막 문서 커밋을 구분한다. 문서까지 포함한 최종 SHA는 사용자 최종 보고 및 `git rev-parse HEAD`로 확인한다. 로컬과 원격 HEAD 일치를 확인하고 main `987db7b0d9cf7f3ada6c735133ac30c0149dee1c`를 보존한다. 배포 workflow와 `/RL-Playground/` base는 유지하며 main 병합·Pages/Production 배포는 실행하지 않는다.
