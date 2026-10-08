import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'
import { cleanup, render } from '@testing-library/react'

import { buildSashimiBandFeeds } from '../../features/sashimi/bandFeed.ts'
import { SASHIMI_APEX_CLEARANCE_PX } from '../../features/sashimi/computeOverlay.ts'
import { junctionKey } from '../../features/sashimi/junctions.ts'
import { drawAlignmentsToCtx } from '../renderers/Canvas2DAlignmentsRenderer.ts'
import { sashimiBandsOf } from '../renderers/sashimiMarks.ts'
import { makeTestPalette, makeTestRenderState } from '../testUtils.ts'
import SashimiLabelsSvg from './SashimiLabelsSvg.tsx'
import {
  sashimiArcKey,
  sashimiFeatureId,
  sashimiSideBand,
} from './sashimiArcs.ts'
import {
  resolveSashimiHover,
  selectedSashimiHighlight,
} from './sashimiHitTest.ts'

import type { MergedJunction } from '../../features/sashimi/junctions.ts'
import type { LinearAlignmentsDisplayModel } from '../model.ts'
import type { SashimiLabelSection } from './sashimiArcs.ts'

afterEach(cleanup)

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

const DISPLAYED = [
  { refName: 'chr1', start: 0, end: 1000, displayedRegionIndex: 0 },
]

// One region drawn 1px per bp, a 100px coverage band over a 40px strip.
function scene(junctions: MergedJunction[], down: MergedJunction[] = []) {
  const feeds = buildSashimiBandFeeds({
    junctions: [...junctions, ...down],
    downJunctionKeys: new Set(down.map(j => j.key)),
    displayed: DISPLAYED,
    colors: makeTestPalette(),
  })
  const base = makeTestRenderState({
    canvasWidth: 1000,
    canvasHeight: 300,
    coverageHeight: 100,
    sashimiArcsHeight: 40,
    linkRegions: [{ anchorPx: 0, anchorBp: 0, signedPxPerBp: 1 }],
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
  const blocks = [
    {
      displayedRegionIndex: 0,
      start: 0,
      end: 1000,
      screenStartPx: 0,
      screenEndPx: 1000,
      reversed: false,
    },
  ]
  return { feeds, state, blocks }
}

// The zero line an up arc stands on, and the 90px it may rise.
const UP_BASELINE = 100 - YSCALEBAR_LABEL_OFFSET
const UP_HEIGHT = 100 - 2 * YSCALEBAR_LABEL_OFFSET

describe('sashimiBandsOf', () => {
  it('stands the up arcs on the histogram zero line, clipped to coverage', () => {
    const { state } = scene([junction(100, 300)])
    expect(state.sashimi.up).toEqual({
      top: YSCALEBAR_LABEL_OFFSET,
      height: UP_HEIGHT,
      clipTop: 0,
      clipHeight: 100,
    })
  })

  it('hangs the down arcs in the reserved strip, short of its bottom', () => {
    const { state } = scene([junction(100, 300)])
    expect(state.sashimi.down).toEqual({
      top: 100,
      height: 40 - SASHIMI_APEX_CLEARANCE_PX,
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
    const { feeds, state, blocks } = scene([junction(100, 300)])
    const hit = (x: number, y: number) =>
      resolveSashimiHover(x, y, feeds, state, blocks)?.junction
    const short = hit(200, UP_BASELINE - sashimiApex(200))
    expect(short).toMatchObject({ start: 100, end: 300 })
    // the chord under the apex is inside the arc, not on it
    expect(hit(200, UP_BASELINE - 2)).toBeUndefined()
  })

  it('gives an overlapping pair to the heavier junction', () => {
    const { feeds, state, blocks } = scene([
      junction(100, 300, 2),
      junction(100, 300.5, 200),
    ])
    const y = UP_BASELINE - sashimiApex(200)
    expect(
      resolveSashimiHover(200, y, feeds, state, blocks)?.junction.count,
    ).toBe(200)
  })

  it('answers a down arc in its strip and not over the pileup below', () => {
    const down = junction(100, 300)
    const { feeds, state, blocks } = scene([], [down])
    const apex =
      (sashimiApex(200) / UP_HEIGHT) * (40 - SASHIMI_APEX_CLEARANCE_PX)
    expect(
      resolveSashimiHover(200, 100 + apex, feeds, state, blocks)?.junction,
    ).toBe(down)
    expect(resolveSashimiHover(200, 141, feeds, state, blocks)).toBeUndefined()
  })

  it('traces the highlight along the arc it found', () => {
    const { feeds, state, blocks } = scene([junction(100, 300)])
    const hover = resolveSashimiHover(
      200,
      UP_BASELINE - sashimiApex(200),
      feeds,
      state,
      blocks,
    )!
    expect(hover.highlight.d).toMatch(/^M ?100[ ,]/)
    expect(hover.highlight.clip).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 100,
    })
  })
})

// The up apex of a junction `spanBp` wide: its fraction of the 90px band.
function sashimiApex(spanBp: number) {
  const norm =
    (Math.log(spanBp) - Math.log(50)) / (Math.log(100_000) - Math.log(50))
  return (0.3 + 0.65 * norm) * UP_HEIGHT
}

describe('selectedSashimiHighlight', () => {
  it('outlines the selected junction in its own group alone', () => {
    const j = junction(100, 300)
    const { feeds, state } = scene([j])
    expect(
      selectedSashimiHighlight(
        sashimiFeatureId('sampleA', j),
        'sampleA',
        feeds,
        state,
      ),
    ).toBeDefined()
    expect(
      selectedSashimiHighlight(
        sashimiFeatureId('sampleB', j),
        'sampleA',
        feeds,
        state,
      ),
    ).toBeUndefined()
  })
})

describe('the painter', () => {
  // The export and the Canvas2D fallback paint through this one call, so a
  // junction that strokes here is in both.
  it('strokes each junction inside its band clip', () => {
    const { feeds, state } = scene([junction(100, 300)], [junction(400, 600)])
    const calls: string[] = []
    const ctx = new Proxy(
      {},
      {
        get: (_t, prop) =>
          typeof prop === 'string'
            ? (...args: unknown[]) => {
                calls.push(`${prop}(${args.length})`)
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
    expect(calls.filter(c => c.startsWith('stroke('))).toHaveLength(2)
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

describe('the count labels', () => {
  const section: SashimiLabelSection = {
    groupKey: 'sampleA',
    up: [{ key: 'a', x: 150, y: 10, count: 42 }],
    down: [],
    coverageOverlayTop: 200,
    sashimiBandTop: 290,
  }
  const heights = { coverageHeight: 100, sashimiArcsHeight: 40 }

  it('places each side at the box its arcs stand in', () => {
    expect(sashimiSideBand(section, 'up', heights)).toEqual({
      top: 200,
      height: 100 - YSCALEBAR_LABEL_OFFSET,
    })
    expect(sashimiSideBand(section, 'down', heights)).toEqual({
      top: 290,
      height: 40,
    })
    expect(
      sashimiSideBand(section, 'up', { ...heights, coverageHeight: 3 }).height,
    ).toBe(0)
  })

  it('exports the counts at their band, and no arc paths', () => {
    const model = {
      scrollModel: { isGrouped: false, scrollTop: 0, canvasHeight: 500 },
      sashimiLabelSections: [section],
      bandHeights: heights,
    } as unknown as LinearAlignmentsDisplayModel
    const { container } = render(
      <svg>
        <SashimiLabelsSvg model={model} />
      </svg>,
    )
    expect(container.querySelector('text')!.textContent).toBe('42')
    expect(container.querySelector('g')!.getAttribute('transform')).toBe(
      'translate(0,200)',
    )
    expect(container.querySelector('path')).toBeNull()
  })
})
