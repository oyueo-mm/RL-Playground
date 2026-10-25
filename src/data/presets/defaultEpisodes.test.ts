import { expect, it } from 'vitest'
import { defaultEpisodesForDifficulty } from './defaultEpisodes'
it.each([['very-easy',100],['easy',250],['medium',500],['hard',1000],['very-hard',2000],['custom',250],['toString',250],[undefined,250]])('maps official difficulty %s to %s without guessing from size',(id,count)=>{
  expect(defaultEpisodesForDifficulty(id as string|undefined)).toBe(count)
})
