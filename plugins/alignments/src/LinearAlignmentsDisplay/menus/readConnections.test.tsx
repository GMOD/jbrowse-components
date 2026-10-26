import { resolveSubMenu, staysOpenOnClick } from '@jbrowse/core/ui'
import { fireEvent, render, screen } from '@testing-library/react'

import { DEFAULT_MIN_INTERCHROM_READS } from '../../shared/alignmentsFilter.ts'
import {
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
  test('is checkboxes, then the Pair band radios, with no "?"', () => {
    const model = makeModel()
    model.drawnReadConnections = 'arc'
    const items = rows(model)
    expect(labelsOf(items)).toEqual([
      'Link mates and supplementary alignments',
      'Pileup connectors',
      'SV channels (pairs by orientation)',
      'Ordinary pairs',
      'Pair band',
      'None',
      'Read arcs',
      'Read cloud',
    ])
    const rowKinds = items.map(i => i.type)
    expect(rowKinds).toEqual([
      'checkbox',
      'checkbox',
      'checkbox',
      'checkbox',
      'subHeader',
      'radio',
      'radio',
      'radio',
    ])
    expect(
      items.every(
        i =>
          i.type === 'subHeader' ||
          (i.type !== 'divider' &&
            'onClick' in i &&
            !('helpText' in i) &&
            staysOpenOnClick(i)),
      ),
    ).toBe(true)
  })

  test('"Link mates" toggles unit between read and chain', () => {
    const model = makeModel()
    click(rows(model), 'Link mates')
    expect(model.unit).toBe('chain')
    click(rows(model), 'Link mates')
    expect(model.unit).toBe('read')
  })

  test('the Pair band radios pick one of none, arcs and the cloud', () => {
    const model = makeModel()
    expect(checked(model)).toEqual(['None'])
    click(rows(model), 'Read arcs')
    expect(model.drawnReadConnections).toBe('arc')
    click(rows(model), 'Read cloud')
    expect(model.drawnReadConnections).toBe('cloud')
    expect(checked(model)).toEqual(['Ordinary pairs', 'Read cloud'])
    click(rows(model), 'None')
    expect(model.drawnReadConnections).toBe('off')
  })

  test('"Ordinary pairs" appears only while the band draws', () => {
    const model = makeModel()
    expect(labelsOf(rows(model))).not.toContain('Ordinary pairs')
    model.drawnReadConnections = 'cloud'
    click(rows(model), 'Ordinary pairs')
    expect(model.showOrdinaryPairs).toBe(false)
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
