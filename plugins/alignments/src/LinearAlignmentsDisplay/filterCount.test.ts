import { bootAlignmentsDisplay, clickMenuItem } from './testUtils.ts'

import type { MenuItem } from '@jbrowse/core/ui'

function createDisplay() {
  console.warn = jest.fn()
  const { baseSession, mount } = bootAlignmentsDisplay({
    trackConfig: {
      displays: [{ type: 'LinearAlignmentsDisplay', displayId: 'd1' }],
    },
  })
  const Session = baseSession.volatile(() => ({ rpcManager: {} }))
  return mount(Session, { configuration: 'd1' }).display
}

function filterRow(display: ReturnType<typeof createDisplay>) {
  const row = display
    .trackMenuItems()
    .find(
      (i: MenuItem) =>
        'label' in i && String(i.label).startsWith('Filter by...'),
    )
  if (!row || !('subMenu' in row) || !Array.isArray(row.subMenu)) {
    throw new Error('no Filter by... submenu')
  }
  return row as { label: string; subMenu: MenuItem[] }
}

describe('the Filter by... count over every layer it filters', () => {
  test('a modification floor counts, and Clear all filters resets it', () => {
    const display = createDisplay()
    display.setBases({
      show: true,
      field: 'modifications',
      filter: { probability: [{ field: 'probability', gte: 0.8 }] },
    })
    expect(filterRow(display).label).toBe('Filter by... (1)')
    clickMenuItem(filterRow(display).subMenu, 'Clear all filters')
    expect(display.basesFilter.probability.min).toBe(0.1)
    expect(filterRow(display).label).toBe('Filter by...')
  })

  test('a junction floor stops counting while the arcs are off', () => {
    const display = createDisplay()
    display.setJunctionFilter({ minReads: 50 })
    expect(filterRow(display).label).toBe('Filter by... (1)')
    display.setShowSashimi(false)
    expect(filterRow(display).label).toBe('Filter by...')
  })
})
