import { createTestEnvironment } from './testEnv.ts'

test.each([
  [
    'cuts out of order, which the implied score field paints',
    {
      encoding: { color: { scale: { type: 'threshold', domain: ['5', '1'] } } },
    },
    /^encoding\.color\.scale\.domain: threshold cuts are distinct numbers/,
  ],
  [
    'a range short of its cuts',
    {
      encoding: {
        color: {
          scale: { type: 'threshold', domain: ['1', '5'], range: ['red'] },
        },
      },
    },
    /^encoding\.color\.scale\.range: 2 threshold cuts make 3 intervals/,
  ],
  [
    'y scale ends reversed',
    { encoding: { y: { scale: { domainMin: 9, domainMax: 1 } } } },
    /^encoding\.y\.scale\.domainMax: domainMax is below domainMin/,
  ],
  [
    'a ninth threshold cut, past what the shader reads',
    {
      encoding: {
        color: {
          scale: {
            type: 'threshold',
            domain: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
          },
        },
      },
    },
    /^encoding\.color\.scale\.domain: a wiggle threshold reads at most 8 cuts/,
  ],
  [
    'one color on a heatmap',
    { mark: 'rect', encoding: { color: { value: 'green' } } },
    /^encoding\.color: one color paints a heatmap flat/,
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
    encoding: {
      color: {
        scale: {
          type: 'threshold',
          domain: ['0', '5'],
          range: ['blue', 'grey', 'red'],
          names: ['low', 'mid', 'high'],
        },
      },
    },
  }
  expect(display.plotProblems(draft)).toEqual([])
  display.applyPlot(draft)
  expect(display.notices).toEqual([])
})
