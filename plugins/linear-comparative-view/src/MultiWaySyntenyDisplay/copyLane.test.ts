import { SimpleFeature } from '@jbrowse/core/util'

import {
  copyLaneName,
  fileUnderCopies,
  laneGenome,
  laneOf,
} from './copyLane.ts'
import { buildLanes, laneGeometry } from './laneStack.ts'
import { groupFeatures } from './layoutMultiWay.ts'
import {
  anchorRuleAboveY,
  anchorRuleY,
  buildAnchorRule,
  buildRibbonGeometry,
} from './multiwayGeometry.ts'

import type { RowFrame, Span } from './layoutMultiWay.ts'
import type { MultiWayCell } from './multiwayRenderTypes.ts'

const WIDTH = 800

// one MCScan .anchors row: a peach gene and one grape gene it pairs with
function anchorsRow(name: string, start: number, refName: string) {
  return new SimpleFeature({
    uniqueId: `${name}-${refName}`,
    refName: 'chrG7',
    start,
    end: start + 100,
    strand: 1,
    name,
    assemblyName: 'peach',
    mate: {
      assemblyName: 'grape',
      refName,
      start: start + 1000,
      end: start + 1100,
      name: `${name}-${refName}`,
    },
  })
}

// each peach gene paired with its ortholog on chr11 and two older copies
const triplicated = ['g1', 'g2', 'g3'].flatMap((name, i) =>
  ['chr11', 'chr9', 'chr4'].map(refName =>
    anchorsRow(name, 100 + i * 200, refName),
  ),
)

describe('a copy lane name', () => {
  test('names a contig with its assembly as a locstring does', () => {
    expect(copyLaneName('grape', 'chr9')).toBe('{grape}chr9')
    expect(laneOf('{grape}chr9')).toEqual({
      assemblyName: 'grape',
      refName: 'chr9',
    })
  })

  test('a genome lane is its assembly name', () => {
    expect(laneOf('grape')).toEqual({ assemblyName: 'grape' })
    expect(laneGenome('{HG002#1}chr1:extra')).toBe('HG002#1')
  })
})

describe('fileUnderCopies', () => {
  test('files each pair under its contig’s lane, one group per anchor gene', () => {
    const groups = fileUnderCopies(groupFeatures(triplicated))
    expect(groups.map(g => g.key)).toEqual(['g1', 'g2', 'g3'])
    expect([...groups[0]!.mates.keys()]).toEqual([
      '{grape}chr11',
      '{grape}chr9',
      '{grape}chr4',
    ])
  })

  test('a contig under a fifth of its genome’s heaviest draws no lane', () => {
    const genes = Array.from({ length: 10 }, (_, i) => `g${i}`)
    const groups = fileUnderCopies(
      groupFeatures([
        ...genes.map((name, i) => anchorsRow(name, i * 100, 'chr11')),
        ...genes
          .slice(0, 2)
          .map((name, i) => anchorsRow(name, i * 100, 'chr9')),
        anchorsRow('g0', 0, 'chr2'),
      ]),
    )
    const lanes = new Set(groups.flatMap(g => [...g.mates.keys()]))
    expect([...lanes]).toEqual(['{grape}chr11', '{grape}chr9'])
  })
})

describe('copy lanes around an anchor in the middle', () => {
  const groups = fileUnderCopies(groupFeatures(triplicated))
  // each copy draws at half the anchor's scale, so its px differ from the anchor's
  const copyFrame = (refName: string): RowFrame => ({
    refName,
    min: 0,
    max: 2000,
    flipped: false,
    alsoOn: [],
    alsoOnMore: 0,
    alsoAt: [],
    fitMin: 1000,
    fitMax: 1600,
  })
  const anchorPx = (bp: number) => (bp / 1000) * WIDTH
  const axisSpanOf = (refName: string, start: number, end: number) =>
    refName === 'chrG7' ? ([anchorPx(start), anchorPx(end)] as Span) : undefined
  const stackOf = (assemblyNames: string[]) => {
    const anchorRow = assemblyNames.indexOf('peach')
    return buildLanes({
      assemblyNames,
      anchorRow,
      groups,
      anchorSpans: new Map(
        groups.map(g => [
          g.key,
          axisSpanOf('chrG7', g.anchor.start, g.anchor.end)!,
        ]),
      ),
      rowFrames: new Map(
        ['chr11', 'chr9', 'chr4'].map(refName => [
          copyLaneName('grape', refName),
          copyFrame(refName),
        ]),
      ),
      axisSpanOf,
      axisSpansOf: (refName, start, end) => {
        const span = axisSpanOf(refName, start, end)
        return span ? [span] : []
      },
      anchorBpPerPx: 1000 / WIDTH,
      anchorRegionSpans: [[0, WIDTH]],
      contigOf: () => undefined,
      refNameAliasOf: () => undefined,
      width: WIDTH,
      geometry: laneGeometry(400, assemblyNames.length),
    })
  }
  const ribbons = (cells: Map<string, MultiWayCell>, key: string) => {
    const cell = cells.get(key)
    if (cell?.kind !== 'ribbons') {
      throw new Error(`${key} is not a ribbon cell`)
    }
    const { bp1, bp4, instanceCount } = cell.data
    return Array.from({ length: instanceCount }, (_, i) => ({
      top: bp1[i]!,
      bottom: bp4[i]!,
    }))
  }
  const geneStarts = [100, 300, 500]
  const copyPx = geneStarts.map(start => ((start + 1000) * WIDTH) / 2000)
  const onAnchorPx = geneStarts.map(anchorPx)

  test('each gutter beside the anchor joins it to one copy, gene to gene', () => {
    const stack = stackOf(['{grape}chr9', 'peach', '{grape}chr11'])
    const { cells, layers } = buildRibbonGeometry({
      stack,
      laneLinks: undefined,
      ribbonColor: 'grey',
      drawCurves: false,
      rowsVsAnchor: true,
    })
    expect(ribbons(cells, 'ribbons:0')).toEqual(
      copyPx.map((top, i) => ({ top, bottom: onAnchorPx[i] })),
    )
    expect(ribbons(cells, 'ribbons:1')).toEqual(
      onAnchorPx.map((top, i) => ({ top, bottom: copyPx[i] })),
    )
    expect(layers.map(l => l.rows)).toEqual([
      [0, 1],
      [1, 2],
    ])
  })

  test('a gutter between two copies draws its far copy against the anchor', () => {
    const stack = stackOf([
      '{grape}chr4',
      '{grape}chr9',
      'peach',
      '{grape}chr11',
    ])
    const { cells, layers } = buildRibbonGeometry({
      stack,
      laneLinks: undefined,
      ribbonColor: 'grey',
      drawCurves: false,
      rowsVsAnchor: true,
    })
    expect(ribbons(cells, 'ribbons:0')).toEqual(
      copyPx.map((top, i) => ({ top, bottom: onAnchorPx[i] })),
    )
    const above = layers.find(l => l.key === 'ribbons:0')!
    expect(above.rows).toEqual([0, 2])
    expect(above.yTop + above.height).toBe(anchorRuleAboveY(stack.lanes[1]!))
    expect([...cells.keys()].some(key => key.includes('>'))).toBe(false)
  })

  test('read neighbour to neighbour, two copies would join through the anchor gene they share', () => {
    const stack = stackOf(['peach', '{grape}chr11', '{grape}chr9'])
    const joined = (rowsVsAnchor: boolean) =>
      ribbons(
        buildRibbonGeometry({
          stack,
          laneLinks: undefined,
          ribbonColor: 'grey',
          drawCurves: false,
          rowsVsAnchor,
        }).cells,
        'ribbons:1',
      ).map(r => r.top)
    expect(joined(false)).toEqual(copyPx)
    expect(joined(true)).toEqual(onAnchorPx)
  })

  test('the anchor’s rule sits beside each copy away from it', () => {
    const stack = stackOf([
      '{grape}chr4',
      '{grape}chr9',
      'peach',
      '{grape}chr11',
      '{grape}chr2',
    ])
    const { cells, layer } = buildAnchorRule({
      stack,
      ticks: [],
      stroke: 'black',
    })
    const cell = cells.get(layer.key)!
    expect(cell.kind === 'glyphs' && [...cell.data.lineYs]).toEqual([
      anchorRuleAboveY(stack.lanes[1]!),
      anchorRuleY(stack.lanes[3]!, stack.bandHeight),
    ])
    expect(layer.row).toBe(2)
  })
})
