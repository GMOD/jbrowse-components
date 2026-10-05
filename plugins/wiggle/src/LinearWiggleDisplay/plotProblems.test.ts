import { createTestEnvironment } from './testEnv.ts'

test.each([
  [
    'cuts out of order',
    { color: { field: 'score', scale: 'threshold', domain: ['5', '1'] } },
    /^color\.domain: threshold cuts are distinct numbers/,
  ],
  [
    'a range short of its cuts',
    {
      color: {
        field: 'score',
        scale: 'threshold',
        domain: ['1', '5'],
        range: ['red'],
      },
    },
    /^color\.range: 2 threshold cuts make 3 intervals/,
  ],
  [
    'cuts out of order with no field, which paints score',
    { color: { scale: 'threshold', domain: ['5', '1'] } },
    /^color\.domain: threshold cuts are distinct numbers/,
  ],
  [
    'scales.y ends reversed',
    { scales: { y: { domainMin: 9, domainMax: 1 } } },
    /^scales\.y\.domainMax: domainMax is below domainMin/,
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

test('labelled bands with no field paint the score threshold and warn nothing', () => {
  const { display } = createTestEnvironment().createDisplay()
  const draft = {
    color: {
      scale: 'threshold',
      domain: ['0', '5'],
      range: ['blue', 'grey', 'red'],
      labels: ['low', 'mid', 'high'],
    },
  }
  expect(display.plotProblems(draft)).toEqual([])
  display.applyPlot(draft)
  expect(display.notices).toEqual([])
})
