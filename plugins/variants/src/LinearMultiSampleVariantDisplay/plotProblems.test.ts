import { createTestEnvironment as createMatrixTestEnvironment } from './matrix/testEnv.ts'
import { createTestEnvironment } from './testEnv.ts'

const DRAFTS = [
  [
    'cuts out of order',
    { color: { field: 'INFO.DP', scale: 'threshold', domain: ['5', '1'] } },
    /^color\.domain: threshold cuts are distinct numbers/,
  ],
  [
    'a range short of its cuts',
    {
      color: {
        field: 'INFO.DP',
        scale: 'threshold',
        domain: ['1', '5'],
        range: ['red'],
      },
    },
    /^color\.range: 2 threshold cuts make 3 intervals/,
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
