import { assertUniquePassIds } from '@jbrowse/render-core/hal'

import { MULTI_ROW_MARKS } from './multiRowMarks.ts'

test('each multi-row mark has its own pass id', () => {
  expect(() => {
    assertUniquePassIds(MULTI_ROW_MARKS.map(m => m.pass))
  }).not.toThrow()
})
