import { GridWorldEnv } from '../../core/environments/gridworld/GridWorldEnv'
import type { GridWorldConfig } from '../../core/environments/gridworld/types'

const directions = [[0,-1],[0,1],[-1,0],[1,0]]
type Gimmick = 'switch' | 'portal' | 'fragile'
export interface SearchAudit { status: 'complete' | 'incomplete'; states: number; successReachable: boolean; losingStates: number | null; witness?: number[]; losingWitness?: number[] }
/** Actual full states: position, goal mask, collapsed mask and group mask. Budget is explicit. */
export function auditStateGraph(config: GridWorldConfig, limit = 5000, avoid?: Gimmick, initialState?: GridWorldEnv): SearchAudit {
  const start = initialState?.fork() ?? new GridWorldEnv(config), keys = new Map([[start.getState(),0]])
  const queue: (GridWorldEnv | null)[] = [start], reverse: number[][] = [[]], wins = new Set<number>()
  const parent: [number,number][] = [[-1,-1]]
  let capped = false
  const forbidden = new Set((avoid === 'switch' ? config.switches : avoid === 'fragile' ? config.fragiles : avoid === 'portal' ? config.portals?.flatMap(p => p.ends) : [])?.map(p => `${p.x},${p.y}`))
  let witness: number[] | undefined
  for (let head=0;head<queue.length;head++) {
    const env = queue[head]!; queue[head] = null
    const [x,y] = env.getState().split(',').map(Number)
    for (let a=0;a<4;a++) {
      const [dx,dy] = directions[a]
      if (forbidden.has(`${x+dx},${y+dy}`)) continue
      const next = env.fork(), result = next.step(a)
      if (result.done && next.getRenderModel().goals.length) continue
      let id = keys.get(result.nextState)
      if (id === undefined) {
        if (keys.size >= limit) { capped = true; continue }
        id = keys.size; keys.set(result.nextState,id); queue.push(result.done ? null : next); reverse.push([]); parent.push([head,a])
        if (result.done) {
          wins.add(id)
          if (!witness) { witness=[];let cursor=id;while(parent[cursor][0]>=0){witness.unshift(parent[cursor][1]);cursor=parent[cursor][0]} }
        }
      }
      reverse[id].push(head)
    }
    // Terminal vertices are never expanded.
    while (head+1<queue.length && queue[head+1] === null) head++
  }
  const reachable = new Set(wins), pending = [...wins]
  for (let i=0;i<pending.length;i++) for (const from of reverse[pending[i]]) if (!reachable.has(from)) { reachable.add(from); pending.push(from) }
  const lost = capped ? -1 : [...keys.values()].find(id=>!reachable.has(id)) ?? -1
  const losingWitness:number[]=[];let cursor=lost
  while(cursor>=0&&parent[cursor][0]>=0){losingWitness.unshift(parent[cursor][1]);cursor=parent[cursor][0]}
  return { status: capped ? 'incomplete' : 'complete', states: keys.size, successReachable: wins.size>0, losingStates: capped ? null : keys.size-reachable.size, ...(witness ? { witness } : {}), ...(lost>=0 ? {losingWitness} : {}) }
}

/** Relaxed static graph: doors open, fragiles intact. Never a dynamic safety proof. */
export function auditStatic(config: GridWorldConfig) {
  const walls = new Set(config.walls.map(p=>`${p.x},${p.y}`)), arrows = new Map(config.oneWays?.map(p=>[`${p.x},${p.y}`,p.direction]))
  const portals = new Map(config.portals?.flatMap(p=>[[`${p.ends[0].x},${p.ends[0].y}`,`${p.ends[1].x},${p.ends[1].y}`],[`${p.ends[1].x},${p.ends[1].y}`,`${p.ends[0].x},${p.ends[0].y}`]]))
  const edges = new Map<string,string[]>(), reverse = new Map<string,string[]>(), blockedArrows: string[]=[]
  for(let y=0;y<config.height;y++)for(let x=0;x<config.width;x++){
    const key=`${x},${y}`;if(walls.has(key))continue
    const adjacent:string[]=[]
    for(let a=0;a<4;a++) { if(arrows.has(key)&&arrows.get(key)!==a)continue;const [dx,dy]=directions[a], nx=x+dx,ny=y+dy, to=`${nx},${ny}`;if(nx<0||ny<0||nx>=config.width||ny>=config.height||walls.has(to)){if(arrows.has(key))blockedArrows.push(key);continue}const end=portals.get(to)??to;adjacent.push(end);reverse.set(end,[...(reverse.get(end)??[]),key]) }
    edges.set(key,adjacent)
  }
  const visit=(graph:Map<string,string[]>,start:string)=>{const seen=new Set([start]),q=[start];for(let i=0;i<q.length;i++)for(const to of graph.get(q[i])??[])if(!seen.has(to)){seen.add(to);q.push(to)}return seen}
  const start=`${config.start.x},${config.start.y}`, forward=visit(edges,start), back=visit(reverse,start)
  return { blockedArrows, reachable:forward.size, cannotReturn:[...forward].filter(p=>!back.has(p)) }
}
