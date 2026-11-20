import { CIGAR_EQ, CIGAR_X } from '@jbrowse/cigar-utils'
import { SimpleFeature } from '@jbrowse/core/util'

import { KIND_BASE_TILE } from '../LinearSyntenyRPC/syntenyKinds.ts'
import {
  copyLaneFiling,
  copyLaneName,
  fileUnderCopies,
  groupsOfField,
  laneGenome,
  laneKeyWith,
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

  // an old copy keeping few genes, and one stray paralog hit
  const genes = Array.from({ length: 20 }, (_, i) => `g${i}`)
  const sparse = groupFeatures([
    ...genes.map((name, i) => anchorsRow(name, i * 100, 'chr11')),
    ...genes.slice(0, 3).map((name, i) => anchorsRow(name, i * 100, 'chr9')),
    anchorsRow('g0', 0, 'chr2'),
  ])
  const lanesOf = (groups: ReturnType<typeof fileUnderCopies>) => [
    ...new Set(groups.flatMap(g => [...g.mates.keys()])),
  ]

  test('a contig under a tenth of its genome’s heaviest draws no lane', () => {
    expect(lanesOf(fileUnderCopies(sparse))).toEqual([
      '{grape}chr11',
      '{grape}chr9',
    ])
  })

  test('a contig the reader chose draws its lane however few its genes', () => {
    expect(
      lanesOf(
        fileUnderCopies(sparse, { chosen: lane => lane === '{grape}chr2' }),
      ),
    ).toEqual(['{grape}chr11', '{grape}chr9', '{grape}chr2'])
  })

  // wheat anchored at 1A: an all-against-all source pairs every 1A gene with
  // itself, and with its homoeologs on 1B and 1D
  const wheatRows = ['g1', 'g2', 'g3'].flatMap((name, i) =>
    ['1A', '1A', '1B', '1D'].map(
      (refName, j) =>
        new SimpleFeature({
          uniqueId: `${name}-${refName}-${j}`,
          refName: '1A',
          start: i * 200,
          end: i * 200 + 100,
          name,
          assemblyName: 'wheat',
          mate: {
            assemblyName: 'wheat',
            refName,
            start: i * 200 + j * 10_000,
            end: i * 200 + j * 10_000 + 100,
          },
        }),
    ),
  )
  const filing = copyLaneFiling([], ['{wheat}1A'], lane => lane)

  test('the anchor’s own genome draws a lane per other copy, never its own contig', () => {
    expect(lanesOf(fileUnderCopies(groupFeatures(wheatRows), filing))).toEqual([
      '{wheat}1B',
      '{wheat}1D',
    ])
  })

  test('the self-diagonal does not raise the floor its genome’s copies clear', () => {
    const lopsided = groupFeatures([
      ...wheatRows,
      ...Array.from(
        { length: 40 },
        (_, i) =>
          new SimpleFeature({
            uniqueId: `self${i}`,
            refName: '1A',
            start: i * 10,
            end: i * 10 + 5,
            name: `s${i}`,
            assemblyName: 'wheat',
            mate: { assemblyName: 'wheat', refName: '1A', start: 0, end: 5 },
          }),
      ),
    ])
    expect(lanesOf(fileUnderCopies(lopsided, filing))).toEqual([
      '{wheat}1B',
      '{wheat}1D',
    ])
  })
})

describe('groupsOfField', () => {
  test('files under genome lanes untouched, never asking how copies file', () => {
    const grouped = groupFeatures(triplicated)
    expect(
      groupsOfField('assembly', grouped, () => {
        throw new Error('genome lanes need no filing')
      }),
    ).toBe(grouped)
    expect(
      groupsOfField('refName', grouped, () => ({
        chosen: () => false,
        onAnchorContig: () => false,
      }))[0]!.mates.size,
    ).toBe(3)
  })
})

describe('a copy lane’s key', () => {
  test('canonicalizes its genome and its contig under that genome', () => {
    const keyOf = (lane: string) =>
      laneKeyWith(
        lane,
        name => (name === 'grape' ? 'GCF_030704535.1' : name),
        (genome, refName) =>
          genome === 'GCF_030704535.1' && refName === 'chr9'
            ? 'NC_081813.1'
            : refName,
      )
    expect(keyOf('{grape}chr9')).toBe(keyOf('{GCF_030704535.1}NC_081813.1'))
    expect(keyOf('grape')).toBe('GCF_030704535.1')
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

  test('a mismatch in the record joins its copy base above to its anchor base below', () => {
    const stack = stackOf(['{grape}chr9', 'peach', '{grape}chr11'])
    const { cells } = buildRibbonGeometry({
      stack,
      anchorOps: new Map([
        [
          'g1-chr9',
          Uint32Array.from(
            [
              [50, CIGAR_EQ],
              [1, CIGAR_X],
              [49, CIGAR_EQ],
            ].map(([len, op]) => (len! << 4) | op!),
          ),
        ],
      ]),
      laneLinks: undefined,
      ribbonColor: 'grey',
      drawCurves: false,
      rowsVsAnchor: true,
    })
    const cell = cells.get('ribbons:0')
    const data = cell?.kind === 'ribbons' ? cell.data : undefined
    const mark = [...(data?.kinds ?? [])].indexOf(KIND_BASE_TILE)
    // chr9:1150-1151 at 0.4 px/bp from 0, over chrG7:150-151 at 0.8 px/bp
    expect(
      data && [data.bp1[mark], data.bp2[mark], data.bp4[mark], data.bp3[mark]],
    ).toEqual([460, 460.4, 120, 120.8].map(Math.fround))
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
