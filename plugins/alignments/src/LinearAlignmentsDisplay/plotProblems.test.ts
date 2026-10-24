import { predicateListDefaults } from '@jbrowse/display-kit/fieldPredicateConfigSchema'

import { ALIGNMENTS_FILTER_DEFAULTS } from '../shared/alignmentsFilter.ts'
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
  [
    'a linear scale over the fixed strand levels',
    {
      encoding: {
        color: {
          field: 'strand',
          scale: { type: 'linear', range: ['red', 'blue'] },
        },
      },
    },
    /^encoding\.color\.scale\.type: strand paints its own levels/,
  ],
  [
    'a threshold over the fixed strand levels',
    {
      encoding: {
        color: { field: 'strand', scale: { type: 'threshold', domain: ['0'] } },
      },
    },
    /^encoding\.color\.scale\.type: strand paints its own levels/,
  ],
  [
    'a column sort with no pos',
    { sort: 'mapq' },
    /^sort: mapq ranks the reads over one column/,
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

test('Edit plot finds the defaults each filter merges with', () => {
  const display = createDisplay()
  const defaults = predicateListDefaults(display.configuration)
  expect(defaults.map(d => d.path)).toEqual([
    'filter',
    'coverage.interbase.filter',
    'pileup.bases.filter',
  ])
  expect(defaults[0]!.entries).toBe(ALIGNMENTS_FILTER_DEFAULTS)
  expect(defaults[1]!.entries).toEqual([
    { field: 'depth', gte: 8 },
    { field: 'fraction', gt: 0.3 },
  ])
})
