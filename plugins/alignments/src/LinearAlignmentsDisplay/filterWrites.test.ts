import { applyConfSettings, getConf } from '@jbrowse/core/configuration'

import { bootAlignmentsDisplay } from './testUtils.ts'

import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

const WRITTEN: FieldPredicate[] = [
  { field: 'mapq', gte: 20 },
  { field: 'tags.HP', equal: '1' },
]

function createDisplay(filter: FieldPredicate[] = WRITTEN) {
  const { baseSession, mount } = bootAlignmentsDisplay({
    trackConfig: {
      displays: [{ type: 'LinearAlignmentsDisplay', displayId: 'd1', filter }],
    },
  })
  const Session = baseSession.volatile(() => ({ rpcManager: {} }))
  return mount(Session, { configuration: 'd1' }).display
}

const filterOf = (display: ReturnType<typeof createDisplay>) =>
  getConf(display, 'filter') as FieldPredicate[]

// Each way a draft or a bag reaches the config: the plot write a preset or an
// agent makes, and the settings bag a session spec or a share link writes
const WRITERS = {
  applyPlot: (display: ReturnType<typeof createDisplay>, filter: unknown) => {
    display.applyPlot({ filter })
  },
  applyConfSettings: (
    display: ReturnType<typeof createDisplay>,
    filter: unknown,
  ) => {
    applyConfSettings(display, { filter })
  },
}

describe.each(Object.entries(WRITERS))('%s', (_, write) => {
  test('a written field joins the fields already written', () => {
    const display = createDisplay()
    write(display, [{ field: 'svSignal', equal: true }])
    expect(filterOf(display)).toEqual([
      ...WRITTEN,
      { field: 'svSignal', equal: true },
    ])
  })

  test('a written field replaces its own entries in place', () => {
    const display = createDisplay()
    write(display, [{ field: 'mapq', gte: 1 }])
    expect(filterOf(display)).toEqual([
      { field: 'mapq', gte: 1 },
      { field: 'tags.HP', equal: '1' },
    ])
  })

  // `{ field }` keeps its stored meaning: that field's defaults removed
  test('a bare field drops its defaults', () => {
    const display = createDisplay()
    write(display, [{ field: 'flags.DUP' }])
    expect(filterOf(display)).toEqual([...WRITTEN, { field: 'flags.DUP' }])
  })

  test('a bare string keys as the field it names', () => {
    const display = createDisplay([{ field: 'svSignal', equal: false }])
    write(display, ['svSignal'])
    expect(filterOf(display)).toEqual([{ field: 'svSignal', equal: true }])
  })

  test('null resets the list', () => {
    const display = createDisplay()
    write(display, null)
    expect(filterOf(display)).toEqual([])
  })
})

test('"Edit plot..." writes the list whole', () => {
  const display = createDisplay()
  display.applyPlot(
    { filter: [{ field: 'svSignal', equal: true }] },
    { whole: true },
  )
  expect(filterOf(display)).toEqual([{ field: 'svSignal', equal: true }])
})
