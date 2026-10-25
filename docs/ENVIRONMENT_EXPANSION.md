# 환경 시스템 확장 및 UI 개선

검증일: 2026-10-25. 작업 브랜치: `feat/home-redesign`. 시작 커밋: `d6701f6`.
기존 React/Vite UI, GridWorldEnv, SimulationEngine/Scheduler 및 Q-Learning/SARSA를 확장했다.

## 1. 전체 변경 사항

- Reward Tile 기능을 제거하고, 해당 데이터가 남아 있는 파일에는 명시적인 오류를 표시한다.
- 셀 선택은 평면 직각 테두리, 키보드 포커스는 별도의 파란 테두리로 표시한다.
- 언어 선택기는 데스크톱 사이드바 하단, 모바일 고정 영역에 하나만 표시한다.
- Portal, One-way, Fragile, Switch/Toggle Wall을 실제 환경 전이부터 편집·저장·학습·시각화까지 연결했다.
- 기존 11개 프리셋을 보존하고 설계된 신규 프리셋 5개를 추가했다.
- 전체 화면 격자, 플로팅 실행/편집 툴바, 속도 슬라이더, 확대·축소·내부 패닝, 분석 드로어를 유지한다.
- 화면·언어 전환 및 패널 토글은 Simulator를 재생성하지 않는다. 학습 상태와 편집 초안은 유지한다. 새 환경 적용은 기존 안내 후 실험을 초기화한다.

주요 변경 파일:

| 영역 | 파일 |
|---|---|
| 타입·전이·검증 | `src/core/environments/gridworld/{types.ts,GridWorldEnv.ts,features.ts}`, `src/core/types/render.ts` |
| 편집·직렬화·프리셋 | `src/viz/controls/{EnvEditor.tsx,envEditorDraft.ts,envEditorIO.ts,MapGallery.tsx,environmentPresets.ts}` |
| 렌더·정책·가치 | `src/viz/grid/{GridSvg.tsx,FeatureOverlay.tsx,stateKey.ts,visibleQEntries.ts,PolicyOverlay.tsx,ValueHeatmap.tsx}`, `src/viz/panels/QValueBars.tsx` |
| 고정 UI·성능 | `src/ui/{App.tsx,i18n.ts}`, `src/ui/hooks/useSimulationEngine.ts`, `src/index.css` |
| 검증 | 환경 요소별 테스트, `featureEditor.test.tsx`, `expandedPresets.test.ts`, `dynamicState.test.tsx`, `src/test/solveGrid.ts`, `e2e/home.spec.ts` |

## 2. Reward Tile 제거

`GridWorldConfig.rewardTiles`, 보상 합산, 렌더 모델의 `cellRewards`, 타일 SVG, 편집 도구·수치 입력·초안·export 필드를 제거했다. 이전 보고서의 전용 기능 설명과 오래된 스크린샷도 갱신했다.

`rewardTiles`라는 문자열이 남는 곳은 호환성 경계와 그 오류 안내/테스트다. 비어 있지 않은 배열이나 잘못된 형식은 엔진 생성 및 JSON import 양쪽에서 거절한다. 빈 배열은 허용하지만 다시 내보내지 않는다. 조용히 삭제하거나 Goal로 변환하지 않는다.

Goal의 기존 수집·보상 분기는 유지했다. 여러 Goal, 최초 방문 보상 1회, 수집 후 숨김, 모든 Goal 수집 시 정상 종료, 새 에피소드 복원 및 `goalReward/stepReward/wallPenalty/bombPenalty`를 보존했다. Goal 비트 연산만 BigInt로 바꾸어 32개를 넘는 기존 맵에서도 비트가 겹치지 않게 했다.

## 3. UI 변경 전후

### 셀 선택

기존 SVG 선택 테두리에 브라우저의 SVG focus outline이 함께 나타나고, 확대 배율에 따라 stroke가 커질 수 있었다. 해당 SVG 셀의 native outline을 제거하고 선택 사각형에 `rx=0`, `strokeWidth=2.5`, `vectorEffect="non-scaling-stroke"`를 적용했다. 키보드 `:focus-visible`에는 파란색 2px 비확대 stroke를 남겼다. 일반 입력·버튼의 포커스 표시는 유지한다. hover는 약한 밝기 변화만 사용한다.

### 언어 선택

상단 중복 선택기를 제거했다. 데스크톱 사이드바는 flex column이며 선택 영역에 `margin-top:auto`를 적용하고 메뉴 영역만 필요 시 스크롤한다. 축소 상태에서도 작은 선택기를 사용할 수 있다. 모바일은 왼쪽 아래 고정 선택기를 사용하고, 사이드바 드로어가 열리면 드로어 내부 선택기만 보인다. 어느 화면에서도 실제 보이는 선택기는 하나다. 다섯 메뉴·사이드바 축소·한국어/영어 전환을 브라우저에서 확인했다.

### 편집기

기본 도구는 접근성 이름이 있는 아이콘으로 유지한다. 추가 도구는 ‘특수 요소’ 팝오버에 모으고, 속성 영역에서 Portal ID, 그룹 ID, 방향을 지정한다. 선택한 포털/그룹의 연결을 점선으로 표시한다. 다른 ID는 색상과 텍스트로 구분한다. ID는 영문 대소문자·숫자·밑줄·하이픈 1–24자다.

배치·삭제·ID/방향 변경, 키보드 셀 선택 및 적용/다운로드를 지원한다. 불완전한 포털이나 그룹은 초안으로 남지만 적용·내보내기는 막는다. 크기를 줄이면 범위 밖 요소를 자르되 남은 불완전 연결을 임의로 복구하지 않고 오류로 알린다. 진행 중 동적 벽을 고정 벽으로 저장하지 않도록 초안은 초기 `staticWalls`와 `features`에서 생성한다.

## 4. 환경 요소의 정확한 규칙

| 요소 | 전이 및 복원 |
|---|---|
| Portal | 고유 ID와 정확히 두 끝점. 진입 시 반대 끝점으로 한 번 이동하며 도착점에서 연쇄 발동하지 않는다. 최종 위치가 nextState이며 한 행동의 기본 이동 보상만 계산한다. |
| One-way | 현재 타일에서 지정 방향으로 떠나는 행동만 허용한다. 다른 방향은 제자리와 wallPenalty. 외부에서 진입하는 방향은 제한하지 않는다. 영구적인 지형이다. |
| Fragile | 진입 시 통과 가능하다. 실제로 다른 셀로 떠난 뒤 원래 타일이 붕괴한다. 벽·경계 충돌 때는 붕괴하지 않는다. 붕괴 타일 진입은 wallPenalty로 차단하며 에피소드 reset에서 복원한다. |
| Switch / Toggle Wall | 그룹마다 최소 하나의 스위치와 벽이 필요하다. 기본 닫힘. 스위치로 실제 진입할 때만 그룹이 반전된다. 제자리 충돌은 반전하지 않고, 나갔다 재진입하면 다시 반전한다. 여러 스위치·벽과 독립 그룹을 지원한다. reset에서 모두 닫힌다. |

특수 요소와 다른 특수 요소, Start, Goal, 고정 Wall, Bomb의 좌표 중복을 거절한다. 따라서 스위치에 선 에이전트의 셀에 토글 벽이 닫히지 않는다. 열린 벽·닫힌 벽, 멀쩡한 바닥·붕괴 바닥은 평면 색상/기호로 구분하며 과도한 파편 애니메이션은 없다.

새 요소 자체는 종료 조건이 아니다. 정상 완료는 모든 Goal 수집이고, 기존 Bomb 실패 종료 및 기존 엔진 종료 조건은 유지한다.

## 5. Markov 상태 및 상태 공간

정적 맵(Portal/One-way만 있는 맵 포함)은 기존 `x,y,goalMask` 형식을 유지한다. goalMask는 Goal 배열 순서의 비트이며 십진 문자열이다.

Fragile 또는 Toggle Wall이 있으면 `x,y,goalMask,fragileMask,toggleMask`다. 뒤의 두 마스크는 BigInt 16진 문자열이다. Fragile 비트는 초기 배열 순서, 그룹 비트는 고유 그룹 ID의 정렬 순서다. 같은 위치라도 수집 Goal·붕괴 바닥·열린 벽이 다르면 다른 Q-table 행이다. 마스크 순서는 환경 인스턴스 동안 고정이다.

Q-Learning/SARSA의 업데이트 규칙은 변경하지 않았다. 정책·가치·Q-value 패널은 위치 뒤의 전체 상태 suffix를 사용한다. 렌더 모델도 같은 에피소드의 수집/붕괴/그룹 상태를 투영한다. reset은 세 동적 집합을 모두 초기화한다.

상태 공간의 보수적인 이론 상한:

`width × height × 2^(Goal 수 + Fragile 수 + 고유 Toggle Wall 그룹 수)`

도달 불가능한 조합도 포함하므로 실제 방문 상태 수와는 다르다. Portal·고정 One-way에는 추가 상태 비트가 필요하지 않다. 동적 맵은 상한 **262,144**를 넘으면 적용·import·엔진 생성에서 거절하고 편집기에 계산값과 제한을 표시한다. 기존 정적 맵에는 이 제한을 새로 적용하지 않는다. UI 맵 편집 크기 범위 3–20은 유지한다.

정책·가치 렌더는 누적 Q-table 전체를 순회하지 않고 현재 상태 suffix에 해당하는 셀만 직접 조회한다(최대 width×height). `useSimulationEngine`의 최초 snapshot도 실제 최초 렌더에서만 생성하여 재렌더 때 불필요한 전체 복사를 줄였다.

## 6. 전이 우선순위

1. 현재 위치와 행동을 받고 One-way 출발 제한을 확인한다.
2. 경계, 일반 벽, 닫힌 그룹 벽, 붕괴 바닥을 확인한다.
3. 진입 가능한 Portal이면 반대 끝점으로 한 번만 이동한다.
4. 기존 Goal/Bomb/일반 이동 보상 분기로 최종 위치와 보상을 결정한다.
5. 실제 위치가 달라졌으면 출발 Fragile을 붕괴시키고 도착 Switch 그룹을 반전한다.
6. Goal·붕괴·그룹 상태를 모두 반영한 nextState를 만든 뒤 종료를 판단한다.

기존 Goal 코드를 재작성하지 않기 위해 권장 순서의 보상 분기를 앞에 유지했다. 요소 중복을 금지하므로 이 순서 차이는 보상이나 지형 결과를 바꾸지 않는다. 막힌 행동에는 Portal·붕괴·Switch가 발동하지 않는다. Portal의 양 끝점은 다른 요소와 겹치지 않아 도착점의 추가 효과도 없다.

## 7. JSON 스키마 및 호환성

새 export는 `version:2`, `type:"gridworld"`이며 기존 좌표·보상 필드를 보존한다. 추가 필드는 다음과 같고 비어 있으면 생략한다.

```json
{
  "portals": [{"id":"P1","ends":[{"x":1,"y":1},{"x":4,"y":4}]}],
  "oneWays": [{"x":2,"y":1,"direction":1}],
  "fragiles": [{"x":3,"y":1}],
  "switches": [{"x":2,"y":2,"groupId":"G1"}],
  "toggleWalls": [{"x":3,"y":2,"groupId":"G1"}]
}
```

위 예시는 추가 필드의 모양만 나타낸다. direction은 기존 엔진 행동 순서인 `0=위, 1=아래, 2=왼쪽, 3=오른쪽`이다. 기존 version 1 맵은 새 요소가 없으면 불러오며, 새 요소가 든 version 1은 version 2가 필요하다고 알린다. 누락된 선택 필드는 기존 기본값을 적용한다. 잘못된 좌표·방향·ID·중복·쌍·연결·상태 공간을 검증한 뒤 전체 초안을 교체한다. 잘못된 import는 기존 환경/초안을 부분 변경하지 않는다.

JSON은 초기 맵만 저장한다. 수집 Goal, 붕괴 진행, 열린 그룹, Q-table, 학습 이력은 저장하지 않는다. 진행 중 환경에서 편집기를 열어도 초기 요소 구성을 복원하며, export/import 의미 동등성을 테스트했다. Reward Tile 호환성 규칙은 2절과 같다.

## 8. 신규 프리셋 및 해결 검증

기존 `basic`, `corridor`, `maze`, `bombField`, `multiGoal`, `treasureHunt`, `obstacleCourse`, `complexMaze`, `deadEndMaze`, `multipleRoute`, `riskyPath`의 11개 ID와 구성을 유지했다.

| 신규 프리셋 | 크기 | 핵심 설계 | 이론 상한 | BFS 완료 행동 수 |
|---|---|---|---:|---:|
| Portal Maze | 7×7 | 전체 높이의 장벽을 포털로 넘는다 | 98 | 4 |
| One-way Labyrinth | 7×5 | 복도의 오른쪽 방향 제약을 따른다 | 70 | 6 |
| Fragile Bridge | 7×5 | 떠난 뒤 돌아갈 수 없는 다리, 실패 탐험의 Bomb 탈출 지점 | 2,240 | 6 |
| Switch Puzzle | 7×5 | 스위치로 장벽을 열어 통과하고 다음 스위치로 상태를 바꾼다 | 140 | 6 |
| Mixed Challenge | 9×7 | 포털·스위치·Fragile·One-way·그룹 벽을 순서대로 거친다 | 504 | 7 |

갤러리에 한국어/영어 이름·특징·난이도·주요 요소·크기와 실제 GridSvg 미리보기를 제공한다. 미리보기 선택만으로 실험을 바꾸지 않으며 적용은 명시적이다.

`src/test/solveGrid.ts`는 실제 GridWorldEnv를 생성하고 행동 경로를 재생하는 BFS다. 위치뿐 아니라 전체 상태 키를 방문 집합으로 사용하고, Bomb 종료는 성공으로 취급하지 않으며 모든 Goal 완료를 확인한다. 신규 5종 모두 통과했다. 이는 해결 경로 존재 검증이며 학습 알고리즘의 수렴 보장은 아니다.

## 9. 테스트·빌드·브라우저 결과

| 명령 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm test` | 54개 파일, 1,020개 테스트 통과, 17.68초 |
| `npm run build` | TypeScript 및 Vite production build 통과 |
| `npm run test:e2e` | Edge desktop/mobile 18개 통과, skip 없음, 43.3초 |
| `git diff --check` | 통과 |

작업 시작 시 934개에서 현재 1,020개로 증가했다. 삭제한 테스트는 `rewardTiles.test.ts`의 아래 6개뿐이다. 사라진 기능의 동작을 강제하므로 제거하고, `retiredRewardCompatibility.test.ts`의 명시적 거절/빈 필드 호환성 6개로 대체했다.

1. Reward Tile 진입·재진입 보상 및 충돌.
2. 음수 타일 보상.
3. Reward Tile의 Q-Learning 업데이트.
4. Reward Tile의 SARSA 업데이트.
5. Reward Tile 편집 초안/JSON 왕복.
6. Reward Tile 배치 검증.

그 외 기존 테스트는 제거하지 않았다. 기본 도구가 아이콘이 되면서 Bomb 관련 UI assertion은 접근성 label로 갱신했다. 기존 프리셋 검사도 신규 맵은 동적 BFS를 사용하도록 확장했다.

추가 검증은 양방향 Portal/한 번 발동, 방향 제약과 페널티/Q 업데이트, Fragile 충돌·붕괴·복원, 그룹 재진입·독립성·닫힘/열림, 다중 Goal/알고리즘, 상태별 Q 분리/정책·가치 조회, 잘못된 import 및 연결, 편집 초안 보존을 포함한다.

실제 로컬 Microsoft Edge와 모바일 터치/화면 에뮬레이션으로 **1366×768, 1440×900, 1920×1080, 768×1024, 390×844**를 검사했다. 각 크기에서 3×3, 20×20, 3×20, 20×3 맵의 전체 맞춤·중앙 정렬·정사각 셀·툴바 비중첩·본문 overflow 없음, 사이드바/분석 패널 전환, 확대/내부 패닝을 확인했다. 동적 상태를 만든 뒤 일시정지·언어·화면 전환 보존과 중단 시 에피소드 복원도 확인했다.

GitHub Pages base `/RL-Playground/`를 그대로 사용한 preview에서 E2E를 실행했다. 배포 workflow는 기존 main push/manual trigger 구성 그대로이며 Production 배포를 실행하지 않았다.

### 실제 고속 실행·메모리 표본

20×20, Goal 1개, Fragile 5개, 그룹 3개, 네 종류 요소를 함께 둔 맵에서 이론 상한은 204,800이다. ε=0.3, batch 100/frame의 고속 모드로 **3초** 실행한 뒤 Pause, Stop, 10회 편집/학습 화면 왕복을 측정했다. 측정 전 및 Stop/왕복 후에는 CDP로 GC를 요청했다. Pause 시 값은 GC 전이다.

| 바이트 | Desktop | Mobile 에뮬레이션 |
|---|---:|---:|
| 실행 전 GC 후 | 5,622,856 | 5,682,816 |
| 3초 실행 후 Pause, GC 전 | 26,649,808 | 33,754,928 |
| Stop 후 GC | 6,936,800 | 6,971,040 |
| 화면 10회 왕복 후 GC | 6,589,756 | 6,673,220 |
| 표본 중 완료 에피소드 | 0 | 0 |

Pause/Stop은 응답했고 예외는 없었다. Stop은 학습 Q-value를 보존하므로 초기 값과 동일한 메모리로 돌아오지는 않는다. 이 표본에서는 화면 왕복 후 GC 값이 증가하지 않았다. 실행 중 할당 증가와 GC 후 보존량을 구분해야 하며, 3초 표본만으로 장시간 누수 없음·프레임률 보장·학습 수렴을 주장하지 않는다. 원시 표본은 E2E의 `DYNAMIC_MEMORY_SAMPLE` 출력과 test-results attachment로 생성된다.

## 10. 브라우저 스크린샷

아래 파일은 위 테스트 실행 중 실제 브라우저에서 생성했다. 기존 전체 화면 보고서의 캡처도 최신 화면으로 교체했다.

- [새 요소 편집: 데스크톱](screenshots/environment-editor-desktop.png), [모바일](screenshots/environment-editor-mobile.png)
- [실제 붕괴·포털·스위치 상태: 데스크톱](screenshots/environment-dynamic-desktop.png), [모바일](screenshots/environment-dynamic-mobile.png)
- [16개 프리셋 갤러리](screenshots/environment-gallery.png)
- [직각 선택 테두리·하단 언어 선택](screenshots/environment-selection.png)
- 화면 크기별 격자: [1366×768](screenshots/environment-1366x768.png), [1440×900](screenshots/environment-1440x900.png), [1920×1080](screenshots/environment-1920x1080.png), [768×1024](screenshots/environment-768x1024.png), [390×844](screenshots/environment-390x844.png)

## 11. 알려진 한계

- 임의 편집 맵의 해결 가능성은 적용 조건으로 강제하지 않는다. 프리셋은 BFS 검증했지만, 사용자는 Fragile을 잘못 지나 Goal로 갈 수 없게 만들 수 있다. 중단/에피소드 초기화 또는 맵 수정이 필요할 수 있다.
- 동적 맵의 상태 공간 상한은 안전 예산이며 실제 메모리 한도를 보증하지 않는다. Q-table·에피소드 이력·현재 trajectory는 장시간 학습에서 누적될 수 있다. 장시간 heap/프레임 프로파일링은 수행하지 않았다.
- 모바일은 Edge 기반 에뮬레이션 검증이다. 물리 iOS/Safari/Android 기기 검증은 하지 않았다.
- 상태 보존은 현재 세션의 화면·패널·언어 전환 범위다. 새로고침 후 실험 복원이나 Q-table export는 이번 범위가 아니다.
- 작은 모바일 화면의 20×20 셀은 작다. 정밀 편집에는 확대 및 내부 패닝을 사용한다.
- 기존 전체 화면 구조를 유지했으며 요청 외 지형(예: 미끄러움)은 추가하지 않았다.

## 12. Git 결과

작업 전 fetch로 원격 `feat/home-redesign`의 최신 상태를 확인했고 기존 브랜치에서 이어서 작업했다.

- `eca021b` — Reward Tile 제거, 호환성 오류, 셀 선택과 고정 언어 UI 정리.
- `aaf29c9` — 동적 환경 전이·상태·편집·JSON·렌더, 프리셋 5종 및 통합/E2E 테스트.
- 이 보고서와 실제 스크린샷은 별도의 문서 커밋으로 기록한다.

푸시 대상은 `origin/feat/home-redesign`이다. 코드 커밋 원격 반영을 확인했으며 문서 커밋까지 같은 브랜치에 푸시한다. 최종 HEAD/원격 일치 결과는 작업 최종 응답에 기록한다. main은 시작 시의 `987db7b0d9cf7f3ada6c735133ac30c0149dee1c`를 보존하며 병합·Production 배포·수동 배포 workflow 호출은 하지 않는다.
