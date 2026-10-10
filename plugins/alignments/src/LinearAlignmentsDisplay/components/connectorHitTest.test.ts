import { namesToBlock } from '@jbrowse/alignments-core'
import { SAM_FLAG_SUPPLEMENTARY } from '@jbrowse/cigar-utils'

import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { enumerateBezierPairs } from '../../features/linkedReads/computeOverlay.ts'
import { buildConnectorFeeds } from '../../features/linkedReads/connectorFeed.ts'
import { connectorParamsOf } from '../renderers/connectorMarks.ts'
import { makeTestPalette, makeTestRenderState } from '../testUtils.ts'
import {
  resolveConnectorHover,
  selectedConnectorHighlight,
} from './connectorHitTest.ts'
import { formatConnectorTooltip } from './tooltipUtils.ts'

import type { SectionRender } from '../renderers/rendererTypes.ts'

// Two split reads at 1 px/bp: `a` with two inverted hops over rows 0..2 of
// region 0 (chr1), and `b` with one same-strand hop along row 3 from region 0
// into region 1 (chr2 from bp 5000 at px 500), which draws straight.
function splitRead(
  name: string,
  ids: string[],
  starts: number[],
  ys: number[],
  strands: number[],
) {
  return makePileupDataResult({
    ...namesToBlock(ids.map(() => name)),
    readKeys: ids,
    readFlags: Uint16Array.from(ids, (_, i) =>
      i === 0 ? 0 : SAM_FLAG_SUPPLEMENTARY,
    ),
    readStrands: Int8Array.from(strands),
    readPositions: Uint32Array.from(starts.flatMap(s => [s, s + 50])),
    readYs: Uint16Array.from(ys),
    readClipAtStart: Uint32Array.from(ids, (_, i) => i * 100),
  })
}

const pairsA = enumerateBezierPairs(
  new Map([
    [
      0,
      splitRead(
        'a',
        ['a1', 'a2', 'a3'],
        [100, 300, 600],
        [0, 1, 2],
        [1, -1, 1],
      ),
    ],
  ]),
)
const pairsB = enumerateBezierPairs(
  new Map([
    [0, splitRead('b', ['b1'], [150], [3], [1])],
    [1, splitRead('b', ['b2'], [5300], [3], [1])],
  ]),
)

const feeds = buildConnectorFeeds({
  pairs: [...pairsA, ...pairsB],
  displayedRegions: [{ refName: 'chr1' }, { refName: 'chr2' }],
  featureHeight: 10,
  featureSpacing: 0,
  pileupHeight: 100,
  colors: makeTestPalette(),
})

const sec: SectionRender = {
  pileupTopOffset: 0,
  coverageTopOffset: 0,
  covClipTop: 0,
  covClipHeight: 0,
  pileupClipTop: 0,
  pileupClipHeight: 100,
  connectorClipTop: 0,
  connectorClipHeight: 150,
}

const base = makeTestRenderState({
  featureHeight: 10,
  featureSpacing: 0,
  canvasWidth: 1000,
  canvasHeight: 400,
  linkRegions: [
    { anchorPx: 0, anchorBp: 0, signedPxPerBp: 1 },
    { anchorPx: 500, anchorBp: 5000, signedPxPerBp: 1 },
  ],
})
const state = { ...base, connector: connectorParamsOf(base, sec) }

// The cubic's ends sit at row centres; a point on the curve's chord midway
// between two ends on the same row is on a straight connector.
test('the feed holds one connector per hop, by the region of its first end', () => {
  expect([...feeds.keys()]).toEqual([0])
  expect(
    feeds
      .get(0)!
      .hits.map(h => h.readName)
      .sort(),
  ).toEqual(['a', 'a', 'b'])
})

test('a hover on a connector names it and lights every hop of its read', () => {
  const hits = feeds.get(0)!.hits
  const i = hits.findIndex(h => h.readName === 'a')
  expect(i).toBeGreaterThanOrEqual(0)
  // probe along the first hop's chord near its first end
  const hover = Array.from({ length: 400 }, (_, k) => k)
    .map(k => resolveConnectorHover(150 + k, 5 + (k % 30), feeds, sec, state))
    .find(h => h?.hit.readName === 'a')
  expect(hover).toBeDefined()
  // two hops of `a`, each its own subpath
  expect(hover!.highlight.d.match(/M/g)!.length).toBeGreaterThanOrEqual(2)
  expect(hover!.highlight.clip).toEqual({
    x: 0,
    y: 0,
    width: 1000,
    height: 150,
  })
})

test('the click selects the read at the nearer end', () => {
  // `b` runs straight along row 3 (y 35) from its first segment's end, px
  // 200, to its second segment's start, px 800
  const nearFirst = resolveConnectorHover(250, 35, feeds, sec, state)
  const nearSecond = resolveConnectorHover(750, 35, feeds, sec, state)
  expect(nearFirst?.hit.readName).toBe('b')
  expect(nearFirst?.nearerId).toBe(nearFirst?.hit.id1)
  expect(nearSecond?.nearerId).toBe(nearSecond?.hit.id2)
})

test('a cursor outside the connector band answers nothing', () => {
  expect(resolveConnectorHover(250, 200, feeds, sec, state)).toBeUndefined()
})

test('the selection outlines the connectors that touch the selected reads', () => {
  const one = selectedConnectorHighlight(new Set(['b1']), feeds, sec, state)
  expect(one?.d.match(/M/g)).toHaveLength(1)
  expect(
    selectedConnectorHighlight(new Set(['nothing']), feeds, sec, state),
  ).toBeUndefined()
  expect(
    selectedConnectorHighlight(new Set(), feeds, sec, state),
  ).toBeUndefined()
})

test('the tooltip names the connection and both reads, and the loci a junction skipped', () => {
  const info = (id: string) => ({
    id,
    name: `read-${id}`,
    refName: 'chr1',
    start: 0,
    end: 10,
    strand: 1,
  })
  const hit = {
    label: 'Split alignment',
    id1: 'x1',
    id2: 'x2',
    hiddenSegmentsBetween: ['chr10:600,001-600,199'],
  }
  const tip = formatConnectorTooltip(hit, info)
  expect(tip).toContain('Split alignment: read-x1')
  expect(tip).toContain('→ read-x2')
  expect(tip).toContain('chr10:600,001-600,199')
  expect(
    formatConnectorTooltip(
      { ...hit, hiddenSegmentsBetween: undefined },
      () => undefined,
    ),
  ).toBe('Split alignment')
})
