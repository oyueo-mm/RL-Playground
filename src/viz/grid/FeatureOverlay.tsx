import type { EnvRenderModel } from '../../core/types/render'
import { positionId, toggleWallOpen } from '../../core/environments/gridworld/features'

const arrows = ['↑', '↓', '←', '→']
// Drawn as shapes rather than glyphs: repeated clicks on a text arrow selected it like page text.
const arrowRotation = [0, 180, 270, 90]
const color = (id: string) => `hsl(${Math.abs([...id].reduce((sum, letter) => (Math.imul(sum, 31) + letter.charCodeAt(0)) | 0, 7)) * 137.508 % 360} 45% 38%)`

export function FeatureOverlay({ model, cellSize: s, selected }: { model: EnvRenderModel; cellSize: number; selected?: string | null }) {
  const features = model.features ?? {}
  const center = (pos: { x: number; y: number }) => ({ x: (pos.x + 0.5) * s, y: (pos.y + 0.5) * s })
  return <g pointerEvents="none" className="feature-layer">
    {features.portals?.flatMap(pair => {
      const connected = pair.ends.some(end => positionId(end) === selected)
      return [connected && pair.ends.length === 2 ? <line key={`link-${pair.id}`} x1={center(pair.ends[0]).x} y1={center(pair.ends[0]).y} x2={center(pair.ends[1]).x} y2={center(pair.ends[1]).y} stroke={color(pair.id)} strokeDasharray="4 4" strokeWidth={1.5} vectorEffect="non-scaling-stroke" /> : null,
        ...pair.ends.map(end => <g key={`${pair.id}-${positionId(end)}`} data-testid={`portal-${positionId(end)}`}><title>{`Portal ${pair.id}`}</title><rect x={end.x * s + 1} y={end.y * s + 1} width={s - 2} height={s - 2} fill="#f2eff9" /><text {...center(end)} textAnchor="middle" dominantBaseline="central" fontSize={s * .47} fill={color(pair.id)}>◎</text><text x={(end.x + .5) * s} y={(end.y + .91) * s} textAnchor="middle" fontSize={s * .18} fill={color(pair.id)}>{pair.id.slice(0, 4)}</text></g>)]
    })}
    {features.oneWays?.map(tile => <g key={positionId(tile)} data-testid={`one-way-${positionId(tile)}`} data-direction={tile.direction}><title>{`One-way ${arrows[tile.direction]}`}</title><rect x={tile.x * s + 1} y={tile.y * s + 1} width={s - 2} height={s - 2} fill="#edf3fa" />
      <g transform={`translate(${center(tile).x} ${center(tile).y}) rotate(${arrowRotation[tile.direction]}) scale(${s / 48})`} fill="#5d7fa5" stroke="#5d7fa5"><path d="M0 13V-4" strokeWidth={4} strokeLinecap="round" fill="none" /><path d="M0 -15L-10 -2H10Z" strokeWidth={1.5} strokeLinejoin="round" /></g></g>)}
    {features.fragiles?.map(tile => {
      const collapsed = model.collapsedFragiles?.includes(positionId(tile)) ?? false
      return <g key={positionId(tile)} data-testid={`fragile-${positionId(tile)}`} data-collapsed={collapsed}><title>{collapsed ? 'Collapsed: blocked' : 'Fragile: collapses after departure'}</title><rect x={tile.x * s + 1} y={tile.y * s + 1} width={s - 2} height={s - 2} fill={collapsed ? '#707975' : '#fff4db'} /><path d={`M${(tile.x + .3) * s} ${(tile.y + .1) * s}l${s * .2} ${s * .28}l${-s * .14} ${s * .2}l${s * .22} ${s * .32}`} fill="none" stroke={collapsed ? '#edf0ed' : '#b78b45'} strokeWidth={s * .06} /></g>
    })}
    {[...(features.switches ?? []).map(tile => ({ ...tile, type: 'switch', initialOpen: false })), ...(features.toggleWalls ?? []).map(tile => ({ ...tile, type: 'toggle', initialOpen: !!tile.initialOpen }))].map(tile => {
      const toggled = model.openGroups?.includes(tile.groupId) ?? false
      const open = tile.type === 'toggle' ? toggleWallOpen(tile, toggled) : toggled
      const linked = [...(features.switches ?? []), ...(features.toggleWalls ?? [])].some(other => positionId(other) === selected && other.groupId === tile.groupId)
      const ink = tile.type === 'toggle' && !open ? 'white' : color(tile.groupId)
      return <g key={`${tile.type}-${positionId(tile)}`} data-testid={`${tile.type}-${positionId(tile)}`} data-open={open} data-initial-open={tile.type === 'toggle' ? tile.initialOpen : undefined}><title>{`${tile.type} ${tile.groupId}: ${open ? 'open' : 'closed'}${tile.type === 'toggle' ? ` (starts ${tile.initialOpen ? 'open' : 'closed'})` : ''}`}</title>
        {linked && selected && <line x1={center(tile).x} y1={center(tile).y} x2={(Number(selected.split(',')[0]) + .5) * s} y2={(Number(selected.split(',')[1]) + .5) * s} stroke={color(tile.groupId)} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
        <rect x={tile.x * s + 2} y={tile.y * s + 2} width={s - 4} height={s - 4} fill={tile.type === 'toggle' && !open ? '#536958' : '#eef5e8'} stroke={color(tile.groupId)} strokeDasharray={tile.type === 'toggle' && open ? '3 3' : undefined} strokeWidth={1} />
        <text {...center(tile)} textAnchor="middle" dominantBaseline="central" fontSize={s * .4} fill={ink}>{tile.type === 'switch' ? '⏻' : open ? '□' : '▥'}</text><text x={(tile.x + .5) * s} y={(tile.y + .9) * s} textAnchor="middle" fontSize={s * .16} fill={ink}>{tile.groupId.slice(0, 4)}</text>
        {/* Corner notch marks walls whose initial state is open, so mixed-state groups stay distinguishable after toggling. */}
        {tile.type === 'toggle' && tile.initialOpen && <path data-testid={`initial-open-${positionId(tile)}`} d={`M${(tile.x + 1) * s - 2} ${tile.y * s + 2}h${-s * .3}l${s * .3} ${s * .3}Z`} fill={ink} />}
      </g>
    })}
  </g>
}
