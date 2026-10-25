// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { LEARNING_RESOURCES, ResourceLinks } from './ResourceLinks'
afterEach(cleanup)
it.each([0,1,2,3,4,5])('chapter %i offers relevant Korean free and preserved English resources',chapter=>{
 render(<ResourceLinks locale="ko" chapter={chapter} />)
 const section=screen.getByTestId(`resources-${chapter}`)
 expect(within(section).getAllByRole('link').length).toBeGreaterThan(0)
 expect(section.textContent).toContain('무료 공개')
 fireEvent.click(within(section).getByRole('button',{name:'영어 무료'}))
 expect(within(section).getAllByRole('link').length).toBeGreaterThan(0)
 for(const link of within(section).getAllByRole('link')) {expect(link.getAttribute('target')).toBe('_blank');expect(link.getAttribute('rel')).toContain('noopener')}
})
it('labels expired K-MOOC availability separately and never advertises the publisher book as free',()=>{
 render(<ResourceLinks locale="ko" chapter={0} />)
 fireEvent.click(screen.getByRole('button',{name:'이용 조건 확인'}))
 expect(screen.getByRole('link',{name:/누구나 할 수 있는 강화학습/})).toBeTruthy()
 expect(screen.getByText(/현재 접근 미검증/)).toBeTruthy()
 expect(LEARNING_RESOURCES.find(r=>r.id==='sutton-barto')!.access).toBe('reference')
})
it.each([0,1,2,3,4,5])('roadmap stage %i includes Korean resources',stage=>{
 render(<ResourceLinks locale="ko" stage={stage} />)
 expect(screen.getAllByRole('link').length).toBeGreaterThan(0)
})
it('supports English filtering and accurate official SARSA/Q-learning lecture links',()=>{
 render(<ResourceLinks locale="en" chapter={3} />)
 fireEvent.click(screen.getByRole('button',{name:'Korean · free'}))
 expect(screen.getByRole('link',{name:/SARSA\(살사\)/}).getAttribute('href')).toContain('lid=3a577ef03953e2a6')
 expect(LEARNING_RESOURCES.find(r=>r.id==='kocw-1536047-11')!.url).toContain('lid=c130b77c3de0a514')
})
