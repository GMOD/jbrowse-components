import { bootAlignmentsDisplay } from './testUtils.ts'

function createDisplay() {
  const { baseSession, mount } = bootAlignmentsDisplay({
    trackConfig: {
      displays: [{ type: 'LinearAlignmentsDisplay', displayId: 'd1' }],
    },
  })
  const Session = baseSession.volatile(() => ({ rpcManager: {} }))
  return mount(Session, { configuration: 'd1' }).display
}

test.each([
  [
    'cuts out of order',
    { color: { field: 'mapq', scale: 'threshold', domain: ['5', '1'] } },
    /^color\.domain: threshold cuts are distinct numbers/,
  ],
  [
    'a range short of its cuts',
    {
      color: {
        field: 'mapq',
        scale: 'threshold',
        domain: ['1', '5'],
        range: ['red'],
      },
    },
    /^color\.range: 2 threshold cuts make 3 intervals/,
  ],
  [
    'labels past the preset strand domain',
    { color: { field: 'strand', labels: ['a', 'b', 'c'] } },
    /^color\.labels: labels names one value each, and 3 labels name 2 values/,
  ],
])(
  "%s: a draft's problems are the notice it shows once applied",
  (_name, draft, line) => {
    const display = createDisplay()
    const problems = display.plotProblems(draft)
    expect(problems).toEqual([expect.stringMatching(line)])
    display.applyPlot(draft)
    expect(display.notices).toEqual(problems)
  },
)
