import { useEffect, useRef, useState } from 'react'
import type { EnvRenderModel } from '../../core/types/render'
import { translations, type Locale } from '../../ui/i18n'
import { trainingCopy } from '../../ui/trainingCopy'

export function RewardInfo({model,locale}:{model:EnvRenderModel;locale:Locale}) {
  const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null)
  const t=translations[locale].rewards,l=trainingCopy[locale]
  const close=()=>{setOpen(false);button.current?.focus()}
  useEffect(()=>{
    if(!open)return
    // Close after the target's click: collapsing this inline panel on pointerdown
    // would move the checkbox underneath the pointer before its click is delivered.
    const outside=(e:MouseEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)}
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);button.current?.focus()}}
    document.addEventListener('click',outside);document.addEventListener('keydown',escape)
    return()=>{document.removeEventListener('click',outside);document.removeEventListener('keydown',escape)}
  },[open])
  return <div ref={root} className="reward-info">
    <button ref={button} type="button" aria-label={l.info} aria-expanded={open} onClick={()=>setOpen(!open)} data-testid="reward-info-button">ⓘ</button>
    {open&&<div role="dialog" aria-label={l.rules} className="reward-info-popover" data-testid="reward-info-popover">
      <strong>{l.rules}</strong><button aria-label={l.close} onClick={close}>×</button>
      <dl>{[['Goal',model.goalReward],['Bomb',model.bombPenalty],[t.step,model.stepReward],[t.wall,model.wallPenalty]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{Number(value)>0?'+':''}{value}</dd></div>)}</dl>
      <p>{t.firstGoal}</p>
    </div>}
  </div>
}
