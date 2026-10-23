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
    {
      encoding: {
        color: {
          field: 'tags.NM',
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
          field: 'tags.NM',
          scale: { type: 'threshold', domain: ['1', '5'], range: ['red'] },
        },
      },
    },
    /^encoding\.color\.scale\.range: 2 threshold cuts make 3 intervals/,
  ],
  [
    'names past the preset strand domain',
    {
      encoding: {
        color: { field: 'strand', scale: { names: ['a', 'b', 'c'] } },
      },
    },
    /^encoding\.color\.scale\.names: names gives one value each its name in the key, and 3 names meet 2 values/,
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

test('the row order is part of the plot', () => {
  const display = createDisplay()
  expect(display.plotKeys).toContain('sort')
  display.applyPlot({ sort: 'split' })
  expect(display.plot).toMatchObject({ sort: 'split' })
  expect(display.layoutOrder).toBe('split')
})
