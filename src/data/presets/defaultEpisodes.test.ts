import { expect, it } from 'vitest'
import { defaultEpisodesForDifficulty } from './defaultEpisodes'
it.each([['very-easy',500],['easy',1000],['medium',2000],['hard',3000],['very-hard',5000],['custom',250],['toString',250],[undefined,250]])('maps official difficulty %s to %s without guessing from size',(id,count)=>{
  expect(defaultEpisodesForDifficulty(id as string|undefined)).toBe(count)
})
