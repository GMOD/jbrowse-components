import { resolveSubMenu, staysOpenOnClick } from '@jbrowse/core/ui'
import { fireEvent, render, screen } from '@testing-library/react'

import { DEFAULT_MIN_INTERCHROM_READS } from '../../shared/alignmentsFilter.ts'
import {
  getConnectionFilterItems,
  getReadConnectionsBandItems,
  getReadConnectionsMenuItem,
} from './readConnections.ts'

import type { Facet, ConnectionFilter } from '../../shared/types.ts'
import type {
  ReadConnectionsMark,
  ReadConnectionsMode,
  ReadConnectionsPlacement,
} from '../constants.ts'
import type { MenuItem } from '@jbrowse/core/ui'

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
    setReadConnectionsLineWidth(v?: number) {
      this.readConnectionsLineWidth = v ?? 1
    },
    showPileup: true,
    facet: undefined as Facet | undefined,
    get writtenFacet() {
      return this.facet ?? {}
    },
    applyPlot({ facet }: { facet?: unknown }) {
      this.facet = (facet ?? undefined) as Facet | undefined
    },
  }
}

type Model = ReturnType<typeof makeModel>

function rows(model: Model) {
  return resolveSubMenu(getReadConnectionsMenuItem(model))
}

function labelsOf(items: MenuItem[]) {
  return items.flatMap(i => ('label' in i ? [i.label] : []))
}

function byLabel(items: MenuItem[], label: string) {
  const item = items.find(
    i => 'label' in i && String(i.label).startsWith(label),
  )
  if (!item) {
    throw new Error(`no ${label} row`)
  }
  return item
}

function click(items: MenuItem[], label: string) {
  const item = byLabel(items, label)
  if (!('onClick' in item)) {
    throw new Error(`${label} is not clickable`)
  }
  item.onClick()
}

function checked(model: Model) {
  return rows(model).flatMap(i =>
    'checked' in i && i.checked && 'label' in i ? [i.label] : [],
  )
}

describe('read connections menu', () => {
  test('is checkboxes only, with no "?"', () => {
    const model = makeModel()
    model.drawnReadConnections = 'arc'
    const items = rows(model)
    expect(labelsOf(items)).toEqual([
      'View as pairs / link supplementary alignments',
      'Curved connectors',
      'Read arcs',
      'Read cloud',
      'Show ordinary pairs',
      'SV channels (pairs by orientation)',
    ])
    expect(
      items.every(
        i => 'checked' in i && !('helpText' in i) && staysOpenOnClick(i),
      ),
    ).toBe(true)
  })

  test('"View as pairs" toggles unit between read and chain', () => {
    const model = makeModel()
    click(rows(model), 'View as pairs')
    expect(model.unit).toBe('chain')
    click(rows(model), 'View as pairs')
    expect(model.unit).toBe('read')
  })

  // The two share a band, so ticking one unticks the other.
  test('read arcs and the read cloud tick one at a time', () => {
    const model = makeModel()
    click(rows(model), 'Read arcs')
    expect(model.drawnReadConnections).toBe('arc')
    click(rows(model), 'Read cloud')
    expect(model.drawnReadConnections).toBe('cloud')
    expect(checked(model)).toEqual(['Read cloud', 'Show ordinary pairs'])
    click(rows(model), 'Read cloud')
    expect(model.drawnReadConnections).toBe('off')
  })

  test('"Show ordinary pairs" appears only while the band draws', () => {
    const model = makeModel()
    expect(labelsOf(rows(model))).not.toContain('Show ordinary pairs')
    model.drawnReadConnections = 'cloud'
    click(rows(model), 'Show ordinary pairs')
    expect(model.showOrdinaryPairs).toBe(false)
  })
})

describe('connection filter rows', () => {
  test('appear while the band or the curved connectors draw', () => {
    const model = makeModel()
    expect(getConnectionFilterItems(model)).toEqual([])
    model.showConnectors = true
    expect(labelsOf(getConnectionFilterItems(model))).toEqual([
      'Off-screen mate connections',
      'Inter-chromosomal pairs',
      'Min reads at a breakpoint',
    ])
    model.showConnectors = false
    model.drawnReadConnections = 'arc'
    expect(getConnectionFilterItems(model)).toHaveLength(3)
  })

  test('each connection category is one All / Only / Hide choice', () => {
    const model = makeModel()
    model.drawnReadConnections = 'arc'
    const sub = (label: string) => {
      const item = byLabel(getConnectionFilterItems(model), label)
      return 'subMenu' in item ? resolveSubMenu(item) : []
    }
    click(sub('Inter-chromosomal'), 'Only inter-chromosomal pairs')
    expect(model.connectionFilter.interchrom).toBe('only')
    expect(labelsOf(getConnectionFilterItems(model))).toContain(
      'Inter-chromosomal pairs — only',
    )
    click(sub('Off-screen'), 'Hide off-screen mate connections')
    expect(model.connectionFilter.offscreenMates).toBe('exclude')
    expect(model.connectionFilter.interchrom).toBe('only')
  })
})

describe('band rows for Advanced', () => {
  test('appear only while arcs or the read cloud draw', () => {
    const model = makeModel()
    model.showConnectors = true
    expect(getReadConnectionsBandItems(model)).toEqual([])
    model.drawnReadConnections = 'cloud'
    expect(labelsOf(getReadConnectionsBandItems(model))).toEqual([
      'Read connections placement',
      'Read connections line width',
    ])
  })

  test('placement switches on click', () => {
    const model = makeModel()
    model.drawnReadConnections = 'arc'
    const item = byLabel(
      getReadConnectionsBandItems(model),
      'Read connections placement',
    )
    click('subMenu' in item ? resolveSubMenu(item) : [], 'Above coverage')
    expect(model.readConnectionsPlacement).toBe('up')
  })

  // `findBy*`, not `getBy*`: makeSizeMenu draws the row through `lazy()`, so the
  // first paint is its Suspense fallback.
  test('the line width slider writes the width the renderers read', async () => {
    const model = makeModel()
    model.drawnReadConnections = 'arc'
    const item = byLabel(
      getReadConnectionsBandItems(model),
      'Read connections line width',
    )
    const row = 'subMenu' in item ? resolveSubMenu(item)[0] : undefined
    if (row?.type !== 'custom') {
      throw new Error('no line width slider row')
    }
    render(<>{row.render(() => {})}</>)
    const input = (
      await screen.findByTestId('read-connections-line-width-slider')
    ).querySelector('input')!
    fireEvent.change(input, { target: { value: 3 } })
    expect(model.readConnectionsLineWidth).toBe(3)
  })
})
