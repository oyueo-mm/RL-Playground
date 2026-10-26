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
  'Use disposable bridges and a permanent return crossing to retrieve every goal in the ruins.',
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
  "The Endless Labyrinth": "Resolve the final twelve-sector labyrinth through portal routes, one-use passages, and seven interacting security circuits.",
  "Empire of Oblivion": "Explore non-linear ruins with seven control circuits and intersecting portals, unlocking seals in a planned order.",
  "Nemesis Complex": "Revisit research wings while managing doors that toggle open and closed to retrieve all goals.",
  "Fractured Metropolis": "Explore six dense city districts, reconnect distributed power gates, and navigate a two-line transit portal network.",
  "Abyssal Fortress": "Advance deep into the fortress and navigate alternate return routes to recover all sealed goals.",
  "Obsidian Citadel": "Unlock five linked security stages across six sectors, then use the portal to recover the final vault goal.",
  "The Sealed Observatory": "Cross the disposable entrance bridge, unlock observation sectors in sequence and restore access to the starting vault.",
  "Final Proving Grounds": "Release successive security doors in the correct order, then return to the starting region for the final goal.",
  "Warp Nexus": "Resolve portal-linked regions and security switches in order before recovering the final sealed goal.",
  "Collapsing Archipelago": "Cross the disposable island bridge, restore the return route with successive switches, and release the starting vault last.",
  "Sealed Research Base": "Open laboratory security doors in order, use the isolated portal wing, then return to the starting vault.",
  "Multi-Goal Expedition": "Cross a one-use bridge, unlock successive districts, then return to the starting vault for the final goal.",
  'Garden of Choices': 'Find a safe detour through a garden with scattered bombs.',
  'Clockwork Village': 'Read outgoing arrows and control a security switch while collecting goals.',
  'Shattered Quarter': 'Connect six goals across broken districts with security doors.',
  'Fragile Bridge': 'Collapsing bridges are optional risky shortcuts; preserve a safe return route.',
  'Crumbling Canyon': 'Choose between disposable bridges and a longer safe detour.',
}
export const DIFFICULTIES = [{id:'very-easy',ko:'매우 쉬움',en:'Very Easy'},{id:'easy',ko:'쉬움',en:'Easy'},{id:'medium',ko:'보통',en:'Medium'},{id:'hard',ko:'어려움',en:'Hard'},{id:'very-hard',ko:'매우 어려움',en:'Very Hard'}] as const

export interface EnvironmentPreset {
  id: string
  draft: GridEditorDraft
  solution: number[]
  solutionData: OfficialSolution
  previewUrl: string
  sourceFile: string
  solutionFile: string
  metadata: { name: { ko: string; en: string }; description: { ko: string; en: string }; difficulty: { id: string; ko: string; en: string }; elements: string[]; learningPoint: { ko: string; en: string }; width: number; height: number; goalCount: number }
}
export const ENVIRONMENT_PRESETS: EnvironmentPreset[] = (JSON.parse(catalogJSON) as SourceEntry[]).map(entry => {
  const parsed = parseEnvImport(maps[`./maps/${entry.mapFile.split('/').at(-1)!}`])
  if (!parsed.ok) throw new Error(`Official preset ${entry.mapFile.split('/').at(-1)!}: ${parsed.error}`)
  const draft = parsed.draft
  const solutionData = JSON.parse(solutions[`./solutions/${entry.solutionFile.split('/').at(-1)!}`]) as OfficialSolution
  return { previewUrl: previews[`./previews/${entry.previewFile.split('/').at(-1)!}`], id: entry.stem, draft, solution: solutionData.actions, solutionData, sourceFile: entry.mapFile.split('/').at(-1)!, solutionFile: entry.solutionFile.split('/').at(-1)!,
    metadata: { name: { ko: entry.ko, en: entry.en }, description: { ko: entry.description, en: revisedDescriptions[entry.en] ?? descriptions[originalNames.indexOf(entry.en)] ?? entry.en }, learningPoint: { ko: entry.description, en: revisedDescriptions[entry.en] ?? descriptions[originalNames.indexOf(entry.en)] ?? entry.en }, difficulty: DIFFICULTIES[Math.floor((entry.id - 1) / 6)], width: draft.width, height: draft.height, goalCount: draft.goals.length,
      elements: ['Goal', ...(draft.goals.length > 1 ? ['Multi-goal'] : []), ...(draft.walls.length ? ['Wall'] : []), ...(draft.bombs.length ? ['Bomb'] : []), ...(draft.portals?.length ? ['Portal'] : []), ...(draft.oneWays?.length ? ['One-way'] : []), ...(draft.fragiles?.length ? ['Fragile'] : []), ...(draft.switches?.length ? ['Switch', 'Toggle wall'] : [])] } }
})
