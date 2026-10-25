import { useRef, useState } from 'react'

/** Resize the adjacent analysis pane without unmounting either pane or its state. */
export function PanelResizeHandle({ locale }: { locale:'ko'|'en' }) {
  const [value,setValue]=useState(40), drag=useRef<{x:number;y:number;size:number;mobile:boolean}|null>(null)
  const resize=(element:HTMLElement,pixels:number,mobile:boolean)=>{
    const pane=element.parentElement!,container=pane.parentElement!.getBoundingClientRect(),extent=mobile?container.height:container.width
    const clamped=Math.max(mobile?100:220,Math.min(extent*.7,pixels))
    pane.style.setProperty('--analysis-size',`${clamped}px`);setValue(Math.round(clamped/extent*100))
  }
  return <div className="panel-resize" tabIndex={0} role="separator" aria-label={locale==='ko'?'분석 패널 크기 조절':'Resize analysis pane'} aria-valuemin={15} aria-valuemax={70} aria-valuenow={value}
    onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);const mobile=window.innerWidth<=760,r=e.currentTarget.parentElement!.getBoundingClientRect();drag.current={x:e.clientX,y:e.clientY,size:mobile?r.height:r.width,mobile}}}
    onPointerMove={e=>{const d=drag.current;if(d)resize(e.currentTarget,d.size+(d.mobile?d.y-e.clientY:d.x-e.clientX),d.mobile)}}
    onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}} onLostPointerCapture={()=>{drag.current=null}}
    onDoubleClick={e=>{e.currentTarget.parentElement!.style.removeProperty('--analysis-size');setValue(40)}}
    onKeyDown={e=>{if(e.key==='Home'){e.currentTarget.parentElement!.style.removeProperty('--analysis-size');setValue(40);return}if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const mobile=window.innerWidth<=760,r=e.currentTarget.parentElement!.getBoundingClientRect();resize(e.currentTarget,(mobile?r.height:r.width)+(['ArrowUp','ArrowLeft'].includes(e.key)?24:-24),mobile)}}><span>⠿</span></div>
}
