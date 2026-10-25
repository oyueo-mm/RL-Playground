import catalogJSON from './catalog.json?raw'
import { parseEnvImport } from '../../viz/controls/envEditorIO'
import type { GridEditorDraft } from '../../viz/controls/envEditorDraft'

export interface OfficialSolution { map: string; steps: number; actions: number[]; goalOrder: number[][]; events: Record<string, number> }
interface SourceEntry { no: number; ko: string; en: string; tier: string; description: string; file: string; solutionFile: string; width: number; height: number; goals: number }
const maps = import.meta.glob<string>('./maps/*.json', { query: '?raw', import: 'default', eager: true })
const solutions = import.meta.glob<string>('./solutions/*.json', { query: '?raw', import: 'default', eager: true })
const descriptions = [
  'Collect two goals across an open meadow while avoiding scattered obstacles.',
  'Compare the route around a fence with a portal shortcut.',
  'Activate a switch to open a door and retrieve goals on the other side.',
  'Plan your return route across bridges that collapse after departure.',
  'Read departure directions while exploring the arrow-lined alleys.',
  'Choose an order for goals in four districts around a central square.',
  'Compare a short hazardous route with a longer safe detour.',
  'Use two portal lines to collect goals around the central plaza.',
  'Open two doors in stages while moving between laboratory wings.',
  'Choose a collection order that preserves access to the ruins.',
  'Explore six regions and retrieve goals using portals and secured passages.',
  'Choose between four portal lines and connecting roads across the city.',
  'Control three security groups while collecting six goals.',
  'Plan crossings of three disposable bridges through the canyon.',
  'Connect goals and portals while respecting one-way departures.',
  'Collect ten scattered goals using portal shortcuts around hazardous areas.',
  'Control the doors of four isolated sections to retrieve eight goals.',
  'Plan island crossings using collapsing bridges and portals.',
  'Navigate five portal pairs linking four regions.',
  'Combine eight goals, three portal pairs, security doors and collapsing bridges.',
]
const tiers = ['쉬움', '보통', '어려움', '매우 어려움']
const englishTiers = ['Easy', 'Medium', 'Hard', 'Very Hard']
export interface EnvironmentPreset {
  id: string
  draft: GridEditorDraft
  solution: number[]
  solutionData: OfficialSolution
  sourceFile: string
  solutionFile: string
  metadata: { name: { ko: string; en: string }; description: { ko: string; en: string }; difficulty: { ko: string; en: string }; elements: string[]; learningPoint: { ko: string; en: string }; width: number; height: number; goalCount: number }
}
export const ENVIRONMENT_PRESETS: EnvironmentPreset[] = (JSON.parse(catalogJSON) as SourceEntry[]).map(entry => {
  const parsed = parseEnvImport(maps[`./maps/${entry.file}`])
  if (!parsed.ok) throw new Error(`Official preset ${entry.file}: ${parsed.error}`)
  const draft = parsed.draft
  const solutionData = JSON.parse(solutions[`./solutions/${entry.solutionFile}`]) as OfficialSolution
  return { id: entry.file.slice(0, -5).replaceAll(',', ''), draft, solution: solutionData.actions, solutionData, sourceFile: entry.file, solutionFile: entry.solutionFile,
    metadata: { name: { ko: entry.ko, en: entry.en }, description: { ko: entry.description, en: descriptions[entry.no - 1] }, learningPoint: { ko: entry.description, en: descriptions[entry.no - 1] }, difficulty: { ko: entry.tier, en: englishTiers[tiers.indexOf(entry.tier)] }, width: draft.width, height: draft.height, goalCount: draft.goals.length,
      elements: ['Goal', ...(draft.goals.length > 1 ? ['Multi-goal'] : []), ...(draft.walls.length ? ['Wall'] : []), ...(draft.bombs.length ? ['Bomb'] : []), ...(draft.portals?.length ? ['Portal'] : []), ...(draft.oneWays?.length ? ['One-way'] : []), ...(draft.fragiles?.length ? ['Fragile'] : []), ...(draft.switches?.length ? ['Switch', 'Toggle wall'] : [])] } }
})
