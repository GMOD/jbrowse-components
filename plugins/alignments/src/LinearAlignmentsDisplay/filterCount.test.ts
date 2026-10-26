import { bootAlignmentsDisplay, clickMenuItem } from './testUtils.ts'

import type { MenuItem } from '@jbrowse/core/ui'

function createDisplay(declared: Record<string, unknown> = {}) {
  console.warn = jest.fn()
  const trackConfig = {
    displays: [
      { type: 'LinearAlignmentsDisplay', displayId: 'd1', ...declared },
    ],
  }
  const { baseSession, mount } = bootAlignmentsDisplay({ trackConfig })
  const Session = baseSession
    .volatile(() => ({ rpcManager: {} }))
    .views(() => ({
      baseTrackConfig: () => trackConfig,
    }))
  return mount(Session, { configuration: 'd1' }).display
}

function filterRow(display: ReturnType<typeof createDisplay>) {
  const row = display
    .trackMenuItems()
    .find(
      (i: MenuItem) => 'label' in i && String(i.label).startsWith('Filter by'),
    )
  if (!row || !('subMenu' in row) || !Array.isArray(row.subMenu)) {
    throw new Error('no Filter by submenu')
  }
  return row as { label: string; subMenu: MenuItem[] }
}

describe('the Filter by count over every layer it filters', () => {
  test('a modification floor counts, and Clear all filters resets it', () => {
    const display = createDisplay()
    display.setBases({
      show: true,
      field: 'modifications',
      filter: { probability: [{ field: 'probability', gte: 0.8 }] },
    })
    expect(filterRow(display).label).toBe('Filter by (1)')
    clickMenuItem(filterRow(display).subMenu, 'Clear all filters')
    expect(display.basesFilter.probability.min).toBe(0.1)
    expect(filterRow(display).label).toBe('Filter by')
  })

  test('a declared type list does not count, and Clear all filters restores it', () => {
    const display = createDisplay({
      pileup: { bases: { filter: [{ field: 'code', oneOf: ['m'] }] } },
    })
    display.setBases({ show: true, field: 'modifications' })
    expect(filterRow(display).label).toBe('Filter by')
    display.setBases({ filter: { code: [{ field: 'code', oneOf: ['h'] }] } })
    expect(filterRow(display).label).toBe('Filter by (1)')
    clickMenuItem(filterRow(display).subMenu, 'Clear all filters')
    expect(display.basesFilter.codes).toEqual(['m'])
    expect(filterRow(display).label).toBe('Filter by')
  })

  test('a declared strict floor does not count, and Clear all filters restores it', () => {
    const display = createDisplay({
      pileup: { bases: { filter: [{ field: 'probability', gt: 0.5 }] } },
    })
    display.setBases({ show: true, field: 'modifications' })
    expect(filterRow(display).label).toBe('Filter by')
    display.setBases({ filter: { probability: undefined } })
    expect(filterRow(display).label).toBe('Filter by (1)')
    clickMenuItem(filterRow(display).subMenu, 'Clear all filters')
    expect(display.basesFilter.probability).toEqual({ min: 0.5, strict: true })
    expect(filterRow(display).label).toBe('Filter by')
  })

  test('the submenu holds the everyday read filters, then the dialog, with no icons', () => {
    const display = createDisplay()
    display.setShowSashimi(true)
    display.setDrawnReadConnections('link')
    const rows = filterRow(display).subMenu
    expect(rows.map(i => ('label' in i ? i.label : i.type))).toEqual([
      'Mapping quality',
      'SV evidence',
      'Split reads',
      'Spliced reads',
      'Non-canonical junctions',
      'More filters...',
    ])
    expect(rows.some(i => 'icon' in i && i.icon)).toBe(false)
  })

  test('the non-canonical junctions row filters and counts while the arcs draw', () => {
    const display = createDisplay()
    display.setShowSashimi(true)
    clickMenuItem(filterRow(display).subMenu, 'Hide non-canonical junctions')
    expect(display.junctionFilter.nonCanonical).toBe('exclude')
    expect(filterRow(display).label).toBe('Filter by (1)')
    display.setShowSashimi(false)
    expect(
      filterRow(display).subMenu.map(i => ('label' in i ? i.label : i.type)),
    ).not.toContain('Non-canonical junctions')
  })

  test('a junction floor stops counting while the arcs are off', () => {
    const display = createDisplay()
    display.setJunctionFilter({ minReads: 50 })
    expect(filterRow(display).label).toBe('Filter by (1)')
    display.setShowSashimi(false)
    expect(filterRow(display).label).toBe('Filter by')
  })
})
