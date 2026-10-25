import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

import { zoomAt, type Camera } from './camera'
const initial={zoom:1,x:0,y:0}
export function GridViewport({width,height,children,active=true,editable=false,agentPos,resetKey,onPanStart,locale='en'}:{width:number;height:number;children:ReactNode;active?:boolean;editable?:boolean;agentPos?:string;resetKey?:unknown;onPanStart?:()=>void;locale?:'ko'|'en'}) {
  const ref=useRef<HTMLDivElement>(null)
  const [size,setSize]=useState({width:0,height:0}),[camera,setCamera]=useState<Camera>(initial),[follow,setFollow]=useState(false)
  const space=useRef(false),dragging=useRef(false),suppressClick=useRef(false),pointers=useRef(new Map<number,{x:number;y:number}>())
  const ko=locale==='ko'
  useLayoutEffect(()=>{setCamera(initial)},[width,height,resetKey,size.width,size.height])
  useLayoutEffect(()=>{
    if(!active)return
    const element=ref.current!,measure=()=>{const r=element.getBoundingClientRect();setSize(p=>p.width===r.width&&p.height===r.height?p:{width:r.width,height:r.height})}
    measure();if(typeof ResizeObserver==='undefined')return
    const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect()
  },[active])
  useEffect(()=>{
    if(!active)return
    const clear=()=>{space.current=false;dragging.current=false;pointers.current.clear()}
    const down=(e:KeyboardEvent)=>{if(e.code==='Space'&&!(e.target instanceof Element&&e.target.closest('input,textarea,select,[contenteditable=true]'))){space.current=true;if(!(e.target instanceof Element&&e.target.closest('button')))e.preventDefault()}}
    const up=(e:KeyboardEvent)=>{if(e.code==='Space')space.current=false}
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',clear)
    return()=>{clear();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clear)}
  },[active])
  useEffect(()=>{
    if(!active)return
    const element=ref.current!,wheel=(e:WheelEvent)=>{
      e.preventDefault();setFollow(false);const r=element.getBoundingClientRect()
      if(!e.ctrlKey&&e.deltaMode===0&&(Math.abs(e.deltaX)>0||Math.abs(e.deltaY)<40))setCamera(c=>({...c,x:c.x-e.deltaX,y:c.y-e.deltaY}))
      else setCamera(c=>zoomAt(c,Math.exp(-e.deltaY*(e.deltaMode===1?.04:.002)),e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2))
    }
    element.addEventListener('wheel',wheel,{passive:false});return()=>element.removeEventListener('wheel',wheel)
  },[active])
  const columns=Math.max(1,Number.isFinite(width)?width:1),rows=Math.max(1,Number.isFinite(height)?height:1),scale=Math.max(0,Math.min((size.width-8)/columns,(size.height-8)/rows))
  const centerAgent=()=>{if(!agentPos)return;const[x,y]=agentPos.split(',').map(Number);setCamera(c=>({...c,x:(columns/2-x-.5)*scale*c.zoom,y:(rows/2-y-.5)*scale*c.zoom}))}
  useEffect(()=>{
    if(!follow||!agentPos)return
    const[x,y]=agentPos.split(',').map(Number);setCamera(c=>({...c,x:(columns/2-x-.5)*scale*c.zoom,y:(rows/2-y-.5)*scale*c.zoom}))
  },[follow,agentPos,columns,rows,scale,camera.zoom])
  const release=(id:number)=>{pointers.current.delete(id);if(!pointers.current.size)dragging.current=false}
  return <div className="grid-viewport-shell">
    <div ref={ref} tabIndex={0} aria-label={ko?'맵 카메라':'Map camera'} className="grid-viewport camera-viewport" data-testid="grid-viewport" data-zoom={camera.zoom} data-pan-x={camera.x} data-pan-y={camera.y}
      onClickCapture={e=>{if(suppressClick.current){e.preventDefault();e.stopPropagation();suppressClick.current=false}}}
      onPointerDownCapture={e=>{
        if(!active)return
        if(!pointers.current.size)suppressClick.current=false
        pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY})
        if(!(e.button===1||e.button===0&&(!editable||space.current)||e.pointerType==='touch'&&pointers.current.size>=2))return
        onPanStart?.();e.currentTarget.focus({preventScroll:true})
        e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture?.(e.pointerId);dragging.current=true;setFollow(false)
      }}
      onPointerMoveCapture={e=>{
        const old=pointers.current.get(e.pointerId);if(!old)return
        const next={x:e.clientX,y:e.clientY}
        if(!dragging.current){pointers.current.set(e.pointerId,next);return}
        e.preventDefault();e.stopPropagation();suppressClick.current=true
        const other=[...pointers.current.entries()].find(([id])=>id!==e.pointerId)?.[1]
        if(other){const before=Math.hypot(old.x-other.x,old.y-other.y),after=Math.hypot(next.x-other.x,next.y-other.y),r=e.currentTarget.getBoundingClientRect();setCamera(c=>{const z=zoomAt(c,after/Math.max(1,before),(old.x+other.x)/2-r.left-r.width/2,(old.y+other.y)/2-r.top-r.height/2);return{...z,x:z.x+(next.x-old.x)/2,y:z.y+(next.y-old.y)/2}})}
        else setCamera(c=>({...c,x:c.x+next.x-old.x,y:c.y+next.y-old.y}))
        pointers.current.set(e.pointerId,next)
      }} onPointerUpCapture={e=>{if(dragging.current)e.stopPropagation();release(e.pointerId)}} onPointerCancelCapture={e=>release(e.pointerId)} onLostPointerCapture={e=>release(e.pointerId)}>
      <div className="grid-drawing camera-drawing" style={{width:columns*scale*camera.zoom,height:rows*scale*camera.zoom,transform:`translate(calc(-50% + ${camera.x}px), calc(-50% + ${camera.y}px))`}} data-testid="grid-stack">{children}</div>
    </div>
    <div className="zoom-controls" role="group" aria-label="Zoom">
      <button type="button" aria-label="Zoom out" disabled={camera.zoom<=.25} onClick={()=>setCamera(c=>zoomAt(c,1/1.25,0,0))}>−</button>
      <button type="button" onClick={()=>{setCamera(initial);setFollow(false)}} aria-label="Fit entire map">{Math.round(camera.zoom*100)}% ⛶</button>
      <button type="button" aria-label="Zoom in" disabled={camera.zoom>=24} onClick={()=>setCamera(c=>zoomAt(c,1.25,0,0))}>+</button>
      {agentPos&&<><button onClick={centerAgent} aria-label={ko?'에이전트 위치로 이동':'Center agent'}>◎</button><button aria-pressed={follow} onClick={()=>setFollow(!follow)}>{ko?'따라가기':'Follow'}</button></>}
    </div>
    {(width>20||height>20)&&<svg className="camera-minimap" viewBox={`0 0 ${columns} ${rows}`} aria-label={ko?'현재 시야 위치':'Current viewport'}><rect width={columns} height={rows} fill="#edf3e9"/><rect x={columns/2-(size.width/2+camera.x)/(scale*camera.zoom||1)} y={rows/2-(size.height/2+camera.y)/(scale*camera.zoom||1)} width={size.width/(scale*camera.zoom||1)} height={size.height/(scale*camera.zoom||1)} fill="#73a77a44" stroke="#376645" strokeWidth={.5}/>{agentPos&&<circle cx={Number(agentPos.split(',')[0])+.5} cy={Number(agentPos.split(',')[1])+.5} r={1} fill="#dc554a"/>}</svg>}
  </div>
}
