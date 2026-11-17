import { encodeWiggleRegions } from '../shared/buildSourceRenderData.ts'
import { findWiggleHit } from './components/findHit.ts'
import { createTestEnvironment, makeSource } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'
import type { WiggleSourceData } from '@jbrowse/wiggle-core'

// The Fiber-seq shape: two cell lines, a haplotype pair each, the pair
// colored alike across cell lines.
const HAPS = [
  { name: 'GM12878 Hap1', group: 'GM12878', color: 'rgb(0,114,178)' },
  { name: 'GM12878 Hap2', group: 'GM12878', color: 'rgb(213,94,0)' },
  { name: 'K562 Hap1', group: 'K562', color: 'rgb(0,114,178)' },
  { name: 'K562 Hap2', group: 'K562', color: 'rgb(213,94,0)' },
]

function scored(name: string, score: number): WiggleSourceData {
  return {
    ...makeSource(name),
    featurePositions: new Uint32Array([0, 100]),
    featureScores: new Float32Array([score]),
    featureMinScores: new Float32Array([score]),
    featureMaxScores: new Float32Array([score]),
    numFeatures: 1,
  }
}

function makeDisplay(
  rows: Record<string, unknown> = { field: 'group' },
  sources = HAPS,
) {
  const { createDisplay } = createTestEnvironment({ displayConfig: { rows } })
  const { display, view } = createDisplay()
  display.setRpcData(
    0,
    {
      sources: sources.map((source, i) => ({
        ...scored(source.name, i + 1),
        ...source,
      })),
    },
    view.displayedRegions[0],
  )
  return { display, view }
}

function offersClustering(display: { trackMenuItems: () => MenuItem[] }) {
  return display
    .trackMenuItems()
    .some(item => 'label' in item && /cluster/i.test(String(item.label)))
}

const labelsOf = (item: MenuItem | undefined) =>
  item && 'subMenu' in item && Array.isArray(item.subMenu)
    ? item.subMenu.map(i => ('label' in i ? i.label : undefined))
    : []

describe('rows: { field: "group" }', () => {
  it('draws a row per value, each holding its sources', () => {
    const { display } = makeDisplay()
    expect(display.isGroupedRows).toBe(true)
    expect(display.numRows).toBe(2)
    expect(display.numSources).toBe(4)
    expect(display.effectiveRowHeight).toBe(display.rowsHeight / 2)
    expect(display.markSources.map(s => [s.name, s.row])).toEqual([
      ['GM12878 Hap1', 0],
      ['GM12878 Hap2', 0],
      ['K562 Hap1', 1],
      ['K562 Hap2', 1],
    ])
  })

  it('labels each row by its value, and the sidebar the export draws too', () => {
    const { display } = makeDisplay()
    expect(display.labelledRows.map(r => r.label)).toEqual(['GM12878', 'K562'])
    expect(display.drawsRowLabels).toBe(true)
    expect(display.sidebarPanel.rows.map(r => r.name)).toEqual([
      'GM12878',
      'K562',
    ])
  })

  it('relabels a row by its value through rows.labels', () => {
    const { display } = makeDisplay({
      field: 'group',
      labels: { K562: 'K-562 (CML)' },
    })
    expect(display.labelledRows.map(r => r.label)).toEqual([
      'GM12878',
      'K-562 (CML)',
    ])
  })

  it('orders the rows by a rows.sort of values', () => {
    const { display } = makeDisplay({ field: 'group', sort: ['K562'] })
    expect(display.labelledRows.map(r => r.name)).toEqual(['K562', 'GM12878'])
    expect(display.markSources.find(s => s.name === 'K562 Hap2')?.row).toBe(0)
  })

  it('moves a row with its sources when the subtracks are reordered', () => {
    const { display } = makeDisplay()
    display.setRowOrder([{ name: 'K562 Hap2' }])
    expect(display.labelledRows.map(r => r.name)).toEqual(['K562', 'GM12878'])
  })

  it('keeps each source its own color inside its row, keyed by name', () => {
    const { display } = makeDisplay()
    expect(display.sharesPanel).toBe(true)
    expect(display.markSources.map(s => s.color)).toEqual(
      HAPS.map(h => h.color),
    )
    const [key] = display.rowColorScales
    expect(key?.entries.map(e => e.label)).toEqual(HAPS.map(h => h.name))
  })

  it('encodes each source into its row', () => {
    const { display } = makeDisplay()
    const [layers] = [...encodeWiggleRegions(display).values()]
    expect(layers?.map(l => l.rowIndex)).toEqual([0, 0, 1, 1])
  })

  it('reports every source overlaid in the row under the pointer', () => {
    const { display, view } = makeDisplay()
    const rowHeight = display.effectiveRowHeight
    const hit = findWiggleHit(
      display,
      [
        {
          refName: view.displayedRegions[0]!.refName,
          screenStartPx: 0,
          screenEndPx: 100,
          start: 0,
          end: 100,
          displayedRegionIndex: 0,
        },
      ],
      50,
      display.rowsTopOffset + rowHeight * 1.5,
    )
    expect(hit?.rows.map(r => [r.source, r.score])).toEqual([
      ['K562 Hap1', 3],
      ['K562 Hap2', 4],
    ])
  })

  it('draws no tree and offers no clustering, a tree having no leaf per row', () => {
    const { display } = makeDisplay()
    expect(display.drawsTree).toBe(false)
    expect(offersClustering(display)).toBe(false)
  })

  it('offers the grouping as a layout of its own in the Plot type menu', () => {
    const { display } = makeDisplay()
    const plotType = display
      .trackMenuItems()
      .find(item => 'label' in item && item.label === 'Plot type')
    expect(labelsOf(plotType)).toEqual([
      'Multi-row',
      'Rows by group',
      'Overlapping',
    ])
  })

  it('names a field no subtrack carries', () => {
    const { display } = makeDisplay({ field: 'grup' })
    expect(display.numRows).toBe(1)
    expect(display.liveNotices).toContain(
      'rows: no subtrack carries "grup", so every subtrack shares one row',
    )
  })

  it('reads any subtrack attribute, a samples table column included', () => {
    const { display } = makeDisplay(
      { field: 'haplotype' },
      HAPS.map(h => ({ ...h, haplotype: h.name.split(' ')[1]! })),
    )
    expect(display.labelledRows.map(r => r.name)).toEqual(['Hap1', 'Hap2'])
  })

  it('keeps a row per source under rows: "source"', () => {
    const { display } = makeDisplay({ field: 'source' })
    expect(display.numRows).toBe(4)
    expect(display.sharesPanel).toBe(false)
    expect(display.drawsTree).toBe(true)
    expect(offersClustering(display)).toBe(true)
    expect(display.markSources.map(s => s.row)).toEqual([0, 1, 2, 3])
  })
})
