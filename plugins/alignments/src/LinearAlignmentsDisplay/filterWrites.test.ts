import { applyConfSettings, getConf } from '@jbrowse/core/configuration'

import { bootAlignmentsDisplay } from './testUtils.ts'

import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

const WRITTEN: FieldPredicate[] = [
  { field: 'mapq', gte: 20 },
  { field: 'tags.HP', equal: '1' },
]

function createDisplay() {
  const { baseSession, mount } = bootAlignmentsDisplay({
    trackConfig: {
      displays: [
        { type: 'LinearAlignmentsDisplay', displayId: 'd1', filter: WRITTEN },
      ],
    },
  })
  const Session = baseSession.volatile(() => ({ rpcManager: {} }))
  return mount(Session, { configuration: 'd1' }).display
}

const filterOf = (display: ReturnType<typeof createDisplay>) =>
  getConf(display, 'filter') as FieldPredicate[]

// A draft or a bag writes a filter list whole, as Vega-Lite's is, so an
// agent's clone-edit-apply of `plot` removes the entry it deleted, and `[]`
// clears. Merging by field kept every field left out (ADR-240's 2026-11-04
// amendment, reverted); a menu row writing one field uses `setFilterFields`.
test('an edited plot drops the filter entry deleted from it', () => {
  const display = createDisplay()
  const plot = structuredClone(display.plot)
  plot.filter = (plot.filter as FieldPredicate[]).filter(
    p => p.field !== 'mapq',
  )
  display.applyPlot(plot)
  expect(filterOf(display)).toEqual([{ field: 'tags.HP', equal: '1' }])
})

test.each([
  [
    'applyPlot',
    (d: ReturnType<typeof createDisplay>, filter: unknown) => {
      d.applyPlot({ filter })
    },
  ],
  [
    'applyConfSettings',
    (d: ReturnType<typeof createDisplay>, filter: unknown) => {
      applyConfSettings(d, { filter })
    },
  ],
])('%s writes the list whole, and [] clears it', (_, write) => {
  const display = createDisplay()
  write(display, [{ field: 'svSignal', equal: true }])
  expect(filterOf(display)).toEqual([{ field: 'svSignal', equal: true }])
  write(display, [])
  expect(filterOf(display)).toEqual([])
})

test('a field write keeps the other fields', () => {
  const display = createDisplay()
  display.setFilterFields({ svSignal: [{ field: 'svSignal', equal: true }] })
  expect(filterOf(display)).toEqual([
    ...WRITTEN,
    { field: 'svSignal', equal: true },
  ])
})
