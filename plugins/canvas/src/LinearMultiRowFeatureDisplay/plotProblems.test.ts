import { createTestEnvironment } from './testEnv.ts'

test.each([
  [
    'cuts out of order',
    {
      encoding: {
        color: {
          field: 'segmean',
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
          field: 'segmean',
          scale: { type: 'threshold', domain: ['-1', '1'], range: ['blue'] },
        },
      },
    },
    /^encoding\.color\.scale\.range: 2 threshold cuts make 3 intervals/,
  ],
])(
  "%s: a draft's problems are the notice it shows once applied",
  (_name, draft, line) => {
    const { display } = createTestEnvironment().createDisplay()
    const problems = display.plotProblems(draft)
    expect(problems).toEqual([expect.stringMatching(line)])
    display.applyPlot(draft)
    expect(display.notices).toEqual(problems)
  },
)
