import catalogJSON from './catalog.json?raw'
import { parseEnvImport } from '../../viz/controls/envEditorIO'
import type { GridEditorDraft } from '../../viz/controls/envEditorDraft'

export interface OfficialSolution { id: string; name: {ko:string;en:string}; steps: number; actions: number[]; goalOrder: number[][]; events: Record<string, number> }
interface SourceEntry { id: number; stem: string; ko: string; en: string; tier: string; description: string; mapFile: string; solutionFile: string; previewFile: string; width: number; height: number; goals: number }
const maps = import.meta.glob<string>('./maps/*.json', { query: '?raw', import: 'default', eager: true })
const previews = import.meta.glob<string>('./previews/*.png', { query: '?url', import: 'default', eager: true })
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
const originalNames = ["Meadow Walk", "First Portal Lesson", "One Switch, One Door", "Fragile Bridge", "Arrow Alley", "Forked Village", "Marsh Detour", "Twin Portal Plaza", "Lab Corridors", "Ruin Retrieval", "Crossroads Expedition", "Portal City", "Power Control Zone", "Crumbling Canyon", "One-Way Circuit", "Multi-Goal Expedition", "Sealed Research Base", "Collapsing Archipelago", "Warp Nexus", "Final Proving Grounds"]
const revisedDescriptions: Record<string,string> = {
  'Garden of Choices': 'Find a safe detour through a garden with scattered bombs.',
  'Clockwork Village': 'Read outgoing arrows and control a security switch while collecting goals.',
  'Shattered Quarter': 'Connect six goals across broken districts with security doors.',
  'The Sealed Observatory': 'Explore a sealed observatory and its access controls.',
  'Obsidian Citadel': 'Explore a large citadel with multiple secured regions.',
  'Abyssal Fortress': 'Plan a collection route through a large fortress.',
  'Fractured Metropolis': 'Navigate a sprawling city and its interconnected regions.',
  'Nemesis Complex': 'Control access while exploring a large research complex.',
  'Empire of Oblivion': 'Plan a multi-goal expedition across a large empire.',
  'The Endless Labyrinth': 'Explore the 48 by 40 labyrinth and collect every goal.',
  'Fragile Bridge': 'Collapsing bridges are optional risky shortcuts; preserve a safe return route.',
  'Crumbling Canyon': 'Choose between disposable bridges and a longer safe detour.',
  'Collapsing Archipelago': 'Explore sealed island regions using alternative collapsing bridges.',
  'Final Proving Grounds': 'Retrieve goals from regions protected by switches and security doors.',
}
const tiers = ['쉬움', '보통', '어려움', '매우 어려움', '극악']
const englishTiers = ['Easy', 'Medium', 'Hard', 'Very Hard', 'Extreme']
export interface EnvironmentPreset {
  id: string
  draft: GridEditorDraft
  solution: number[]
  solutionData: OfficialSolution
  previewUrl: string
  sourceFile: string
  solutionFile: string
  metadata: { name: { ko: string; en: string }; description: { ko: string; en: string }; difficulty: { ko: string; en: string }; elements: string[]; learningPoint: { ko: string; en: string }; width: number; height: number; goalCount: number }
}
export const ENVIRONMENT_PRESETS: EnvironmentPreset[] = (JSON.parse(catalogJSON) as SourceEntry[]).map(entry => {
  const parsed = parseEnvImport(maps[`./maps/${entry.mapFile.split('/').at(-1)!}`])
  if (!parsed.ok) throw new Error(`Official preset ${entry.mapFile.split('/').at(-1)!}: ${parsed.error}`)
  const draft = parsed.draft
  const solutionData = JSON.parse(solutions[`./solutions/${entry.solutionFile.split('/').at(-1)!}`]) as OfficialSolution
  return { previewUrl: previews[`./previews/${entry.previewFile.split('/').at(-1)!}`], id: entry.stem, draft, solution: solutionData.actions, solutionData, sourceFile: entry.mapFile.split('/').at(-1)!, solutionFile: entry.solutionFile.split('/').at(-1)!,
    metadata: { name: { ko: entry.ko, en: entry.en }, description: { ko: entry.description, en: revisedDescriptions[entry.en] ?? descriptions[originalNames.indexOf(entry.en)] ?? entry.en }, learningPoint: { ko: entry.description, en: revisedDescriptions[entry.en] ?? descriptions[originalNames.indexOf(entry.en)] ?? entry.en }, difficulty: { ko: entry.tier, en: englishTiers[tiers.indexOf(entry.tier)] }, width: draft.width, height: draft.height, goalCount: draft.goals.length,
      elements: ['Goal', ...(draft.goals.length > 1 ? ['Multi-goal'] : []), ...(draft.walls.length ? ['Wall'] : []), ...(draft.bombs.length ? ['Bomb'] : []), ...(draft.portals?.length ? ['Portal'] : []), ...(draft.oneWays?.length ? ['One-way'] : []), ...(draft.fragiles?.length ? ['Fragile'] : []), ...(draft.switches?.length ? ['Switch', 'Toggle wall'] : [])] } }
})
