# RL Playground

브라우저에서 강화학습 알고리즘의 내부 동작(State / Action / Reward / TD Target / TD Error /
Value·Q-value / Policy)을 직접 관찰하고 조작할 수 있는 인터랙티브 Playground.

시뮬레이션(GridWorld, Q-Learning/SARSA, 상태 머신 등)은 순수 TypeScript로 구현되어
React·DOM에 의존하지 않으며, 서버나 외부 API 없이 정적 파일만으로 브라우저에서 완결됩니다.

## 주요 기능

- **Environment**: GridWorld (Wall / Start / Goal / Grid 크기 편집 가능)
- **Algorithm**: Q-Learning, SARSA (ε-greedy 행동 선택, on/off-policy TD control)
- **학습 제어**: Step / Run / Run Episode / Pause / Resume / Reset, 4단계 Speed(Slow/Normal/Fast/Very Fast)
- **관찰**:
  - Inspector — State/Action/Reward/TD Target(수식 포함)/TD Error, Q-value 갱신 전→후 값
  - Q-value 막대그래프 (State 선택 시)
  - Policy Overlay — 각 State의 greedy action을 화살표로 표시
  - Value Heatmap — 각 State의 V(s)=max Q(s,·)를 색상으로 표시
  - Statistics — Episode / Total Reward / Episode Length / Success Rate
  - Reward Chart — Episode별 보상 추이 SVG 라인 차트
- **Environment Editor**: Grid 크기 변경, Wall 추가/삭제, Start/Goal 지정 — Draft 편집 후
  Apply해야 실제 시뮬레이션에 반영(적용 시 학습 상태 전체 초기화, 취소 시 미반영)

## v1 범위

**포함(구현 완료)**: 위 "주요 기능" 전체.

**Post-MVP(v1에는 없음, 의도적으로 제외)**:

- 셀별 커스텀 Reward / 임의 Terminal 지정 편집
- Environment 설정 JSON export/import
- Algorithm 선택 UI(현재는 코드에서만 전환 가능), Episode 수 지정 UI
- Q-value 변화 이력 스파크라인

**Future(설계만 되어 있고 구현 안 됨)**: TD(0), Softmax/UCB 정책, 새로운 Environment 등.

자세한 범위 구분은 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §11과
[`docs/ROADMAP.md`](docs/ROADMAP.md)를 참고하세요.

## 실행 방법

```bash
npm install
npm run dev      # 개발 서버 (http://localhost:5173)
npm run test     # Vitest — 26 test files / 223 tests
npm run lint     # ESLint
npm run build    # 프로덕션 빌드 (dist/)
npm run preview  # 빌드 결과를 로컬에서 정적으로 서빙
```

## 기술 스택

React 19 + TypeScript, Vite, Tailwind CSS 4, Vitest + Testing Library. 차트/그리드
시각화는 별도 라이브러리 없이 순수 SVG로 구현. 상태관리는 커스텀 `SimulationEngine`
클래스 + `useSyncExternalStore` 훅(별도 상태관리 라이브러리 없음).

## 아키텍처

```
Environment → Agent → Algorithm → Simulation Engine → Visualization → UI
```

```
src/
  core/   RL 로직 (Environment/Agent/Algorithm/SimulationEngine, React·DOM 비의존)
  viz/    시각화 컴포넌트 (Grid, Overlay, 차트, 컨트롤)
  ui/     App 조립, Engine ↔ React 연결 훅
```

`src/core/**`는 React/DOM에 의존하지 않는다 — `eslint.config.js`가 이를 린트 규칙으로
강제하며, Node 환경(Vitest)에서 UI 없이 단독으로 테스트됩니다. UI는 `useSyncExternalStore`
기반 훅으로 `SimulationEngine`의 `EngineSnapshot`을 구독하는 것이 유일한 연결 지점입니다.

자세한 설계 문서는 [`docs/`](docs) 참고:

- [PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) — 기능/사용자 시나리오
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — 모듈 구조와 데이터 흐름
- [ROADMAP.md](docs/ROADMAP.md) — 단계별 개발 순서
- [LEGACY_ANALYSIS.md](docs/LEGACY_ANALYSIS.md) — 참고용 레퍼런스 저장소 분석
- [DESIGN_REVIEW.md](docs/DESIGN_REVIEW.md) — 설계 검증 기록

## 테스트

`npm run test` 기준 **26 test files / 223 tests** 전부 통과(Core 순수 함수/클래스 단위
테스트부터 실제 Engine을 사용하는 브라우저 통합 테스트까지 포함).

## 배포

빌드 산출물(`npm run build` → `dist/`)은 정적 파일뿐이며 백엔드·데이터베이스·환경 변수가
필요 없습니다. 어떤 정적 웹 호스팅에도 `dist/` 내용을 그대로 올리면 동작합니다(하위
경로에 배포하는 경우에만 `vite.config.ts`에 `base` 옵션 설정 필요).
