import { useEffect, useState } from 'react'
import type { SpeedSetting } from '../core/engine/Scheduler'
import type { StateKey } from '../core/types/rl'
import { GridSvg } from '../viz/grid/GridSvg'
import { PolicyOverlay } from '../viz/grid/PolicyOverlay'
import { ValueHeatmap } from '../viz/grid/ValueHeatmap'
import { TrajectoryOverlay } from '../viz/grid/TrajectoryOverlay'
import { SpeedControl } from '../viz/controls/SpeedControl'
import { AlgorithmSelector } from '../viz/controls/AlgorithmSelector'
import { EpsilonControl } from '../viz/controls/EpsilonControl'
import { AlphaControl } from '../viz/controls/AlphaControl'
import { GammaControl } from '../viz/controls/GammaControl'
import { LanguageSelector } from '../viz/controls/LanguageSelector'
import { InspectorPanel } from '../viz/panels/InspectorPanel'
import { QValueBars } from '../viz/panels/QValueBars'
import { StatsPanel } from '../viz/panels/StatsPanel'
import { TerminationChart } from '../viz/panels/TerminationChart'
import { RewardChart } from '../viz/panels/RewardChart'
import { LearningProgress } from '../viz/panels/LearningProgress'
import { EpisodeTrajectory } from '../viz/panels/EpisodeTrajectory'
import { EpisodeStepViewer } from '../viz/panels/EpisodeStepViewer'
import { EnvEditor } from '../viz/controls/EnvEditor'
import { engine } from './engine'
import { useSimulationEngine } from './hooks/useSimulationEngine'
import { translations, type Locale } from './i18n'


import { GridViewport } from './GridViewport'
import { TooltipButton } from './TooltipButton'
import { toolbarTips } from './toolbarTips'
import type { GridEditorDraft } from '../viz/controls/envEditorDraft'
import { FloatingToolbar } from './FloatingToolbar'
import { MapGallery } from '../viz/controls/MapGallery'
import { ENVIRONMENT_PRESETS } from '../viz/controls/environmentPresets'
import { draftToGridWorldConfig } from '../viz/controls/envEditorDraft'

interface SimulatorProps {
  locale?: Locale
  section?: 'environment' | 'editor' | 'results'
  active?: boolean
  presetsOpen?: boolean
  onClosePresets?: () => void
}

export default function Simulator({ locale: sharedLocale, section = 'environment', active = true, presetsOpen = false, onClosePresets = () => {} }: SimulatorProps) {
  const snapshot = useSimulationEngine(engine)
  const [localLocale, setLocale] = useState<Locale>('ko')
  const locale = sharedLocale ?? localLocale
  const ko = locale === 'ko'
  const t = translations[locale]
  const [selectedState, setSelectedState] = useState<StateKey | null>(null)
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null)
  const [viewedStep, setViewedStep] = useState<number | null>(null)
  const [showPolicy, setShowPolicy] = useState(true)
  const [showValue, setShowValue] = useState(true)
  const [showPath, setShowPath] = useState(true)
  const [speed, setSpeed] = useState<SpeedSetting>(() => engine.getSpeed())
  const [episodeCount, setEpisodeCount] = useState(250)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'learning' | 'visuals'>('learning')
  const [presetRequest, setPresetRequest] = useState<{ draft: GridEditorDraft } | null>(null)
  const tips = toolbarTips[locale]
  useEffect(() => { if (presetsOpen) setAnalysisOpen(false) }, [presetsOpen])
  useEffect(() => { setViewedStep(null) }, [selectedEpisode])
  useEffect(() => {
    if (!active) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const target = event.target instanceof Element ? event.target : null
        if (target?.closest('#learning-settings')) document.querySelector<HTMLButtonElement>('[aria-controls=learning-settings]')?.focus()
        if (target?.closest('#analysis-panel')) document.querySelector<HTMLButtonElement>('[data-testid=toggle-analysis]')?.focus()
        onClosePresets(); setSettingsOpen(false); setAnalysisOpen(false)
      }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [active, onClosePresets])
  const selectedEpisodeStats = snapshot.stats.episodeStatsHistory.find(row => row.episode === selectedEpisode) ?? null
  const effectiveStep = viewedStep ?? selectedEpisodeStats?.trajectory.length ?? 0
  const model = snapshot.envRenderModel
  const handleStateSelect = (state: StateKey) => { if (!model.walls.includes(state)) setSelectedState(state) }
  const clearSelections = () => { setSelectedState(null); setSelectedEpisode(null); setViewedStep(null) }
  const idle = snapshot.status === 'idle'
  const labels = Object.fromEntries(ENVIRONMENT_PRESETS.map(preset => [preset.id, (t.envEditor as unknown as Record<string, string>)[`preset${preset.id[0].toUpperCase()}${preset.id.slice(1)}`] ?? preset.id]))
  const analysisVisible = !presetsOpen && (section === 'results' || (section === 'environment' && analysisOpen))
  return <section className={`simulator fullscreen-simulator ${section === 'results' ? 'results-view' : ''}`} aria-label={ko ? '강화학습 실험실' : 'Reinforcement learning lab'}>
    <div className="environment-screen" hidden={section !== 'environment'} data-testid="learning-grid">
      <div className="workspace-stage">
        <FloatingToolbar active={active && section === 'environment'} label={ko ? '학습 컨트롤' : 'Learning controls'}>
          <SpeedControl speed={speed} t={t} onChange={next => { engine.setSpeed(next); setSpeed(next) }} />
          <TooltipButton tip={tips.learn} className="toolbar-primary" disabled={!idle} onClick={() => engine.run({ episodes: episodeCount })} data-testid="playback-run-episode">{t.playback.learn}</TooltipButton>
          <TooltipButton tip={snapshot.status === 'paused' ? tips.resume : tips.pause} disabled={idle} onClick={() => snapshot.status === 'paused' ? engine.resume() : engine.pause()} data-testid={snapshot.status === 'paused' ? 'playback-resume' : 'playback-pause'}>{snapshot.status === 'paused' ? t.playback.resume : t.playback.pause}</TooltipButton>
          <TooltipButton tip={tips.stop} disabled={idle} onClick={() => engine.restartEpisode()} data-testid="playback-stop">{ko ? '학습 중단' : 'Stop'}</TooltipButton>
          <TooltipButton tip={tips.greedy} disabled={!idle} onClick={() => engine.run({ episodes: 1, greedy: true })} data-testid="playback-run-greedy">{ko ? '학습 결과 실행' : 'Run policy'}</TooltipButton>
          <TooltipButton tip={tips.settings} aria-expanded={settingsOpen} aria-controls="learning-settings" onClick={() => { setSettingsOpen(!settingsOpen) }}>{ko ? '설정' : 'Settings'}</TooltipButton>
          <TooltipButton tip={tips.analysis} aria-expanded={analysisOpen} aria-controls="analysis-panel" onClick={() => { onClosePresets(); setAnalysisOpen(!analysisOpen) }} data-testid="toggle-analysis">{ko ? '분석' : 'Analysis'}</TooltipButton>
          {sharedLocale === undefined && <LanguageSelector locale={locale} onChange={setLocale} t={t} />}
        </FloatingToolbar>
        <section id="learning-settings" className="toolbar-popover" hidden={!settingsOpen} aria-label={ko ? '학습 설정' : 'Learning settings'}>
          <div role="tablist" aria-label={ko ? '설정' : 'Settings'}>{(['learning', 'visuals'] as const).map(tab => <button key={tab} role="tab" id={`settings-${tab}-tab`} aria-selected={settingsTab === tab} aria-controls={`settings-${tab}`} onClick={() => setSettingsTab(tab)}>{tab === 'learning' ? (ko ? '학습 설정' : 'Learning settings') : (ko ? '시각화 설정' : 'Visualization settings')}</button>)}</div>
          <div role="tabpanel" id="settings-learning" aria-labelledby="settings-learning-tab" hidden={settingsTab !== 'learning'}>
          <label>{t.playback.episodeCount}<input type="number" min={1} value={episodeCount} disabled={!idle} data-testid="episode-count-input" onChange={event => { const count = Number(event.target.value); if (Number.isSafeInteger(count) && count > 0) setEpisodeCount(count) }} /></label>
          <AlgorithmSelector algorithmId={snapshot.algorithmId} disabled={!idle} t={t} onChange={algorithmId => { engine.reset({ algorithmId }); clearSelections() }} />
          <EpsilonControl epsilon={snapshot.hyperparams.epsilon} onChange={epsilon => engine.setHyperparams({ epsilon })} t={t} locale={locale} />
          <AlphaControl alpha={snapshot.hyperparams.alpha} onChange={alpha => engine.setHyperparams({ alpha })} t={t} locale={locale} />
          <GammaControl gamma={snapshot.hyperparams.gamma} onChange={gamma => engine.setHyperparams({ gamma })} t={t} locale={locale} />
          <p>{ko ? '학습 중단은 현재 에피소드만 취소하고 시작점으로 돌아갑니다. Q-table과 완료된 학습 이력은 유지합니다.' : 'Stop aborts the current episode and returns to start, preserving the Q-table and completed history.'}</p>
          </div>
        <div role="tabpanel" id="settings-visuals" aria-labelledby="settings-visuals-tab" hidden={settingsTab !== 'visuals'} aria-label={ko ? '시각화 설정' : 'Visualization settings'}>
          <label><input type="checkbox" checked={showPolicy} onChange={e => setShowPolicy(e.target.checked)} data-testid="toggle-policy" />{t.overlay.policy}</label>
          <label><input type="checkbox" checked={showValue} onChange={e => setShowValue(e.target.checked)} data-testid="toggle-value" />{t.overlay.value}</label>
          <button onClick={() => setShowPath(!showPath)} aria-pressed={showPath} data-testid="toggle-episode-path">{showPath ? t.episodePath.hide : t.episodePath.show}</button>
          <p>{ko ? '⋯ = Q값 동률, 아직 선호 행동 없음. 실제 탐욕 실행은 동률 중 가장 낮은 행동 인덱스를 선택합니다. 화살표 = 유일한 최댓값.' : '⋯ = tied Q-values, no unique preference. Greedy execution resolves ties by lowest action index. Arrows indicate a unique maximum.'}</p>
        </div></section>
        <GridViewport width={model.width} height={model.height} active={active && section === 'environment'}>
          <GridSvg renderModel={model} cellSize={48} selectedState={selectedState} onStateSelect={handleStateSelect} className="stage-grid" showAgent={false} />
          {showValue && <ValueHeatmap renderModel={model} agentSnapshot={snapshot.agentSnapshot} currentState={snapshot.currentState} cellSize={48} className="stage-overlay" />}
          {showPolicy && <PolicyOverlay renderModel={model} agentSnapshot={snapshot.agentSnapshot} currentState={snapshot.currentState} cellSize={48} className="stage-overlay" />}
          {showPath && <TrajectoryOverlay renderModel={model} episodeStatsHistory={snapshot.stats.episodeStatsHistory} selectedEpisode={selectedEpisode} cellSize={48} className="stage-overlay" ariaLabel={`${t.episodeTrajectory.ariaLabelPrefix} ${selectedEpisode ?? ''}`} stepIndex={effectiveStep} />}
          <svg className="stage-overlay" viewBox={`0 0 ${model.width * 48} ${model.height * 48}`} aria-hidden="true"><circle cx={(Number(model.agentPos.split(',')[0]) + 0.5) * 48} cy={(Number(model.agentPos.split(',')[1]) + 0.5) * 48} r={16} fill="#dc554a" stroke="white" strokeWidth={1} data-testid="agent-marker" /></svg>
        </GridViewport>
      </div>
    </div>
    <div hidden={section !== 'editor'} className="editor-screen" id="environment-editor"><EnvEditor fullscreen active={active && section === 'editor'} presetRequest={presetRequest} panelBlocked={presetsOpen} onOpenProperties={onClosePresets} currentRenderModel={model} locale={locale} t={t} onApply={config => { engine.reset({ envConfig: config }); clearSelections() }} /></div>
    <aside id="analysis-panel" className="analysis-drawer" hidden={!analysisVisible} data-testid="analysis-panel" aria-label={ko ? '통계 및 분석' : 'Statistics & analysis'}>
      <header><h2>{ko ? '통계 및 분석' : 'Statistics & analysis'}</h2>{section !== 'results' && <button onClick={() => { setAnalysisOpen(false); document.querySelector<HTMLButtonElement>('[data-testid=toggle-analysis]')?.focus() }} aria-label={ko ? '분석 닫기' : 'Close analysis'}>×</button>}</header>
      <div className="analysis-content">
        <EpisodeStepViewer episode={selectedEpisodeStats} step={effectiveStep} onStepChange={setViewedStep} allGoals={model.allGoals ?? []} t={t} />
          <InspectorPanel
            lastTransition={snapshot.lastTransition}
            lastActionSelection={snapshot.lastActionSelection}
            lastTdInfo={snapshot.lastTdInfo}
            t={t}
            locale={locale}
          />
          <QValueBars
            selectedState={selectedState}
            currentState={snapshot.currentState}
            agentSnapshot={snapshot.agentSnapshot}
            t={t}
            locale={locale}
          />
          <StatsPanel
            episode={snapshot.episode}
            stats={snapshot.stats}
            t={t}
            selectedEpisode={selectedEpisode}
            onSelectEpisode={setSelectedEpisode}
            // Phase 44: `allGoals` (the static, full Goal list), not `goals` (the
            // live, collection-shrinking list) — StatsPanel's "N / M Goals Collected"
            // needs the true fixed total for its denominator, not the count of
            // Goals still remaining right now. See render.ts's doc comment.
            goals={snapshot.envRenderModel.kind === 'grid' ? (snapshot.envRenderModel.allGoals ?? []) : []}
          />
          <TerminationChart episodeStatsHistory={snapshot.stats.episodeStatsHistory} t={t} />
          <RewardChart
            rewardHistory={snapshot.stats.rewardHistory}
            episodeNumbers={snapshot.stats.episodeStatsHistory.map((row) => row.episode)}
            selectedEpisode={selectedEpisode}
            t={t}
          />
          <LearningProgress
            episodeStatsHistory={snapshot.stats.episodeStatsHistory}
            selectedEpisode={selectedEpisode}
            t={t}
          />
          <EpisodeTrajectory
            key={selectedEpisode ?? 'none'}
            episodeStatsHistory={snapshot.stats.episodeStatsHistory}
            selectedEpisode={selectedEpisode}
            t={t}
            locale={locale}
          />
      </div>
    </aside>
    {active && presetsOpen && <MapGallery locale={locale} labels={labels} actionLabel={section === 'editor' ? (ko ? '편집기로 불러오기' : 'Load into editor') : (ko ? '맵 적용' : 'Apply map')} onClose={onClosePresets} onSelect={draft => {
      if (section === 'editor') { setPresetRequest({ draft }); return }
      if (window.confirm(t.envEditor.applyConfirm)) { engine.reset({ envConfig: draftToGridWorldConfig(draft) }); clearSelections() }
    }} />}
  </section>
}
