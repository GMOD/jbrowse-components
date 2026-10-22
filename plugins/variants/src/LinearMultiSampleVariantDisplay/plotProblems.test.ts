import { createTestEnvironment as createMatrixTestEnvironment } from './matrix/testEnv.ts'
import { createTestEnvironment } from './testEnv.ts'

const DRAFTS = [
  [
    'cuts out of order',
    {
      encoding: {
        color: {
          field: 'INFO.DP',
          scale: { type: 'threshold', domain: ['5', '1'] },
        },
      },
    },
    /^encoding\.color\.scale\.domain: threshold cuts are distinct numbers/,
  ],
  [
    'a range short of its cuts',
    {
      encoding: {
        color: {
          field: 'INFO.DP',
          scale: { type: 'threshold', domain: ['1', '5'], range: ['red'] },
        },
      },
    },
    /^encoding\.color\.scale\.range: 2 threshold cuts make 3 intervals/,
  ],
] as const

describe.each([
  ['genomic', createTestEnvironment],
  ['columns', createMatrixTestEnvironment],
])('the %s layout', (_layout, environment) => {
  test.each(DRAFTS)(
    "%s: a draft's problems are the notice it shows once applied",
    (_name, draft, line) => {
      const { display } = environment().createDisplay()
      const problems = display.plotProblems(draft)
      expect(problems).toEqual([expect.stringMatching(line)])
      display.applyPlot(draft)
      expect(display.notices).toEqual(problems)
    },
  )
})
