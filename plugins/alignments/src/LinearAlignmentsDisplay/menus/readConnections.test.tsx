import { resolveSubMenu, staysOpenOnClick } from '@jbrowse/core/ui'
import { fireEvent, render, screen } from '@testing-library/react'

import { DEFAULT_MIN_INTERCHROM_READS } from '../constants.ts'
import { getReadConnectionsMenuItem } from './readConnections.ts'

import type { Facet, ConnectionFilter } from '../../shared/types.ts'
import type {
  ReadConnectionsMark,
  ReadConnectionsMode,
  ReadConnectionsPlacement,
} from '../constants.ts'

function makeModel() {
  return {
    unit: 'read' as 'read' | 'chain',
    setUnit(unit: 'read' | 'chain') {
      this.unit = unit
    },
    drawnReadConnections: 'off' as ReadConnectionsMode,
    setDrawnReadConnections(mode: ReadConnectionsMode) {
      this.drawnReadConnections = mode
    },
    get showReadConnections() {
      return this.drawnReadConnections !== 'off'
    },
    get readConnectionsMark(): ReadConnectionsMark {
      return this.drawnReadConnections === 'cloud' ? 'cloud' : 'arc'
    },
    readConnectionsPlacement: 'down' as ReadConnectionsPlacement,
    setReadConnectionsPlacement(placement: ReadConnectionsPlacement) {
      this.readConnectionsPlacement = placement
    },
    connectionFilter: {
      minInterchromReads: DEFAULT_MIN_INTERCHROM_READS,
    } as ConnectionFilter,
    setConnectionFilter(patch: Partial<ConnectionFilter>) {
      this.connectionFilter = { ...this.connectionFilter, ...patch }
    },
    showConnectors: false,
    setShowConnectors(v: boolean) {
      this.showConnectors = v
    },
    showOrdinaryPairs: true,
    setShowOrdinaryPairs(v?: boolean) {
      this.showOrdinaryPairs = v ?? true
    },
    readConnectionsLineWidth: 1,
    setReadConnectionsLineWidth(v: number) {
      this.readConnectionsLineWidth = v
    },
    // The SV-channel row is served from this menu, so its settings from
    // outside it are on the mock as well.
    showPileup: true,
    facet: undefined as Facet | undefined,
    setFacet(v?: Facet) {
      this.facet = v
    },
    applyDisplaySettings(settings: Record<string, unknown>) {
      return settings
    },
  }
}

function findByLabel(model: ReturnType<typeof makeModel>, label: string) {
  const items = resolveSubMenu(getReadConnectionsMenuItem(model))
  return (
    items.find(i => 'label' in i && i.label === label) ??
    items
      .flatMap(i => ('subMenu' in i ? resolveSubMenu(i) : []))
      .find(i => 'label' in i && i.label === label)
  )
}

const FILTER_ROWS = [
  'Off-screen mate connections',
  'Inter-chromosomal pairs',
  'Min reads at a breakpoint',
]

const BAND_ROWS = ['Show ordinary pairs', 'Arc placement', 'Arc line width']

function topLabels(model: ReturnType<typeof makeModel>) {
  return resolveSubMenu(getReadConnectionsMenuItem(model)).map(i =>
    'label' in i ? i.label : undefined,
  )
}

function bandRow(model: ReturnType<typeof makeModel>, label: string) {
  const item = resolveSubMenu(getReadConnectionsMenuItem(model)).find(
    i => 'label' in i && i.label === label,
  )
  if (!item || !('disabled' in item)) {
    throw new Error(`no band row ${label}`)
  }
  return item
}

function checkboxByLabel(model: ReturnType<typeof makeModel>, label: string) {
  const item = findByLabel(model, label)
  if (!item || !('checked' in item) || !('onClick' in item)) {
    throw new Error(`no ${label} checkbox`)
  }
  return item
}

describe('read connections menu', () => {
  test('"View as pairs" row toggles unit between read and chain', () => {
    const model = makeModel()
    const label = 'View as pairs / link supplementary alignments'
    checkboxByLabel(model, label).onClick()
    expect(model.unit).toBe('chain')
    checkboxByLabel(model, label).onClick()
    expect(model.unit).toBe('read')
  })

  // The overlay is one radio over the slot: arcs and the read cloud share a
  // band, so they were mutually exclusive checkboxes, and a radio says so.
  test('the "Connection overlay" radio selects the mode, None included', () => {
    const model = makeModel()
    for (const [label, mode] of [
      ['Read arcs', 'arc'],
      ['Read cloud', 'cloud'],
      ['None', 'off'],
    ] as const) {
      checkboxByLabel(model, label).onClick()
      expect(model.drawnReadConnections).toBe(mode)
    }
  })

  test('exactly one overlay row is checked, reflecting the drawn mark', () => {
    const model = makeModel()
    const checked = () =>
      (['None', 'Read arcs', 'Read cloud'] as const).filter(
        label => checkboxByLabel(model, label).checked,
      )
    expect(checked()).toEqual(['None'])
    model.drawnReadConnections = 'arc'
    expect(checked()).toEqual(['Read arcs'])
    model.drawnReadConnections = 'cloud'
    expect(checked()).toEqual(['Read cloud'])
  })

  // WHERE it is, not just that it exists. svChannels.test.ts calls the builder
  // directly and the spec-recipe test asserts against arrangements.ts's own
  // hardcoded path string, so between them the row could return to nowhere with
  // three published docs still sending readers here for it —
  // `check-menu-labels` gates each segment as a string somewhere in plugins/,
  // never the nesting.
  test('the SV-channel row is a direct child of this submenu', () => {
    const model = makeModel()
    const labels = resolveSubMenu(getReadConnectionsMenuItem(model)).map(i =>
      'label' in i ? i.label : undefined,
    )
    expect(labels).toContain('SV channels (pairs by orientation)')
  })
})

describe('the arc / read cloud band rows', () => {
  test('sit directly in Read connections under their heading', () => {
    const labels = topLabels(makeModel())
    const heading = labels.indexOf('Arc / read cloud band')
    expect(heading).toBeGreaterThan(-1)
    expect(labels.slice(heading + 1)).toEqual(BAND_ROWS)
  })

  test('are disabled with a help tooltip when no overlay is active', () => {
    const model = makeModel()
    for (const label of BAND_ROWS) {
      const row = bandRow(model, label)
      expect(row.disabled).toBe(true)
      expect(row.disabledHelpText).toBeTruthy()
    }
  })

  test('are enabled and functional when arcs are on', () => {
    const model = makeModel()
    model.drawnReadConnections = 'arc'
    for (const label of BAND_ROWS) {
      expect(bandRow(model, label).disabled).toBe(false)
    }
    checkboxByLabel(model, 'Above coverage').onClick()
    expect(model.readConnectionsPlacement).toBe('up')
  })
})

// `filter.connections` reaches the band and the curved connectors alike, so
// its rows live while either draws
describe('the connection filter rows', () => {
  test('sit under their own heading, ahead of the band rows', () => {
    const labels = topLabels(makeModel())
    const heading = labels.indexOf('Which connections draw')
    expect(heading).toBeGreaterThan(-1)
    expect(
      labels.slice(heading + 1, labels.indexOf('Arc / read cloud band')),
    ).toEqual(FILTER_ROWS)
  })

  test('are disabled while neither the band nor the connectors draw', () => {
    const model = makeModel()
    for (const label of FILTER_ROWS) {
      const row = bandRow(model, label)
      expect(row.disabled).toBe(true)
      expect(row.disabledHelpText).toBeTruthy()
    }
  })

  test('are enabled by the curved connectors with the band off', () => {
    const model = makeModel()
    model.showConnectors = true
    for (const label of FILTER_ROWS) {
      expect(bandRow(model, label).disabled).toBe(false)
    }
    for (const label of BAND_ROWS) {
      expect(bandRow(model, label).disabled).toBe(true)
    }
  })

  test('each connection category is one All / Only / Hide choice', () => {
    const model = makeModel()
    model.drawnReadConnections = 'arc'
    checkboxByLabel(model, 'Only inter-chromosomal pairs').onClick()
    expect(model.connectionFilter.interchrom).toBe('only')
    expect(topLabels(model)).toContain('Inter-chromosomal pairs — only')
    checkboxByLabel(model, 'Hide off-screen mate connections').onClick()
    expect(model.connectionFilter.offscreenMates).toBe('exclude')
    expect(model.connectionFilter.interchrom).toBe('only')
  })
})

// Turning arcs on, then long-range, then inter-chromosomal is one workflow, so
// no row here may dismiss the menu.
test('every toggle keeps the menu open', () => {
  const model = makeModel()
  const rows = resolveSubMenu(getReadConnectionsMenuItem(model)).flatMap(i =>
    'subMenu' in i ? resolveSubMenu(i) : [i],
  )
  const toggles = rows.filter(i => 'checked' in i)
  expect(toggles.length).toBeGreaterThan(0)
  expect(toggles.every(i => staysOpenOnClick(i))).toBe(true)
})

// `readConnections.lineWidth` had a setter and no way to reach it: every
// renderer and the SVG export read the width, and nothing in the UI wrote one.
describe('arc line width row', () => {
  function lineWidthRow(model: ReturnType<typeof makeModel>) {
    const item = bandRow(model, 'Arc line width')
    const row = 'subMenu' in item ? resolveSubMenu(item)[0] : undefined
    if (row?.type !== 'custom') {
      throw new Error('no line width slider row')
    }
    return row
  }

  // `findBy*`, not `getBy*`: makeSizeMenu draws the row through `lazy()`, so the
  // first paint is its Suspense fallback.
  test('the slider writes the width the renderers read', async () => {
    const model = makeModel()
    model.drawnReadConnections = 'arc'
    render(<>{lineWidthRow(model).render(() => {})}</>)

    const input = (
      await screen.findByTestId('arc-line-width-slider')
    ).querySelector('input')!
    fireEvent.change(input, { target: { value: 3 } })

    expect(model.readConnectionsLineWidth).toBe(3)
  })
})
