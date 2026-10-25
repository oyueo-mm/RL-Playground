import { useState } from 'react'
import json from './learningResources.json?raw'
import type { Locale } from '../i18n'

export interface LearningResource { id: string; title: string; provider: string; url: string; language: 'ko' | 'en'; format: 'video' | 'course' | 'document' | 'paper' | 'tutorial'; level: 'beginner' | 'intermediate' | 'advanced'; access: 'free' | 'registration' | 'availability-unverified' | 'reference'; chapterIds: number[]; stageIds: number[]; checked: string; note?: string; noteEn?: string }
export const LEARNING_RESOURCES = JSON.parse(json) as LearningResource[]
export function ResourceLinks({ locale, chapter, stage }: { locale: Locale; chapter?: number; stage?: number }) {
  const ko = locale === 'ko'
  const [filter, setFilter] = useState(ko ? 'ko-free' : 'en-free')
  const relevant = LEARNING_RESOURCES.filter(item => chapter !== undefined ? item.chapterIds.includes(chapter) : item.stageIds.includes(stage!))
  const matches = relevant.filter(item => filter === 'ko-free' ? item.language === 'ko' && item.access === 'free' : filter === 'en-free' ? item.language === 'en' && item.access === 'free' : filter === 'advanced' ? item.format === 'paper' || item.level === 'advanced' || item.access === 'reference' : item.access === 'registration' || item.access === 'availability-unverified')
  return <aside className="study-resources resource-catalog" data-testid={chapter !== undefined ? `resources-${chapter}` : `roadmap-resources-${stage}`}>
    <h3>{ko ? '참고 문헌 및 더 알아보기' : 'References and further study'}</h3>
    <div className="resource-filters" role="group" aria-label={ko ? '학습 자료 분류' : 'Learning resource categories'}>{[['ko-free',ko ? '한국어 무료' : 'Korean · free'],['en-free',ko ? '영어 무료' : 'English · free'],['advanced',ko ? '논문 및 심화 자료' : 'Papers and advanced'],['conditions',ko ? '이용 조건 확인' : 'Check availability']].map(([id,label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>
    <ul>{matches.map(item => <li key={item.id}><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title} ↗</a><p>{item.provider}</p><small>{item.language === 'ko' ? (ko ? '한국어' : 'Korean') : (ko ? '영어' : 'English')} · {ko ? ({ video:'영상',course:'강좌',document:'문서',paper:'논문',tutorial:'실습' })[item.format] : item.format} · {ko ? ({ beginner:'입문',intermediate:'중급',advanced:'심화' })[item.level] : item.level} · {ko ? ({ free:'무료 공개',registration:'등록 필요','availability-unverified':'현재 접근 미검증',reference:'서지 · 이용 조건 확인' })[item.access] : item.access}</small>{item.note && <details><summary>{ko ? '확인 상태' : 'Verification'}</summary><p lang={locale}>{ko ? item.note : item.noteEn ?? item.note} ({item.checked})</p></details>}</li>)}</ul>
    {!matches.length && <p>{ko ? '이 분류에 해당하는 자료가 없습니다.' : 'No resources in this category.'}</p>}
  </aside>
}
