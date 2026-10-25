# 홈 화면 및 UI/UX 개편

## 구조와 보존 범위

빈 디렉터리에 원본 저장소를 클론한 뒤 `feat/home-redesign`에서 작업했다. 원본
`App.tsx`의 시뮬레이터를 `Simulator.tsx`로 옮기고, `App.tsx`를 내비게이션 셸로
구성했다. 기존 `core` 엔진·알고리즘·환경 코드는 변경하지 않았다.

- 홈: 소개, 학습 진입, Agent/Environment/Reward 개념, 알고리즘 비교.
- 사이드바: 홈, 학습 환경, 맵 편집, 결과, 알고리즘 가이드. 데스크톱 접기와 모바일 드로어.
- 시연: 탐색 경로 19회와 활용 경로 9회를 비교한다. 수동 이동·재생·정지·초기화 지원.
  **사전에 정한 설명용 경로이며 실제 학습 결과가 아니다.** 별도 문구로 명시하고
  실제 엔진에 연결하지 않았다. 홈을 떠나면 시연 타이머를 정리한다.
- 실험: 기존 시뮬레이터를 계속 마운트하고 비활성 화면을 `hidden`으로 처리한다.
  엔진, Q-table, 학습 실행 상태, 하이퍼파라미터, 선택한 셀·에피소드, 오버레이,
  열려 있는 편집기의 초안을 화면 전환 중 보존한다.
- 편집/결과 메뉴는 동일 실험의 해당 패널을 열거나 스크롤한다. 별도의 실험을 생성하지 않는다.
- 기존 Reset, 알고리즘 변경, 환경 Apply의 명시적인 초기화 동작은 유지한다.
- 한국어/영어, `html lang`, 본문 건너뛰기, 메뉴 선택 상태, 포커스 표시,
  모바일 Escape 닫기·포커스 복원, 비활성 배경 `inert`, 모션 감소 설정을 지원한다.
- 기존 GridSvg의 셀 선택과 편집은 Enter/Space로도 실행할 수 있다.

GridWorld, Q-Learning/SARSA, 학습률·탐험률·할인율, 실행/정지/재개, 정책 및 Q-value,
에피소드 이력/경로/단계 분석, 보상·진행·종료 사유 그래프와 환경 import/export는
기존 컴포넌트와 핸들러를 그대로 사용한다. 기존 933개 회귀 테스트는 Simulator를
대상으로 유지하고, 셸에 대한 신규 테스트 6개를 추가했다.

## 변경 파일

| 파일 | 역할 |
| --- | --- |
| `src/ui/App.tsx` | 사이드바, 언어, 화면 이동, 모바일 포커스 |
| `src/ui/Home.tsx` | 홈 콘텐츠, 알고리즘 설명, 분리된 경로 시연 |
| `src/ui/Simulator.tsx` | 기존 시뮬레이터 보존 및 패널 진입 |
| `src/index.css` | 공통 디자인, 반응형, 접근성, 모션 감소 |
| `src/viz/grid/GridSvg.tsx` | 그리드 셀 키보드 조작 |
| `src/ui/App.test.tsx` | 기존 회귀 테스트를 Simulator에 연결 |
| `src/ui/Home.test.tsx` | 내비게이션, 상태 보존, 시연 제어 검증 |
| `e2e/home.spec.ts`, `playwright.config.ts` | 실제 브라우저 검증 |
| `package.json`, `package-lock.json` | Playwright와 검증 스크립트, 호환 범위의 개발 의존성 수정 |
| `vite.config.ts` | Vitest에서 별도 Playwright 테스트 제외 |
| `index.html` | 기본 한국어와 설명 메타데이터 |
| `.gitignore` | 브라우저 테스트 산출물 제외 |

## 검증 결과

2026-10-25, Windows / Node 24 / 설치된 Microsoft Edge headless에서 확인했다.

| 명령 | 결과 |
| --- | --- |
| `npm run lint` | 통과 |
| `npm test` | 43개 파일, 939개 테스트 통과 |
| `npm run build` | TypeScript 및 Vite Production 빌드 통과 |
| `npm run test:e2e` | 4개 통과: 데스크톱 1440×1000 및 모바일 390×664 에뮬레이션 |
| `git diff --check` | 통과 |

브라우저에서 실제 Production 산출물을 `/RL-Playground/`로 제공했다. 홈 진입,
시연 이동, 학습 진입, 셀 키보드 선택, Step, 홈 왕복 후 데이터 보존, 결과·편집기
진입, 언어 전환, 가로 넘침, 메뉴 접기, 모바일 키보드 드로어, Escape 복원,
모션 감소와 런타임 오류 부재를 확인했다. 데스크톱·모바일 홈과 편집기 스크린샷을
`test-results/`에 생성하고 육안으로 확인했다.

재현:

```sh
npm ci
npm run lint
npm test
npm run build
# 설치된 Microsoft Edge가 필요하다. 없으면 npx playwright install msedge
npm run test:e2e
```

기존 GitHub Pages 워크플로의 main push 및 수동 실행 조건, `dist` 업로드,
Vite base `/RL-Playground/`를 유지했다. 서버 라우팅을 추가하지 않아 Pages의
직접 경로 404 처리가 필요하지 않다. main 병합·워크플로 수동 실행·Production
배포는 수행하지 않는다.

## 제한 사항

- 대화에서 스케치 이미지가 제공되지 않아 텍스트로 주어진 3열 의도를 기준으로 구현했다.
- 상태 보존은 현재 브라우저 세션의 화면 전환 범위다. 새로고침/탭 종료 후 복원은 없다.
- 시연은 설명용이며 학습 성능을 측정하는 지표가 아니다.
- 모바일 검증은 Edge의 터치·화면 에뮬레이션이다. 실제 iOS/Safari/Android 기기는 검증하지 않았다.
- 실험 이력은 기존처럼 제한 없이 메모리에 저장되어 매우 긴 실험은 메모리 사용량이 늘 수 있다.
- 온라인 `npm audit`에서 기존 개발 도구의 취약점을 확인하여 호환 범위에서 수정했다.
  Vitest/@vitest/mocker 관련 moderate 2건은 남아 있다. 브라우저 배포 번들에는 포함되지 않는다.
  최초 오프라인 npm ci의 감사 결과와 온라인 감사 결과는 달랐다.
