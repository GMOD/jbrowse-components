import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'

import { buildSashimiBandFeeds } from '../../features/sashimi/bandFeed.ts'
import { SASHIMI_APEX_CLEARANCE_PX } from '../../features/sashimi/computeOverlay.ts'
import { junctionKey } from '../../features/sashimi/junctions.ts'
import { drawAlignmentsToCtx } from '../renderers/Canvas2DAlignmentsRenderer.ts'
import { sashimiBandsOf, sashimiLabels } from '../renderers/sashimiMarks.ts'
import { makeTestPalette, makeTestRenderState } from '../testUtils.ts'
import { sashimiArcKey, sashimiFeatureId } from './sashimiArcs.ts'
import {
  resolveSashimiHover,
  selectedSashimiHighlight,
} from './sashimiHitTest.ts'

import type { MergedJunction } from '../../features/sashimi/junctions.ts'
import type { LinkRegion } from '@jbrowse/render-core/marks'

function junction(start: number, end: number, count = 5): MergedJunction {
  return {
    key: junctionKey('chr1', start, end),
    refName: 'chr1',
    start,
    end,
    count,
    strand: 1,
    motif: 0,
  }
}

interface Layout {
  displayed: { start: number; end: number }[]
  linkRegions: LinkRegion[]
}

// One region drawn 1px per bp from x 0.
const FORWARD: Layout = {
  displayed: [{ start: 0, end: 100_000 }],
  linkRegions: [{ anchorPx: 0, anchorBp: 0, signedPxPerBp: 1 }],
}

// A 100px coverage band over a 40px strip, on a 1000px canvas.
function scene(
  junctions: MergedJunction[],
  down: MergedJunction[] = [],
  layout = FORWARD,
) {
  const feeds = buildSashimiBandFeeds({
    junctions: [...junctions, ...down],
    downJunctionKeys: new Set(down.map(j => j.key)),
    displayed: layout.displayed.map((r, displayedRegionIndex) => ({
      refName: 'chr1',
      ...r,
      displayedRegionIndex,
    })),
    colors: makeTestPalette(),
  })
  const base = makeTestRenderState({
    canvasWidth: 1000,
    canvasHeight: 300,
    coverageHeight: 100,
    sashimiArcsHeight: 40,
    linkRegions: layout.linkRegions,
    sections: [
      {
        pileupTopOffset: 140,
        coverageTopOffset: 0,
        covClipTop: 0,
        covClipHeight: 100,
        pileupClipTop: 140,
        pileupClipHeight: 160,
        sashimiBandTop: 100,
      },
    ],
  })
  const state = { ...base, sashimi: sashimiBandsOf(base, base.sections[0]!) }
  const hit = (x: number, y: number) =>
    resolveSashimiHover(x, y, feeds, state)?.junction
  return { feeds, state, hit }
}

// The zero line an up arc stands on, and the 90px it may rise.
const UP_BASELINE = 100 - YSCALEBAR_LABEL_OFFSET
const UP_HEIGHT = 100 - 2 * YSCALEBAR_LABEL_OFFSET
const DOWN_HEIGHT = 40 - SASHIMI_APEX_CLEARANCE_PX

// A junction's apex as a fraction of its band, restated from the feed's rule
// so a change to either shows up here.
function apexFraction(spanBp: number) {
  const norm =
    (Math.log(spanBp) - Math.log(50)) / (Math.log(100_000) - Math.log(50))
  return 0.3 + 0.65 * norm
}
const upApexY = (spanBp: number) =>
  UP_BASELINE - apexFraction(spanBp) * UP_HEIGHT

describe('sashimiBandsOf', () => {
  it('stands the up arcs on the histogram zero line, clipped to coverage', () => {
    expect(scene([junction(100, 300)]).state.sashimi.up).toEqual({
      top: YSCALEBAR_LABEL_OFFSET,
      height: UP_HEIGHT,
      clipTop: 0,
      clipHeight: 100,
    })
  })

  it('hangs the down arcs in the reserved strip, short of its bottom', () => {
    expect(scene([junction(100, 300)]).state.sashimi.down).toEqual({
      top: 100,
      height: DOWN_HEIGHT,
      clipTop: 100,
      clipHeight: 40,
    })
  })

  // A config may declare either height under its margins; the band then has no
  // room and draws nothing, where a negative one flipped every arc through the
  // neighbouring band.
  it('draws no side whose band has no height', () => {
    const base = makeTestRenderState({
      coverageHeight: 4,
      sashimiArcsHeight: 3,
    })
    expect(
      sashimiBandsOf(base, { ...base.sections[0]!, sashimiBandTop: 10 }),
    ).toEqual({ up: undefined, down: undefined })
  })

  it('draws no down side in a section that reserved no strip', () => {
    const base = makeTestRenderState({ sashimiArcsHeight: 40 })
    expect(sashimiBandsOf(base, base.sections[0]!).down).toBeUndefined()
  })
})

describe('resolveSashimiHover', () => {
  it('answers on the apex of an up arc and nowhere under it', () => {
    const { hit } = scene([junction(100, 300)])
    expect(hit(200, upApexY(200))).toMatchObject({ start: 100, end: 300 })
    // the chord under the apex is inside the arc, not on it
    expect(hit(200, UP_BASELINE - 2)).toBeUndefined()
  })

  it('gives an overlapping pair to the heavier junction', () => {
    const { hit } = scene([junction(100, 300, 2), junction(100, 301, 200)])
    expect(hit(200, upApexY(200))!.count).toBe(200)
  })

  it('answers a down arc in its strip and not over the pileup below', () => {
    const down = junction(100, 300)
    const { hit } = scene([], [down])
    expect(hit(200, 100 + apexFraction(200) * DOWN_HEIGHT)).toBe(down)
    expect(hit(200, 141)).toBeUndefined()
  })

  it('finds an arc where a reversed region paints it', () => {
    // bp 0 sits at x 1000 and counts down, so 100..300 paints at 700..900
    const { hit } = scene([junction(100, 300)], [], {
      displayed: [{ start: 0, end: 1000 }],
      linkRegions: [{ anchorPx: 0, anchorBp: 1000, signedPxPerBp: -1 }],
    })
    expect(hit(800, upApexY(200))).toMatchObject({ start: 100, end: 300 })
    expect(hit(200, upApexY(200))).toBeUndefined()
  })

  it('finds an arc whose feet lie in two displayed regions', () => {
    // two exons abutting on screen with the intron collapsed away: 300 is at
    // x 300 and 1100 at x 500
    const { feeds, hit } = scene([junction(300, 1100)], [], {
      displayed: [
        { start: 0, end: 400 },
        { start: 1000, end: 1400 },
      ],
      linkRegions: [
        { anchorPx: 0, anchorBp: 0, signedPxPerBp: 1 },
        { anchorPx: 400, anchorBp: 1000, signedPxPerBp: 1 },
      ],
    })
    expect([...feeds.keys()]).toEqual([0])
    expect(feeds.get(0)!.up.x2Region[0]).toBe(1)
    // the apex rides the genomic span, 800bp, over the 200px the feet are apart
    expect(hit(400, upApexY(800))).toMatchObject({ start: 300, end: 1100 })
  })

  it('traces the highlight along the arc it found', () => {
    const { feeds, state } = scene([junction(100, 300)])
    const hover = resolveSashimiHover(200, upApexY(200), feeds, state)!
    expect(hover.highlight.d).toMatch(/^M ?100[ ,]/)
    expect(hover.highlight.clip).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 100,
    })
  })
})

describe('sashimiLabels', () => {
  const labelsOf = (...args: Parameters<typeof scene>) => {
    const { feeds, state } = scene(...args)
    return sashimiLabels(state, [feeds])
  }

  it('puts each count at the apex its arc draws', () => {
    const [up] = labelsOf([junction(100, 300, 42)])
    expect(up).toMatchObject({ x: 200, count: 42 })
    expect(up!.y).toBeCloseTo(upApexY(200))
    const [down] = labelsOf([], [junction(100, 300, 7)])
    expect(down!.y).toBeCloseTo(100 + apexFraction(200) * DOWN_HEIGHT)
  })

  it('labels no arc too narrow on screen for its count', () => {
    expect(labelsOf([junction(100, 105)])).toHaveLength(0)
    // 30px holds one digit and not five
    expect(labelsOf([junction(100, 130, 5)])).toHaveLength(1)
    expect(labelsOf([junction(100, 130, 12_345)])).toHaveLength(0)
  })

  it('labels no arc whose apex is off the canvas', () => {
    expect(labelsOf([junction(1200, 1400)])).toHaveLength(0)
  })

  // The mark clips such a dome to the legs at its feet, so a count at the
  // dome's apex would stand over nothing.
  it('labels no arc spanning more than three canvas widths', () => {
    // scrolled 4000px in, so both arcs are centred on x 500 with their feet
    // off either side of the canvas
    const scrolled = {
      displayed: FORWARD.displayed,
      linkRegions: [{ anchorPx: -4000, anchorBp: 0, signedPxPerBp: 1 }],
    }
    expect(labelsOf([junction(3600, 5400)], [], scrolled)).toHaveLength(1)
    expect(labelsOf([junction(100, 8900)], [], scrolled)).toHaveLength(0)
  })

  it('labels nothing in a band with no height', () => {
    const { feeds, state } = scene([junction(100, 300)])
    expect(sashimiLabels({ ...state, coverageHeight: 4 }, [feeds])).toEqual([])
  })
})

describe('selectedSashimiHighlight', () => {
  const first = junction(100, 300)
  const second = junction(400, 600)
  const { feeds, state } = scene([first, second])
  const outline = (groupKey: string, j: MergedJunction) =>
    selectedSashimiHighlight(
      sashimiFeatureId(groupKey, j),
      'sampleA',
      feeds,
      state,
    )

  it('outlines the junction the id names, not its neighbour', () => {
    expect(outline('sampleA', first)!.d).toMatch(/^M ?100[ ,]/)
    expect(outline('sampleA', second)!.d).toMatch(/^M ?400[ ,]/)
  })

  it('outlines nothing for a selection in another group', () => {
    expect(outline('sampleB', first)).toBeUndefined()
  })
})

describe('the painter', () => {
  // The export and the Canvas2D fallback paint through this one call, so a
  // junction that strokes here is in both.
  it('strokes each side inside its own band clip', () => {
    const { feeds, state } = scene([junction(100, 300)], [junction(400, 600)])
    const calls: string[] = []
    const ctx = new Proxy(
      {},
      {
        get: (_t, prop) =>
          typeof prop === 'string'
            ? (...args: unknown[]) => {
                calls.push(`${prop}(${args.join(',')})`)
              }
            : undefined,
        set: () => true,
      },
    ) as unknown as CanvasRenderingContext2D
    drawAlignmentsToCtx(
      ctx,
      {
        sections: [
          {
            groupKey: '',
            laidOutPileupMap: new Map(),
            arcFeeds: new Map(),
            sashimiFeeds: feeds,
          },
        ],
        densityRegions: new Map(),
      },
      [],
      state,
    )
    const marks = calls.filter(c => /^(rect|stroke)\(/.test(c))
    expect(marks).toEqual([
      'rect(0,0,1000,100)',
      'stroke()',
      'rect(0,100,1000,40)',
      'stroke()',
    ])
  })
})

describe('sashimiArcKey', () => {
  it('names a junction by where it is', () => {
    expect(sashimiArcKey(junction(1000, 2000))).toBe('chr1:1000:2000')
  })

  it('scopes a selection to its group', () => {
    const j = junction(1, 2)
    expect(sashimiFeatureId('sampleA', j)).not.toBe(
      sashimiFeatureId('sampleB', j),
    )
  })
})
