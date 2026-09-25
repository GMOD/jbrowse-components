import {
  colorPairLR,
  colorPairLRDark,
  resolvePalette,
} from '@jbrowse/core/ui/palette'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'
import { cleanup, fireEvent, render } from '@testing-library/react'

import SashimiArcsOverlay from './SashimiArcsOverlay.tsx'
import SashimiArcsSvg from './SashimiArcsSvg.tsx'
import { openSashimiWidget } from './detailWidgets.ts'
import {
  sashimiArcKey,
  sashimiFeatureId,
  sashimiSideBand,
} from './sashimiArcs.ts'

import type { SashimiArc } from '../../features/sashimi/computeOverlay.ts'
import type { LinearAlignmentsDisplayModel } from '../model.ts'
import type { SashimiArcSection } from './sashimiArcs.ts'

// The widget open is a session write with a whole config layer behind it.
jest.mock('./detailWidgets.ts', () => ({
  openSashimiWidget: jest.fn(),
}))

afterEach(cleanup)

function makeArc(arc: Partial<SashimiArc>): SashimiArc {
  return {
    refName: 'chr1',
    start: 1000,
    end: 2000,
    strand: 1,
    score: 5,
    motif: 0,
    d: 'M...',
    strokeWidth: 2,
    labelX: 1500,
    labelY: 10,
    showLabel: true,
    ...arc,
  }
}

describe('sashimiArcKey', () => {
  it('keys by junction identity, not array index', () => {
    const key = sashimiArcKey(makeArc({ start: 1000, end: 2000 }))
    expect(key).toBe('chr1:1000:2000')
  })

  it('distinguishes same coordinates in different regions', () => {
    const a = sashimiArcKey(makeArc({ refName: 'chr1' }))
    const b = sashimiArcKey(makeArc({ refName: 'chr2' }))
    expect(a).not.toBe(b)
  })

  it('holds still when a later region changes the junction strand', () => {
    expect(sashimiFeatureId('g', makeArc({ strand: 1 }))).toBe(
      sashimiFeatureId('g', makeArc({ strand: -1 })),
    )
  })
})

describe('sashimiSideBand', () => {
  const section: SashimiArcSection = {
    groupKey: 'sampleA',
    up: [],
    down: [],
    coverageOverlayTop: 200,
    sashimiBandTop: 290,
  }
  const heights = { coverageHeight: 100, sashimiArcsHeight: 40 }

  it('hangs the up band off the coverage histogram, unclipped', () => {
    // The box starts at the histogram top (one y-scalebar offset into the
    // coverage band) and runs to the band's bottom, so a full-height arc has
    // room; unclipped, so it can rise into the top margin.
    expect(sashimiSideBand(section, 'up', heights)).toEqual({
      top: 200,
      height: 100 - YSCALEBAR_LABEL_OFFSET,
      clipped: false,
    })
  })

  it('clips the down band to the strip the layout reserved', () => {
    // Clipping is the load-bearing half: the strip is only as tall as
    // `sashimiArcsHeight`, and the pileup starts immediately below it.
    expect(sashimiSideBand(section, 'down', heights)).toEqual({
      top: 290,
      height: 40,
      clipped: true,
    })
  })

  it('floors the up band at 0 rather than emitting a negative height', () => {
    // `coverageHeight` is a plain number slot and `clampBandHeight`'s 20px floor
    // constrains DRAGGING, not what a config or a session snapshot declares — so
    // a height under one y-scalebar offset reaches here, and unfloored it lands
    // on an `<svg height>` and an `<SvgClipRect>` as a negative number. Same
    // floor `projectSashimiArcs` puts on the height it draws INTO, which had it
    // and this did not.
    expect(
      sashimiSideBand(section, 'up', { ...heights, coverageHeight: 3 }).height,
    ).toBe(0)
  })
})

describe('sashimiFeatureId', () => {
  it('scopes the same junction by group so selection does not bleed across groups', () => {
    const arc = makeArc({})
    expect(sashimiFeatureId('sampleA', arc)).not.toBe(
      sashimiFeatureId('sampleB', arc),
    )
  })
})

describe('sashimi selection', () => {
  const ARC = makeArc({ d: 'M 0 0 L 10 10', strokeWidth: 2 })
  const SELECTED = sashimiFeatureId('sampleA', ARC)

  function stubModel(selectedFeatureId: string | undefined) {
    return {
      id: 'sashimi-selection',
      view: { width: 800 },
      scrollModel: { isGrouped: false, scrollTop: 0, canvasHeight: 500 },
      sashimiArcSections: [
        {
          groupKey: 'sampleA',
          up: [ARC],
          down: [],
          coverageOverlayTop: 0,
          sashimiBandTop: 100,
        },
      ],
      showSashimiLabels: false,
      bandHeights: { coverageHeight: 100, sashimiArcsHeight: 40 },
      selectedFeatureId,
      setHoverState: jest.fn(),
      clearMouseoverState: jest.fn(),
      clearHoverUnlessPinned: jest.fn(),
    } as unknown as LinearAlignmentsDisplayModel
  }

  // The outline is painted UNDER the arc, so it is the first path and the wider.
  function strokeWidths(container: Element) {
    return [...container.querySelectorAll('path')].map(p =>
      p.getAttribute('stroke-width'),
    )
  }

  it('draws no outline in the export with nothing selected', () => {
    const { container } = render(
      <svg>
        <SashimiArcsSvg
          model={stubModel(undefined)}
          width={800}
          palette={resolvePalette()}
        />
      </svg>,
    )
    expect(strokeWidths(container)).toEqual(['2'])
  })

  // a junction left selected from the detail widget would otherwise mark every
  // figure exported afterwards; no display's selection is exported
  it('leaves the selected junction outline out of the export', () => {
    const { container } = render(
      <svg>
        <SashimiArcsSvg
          model={stubModel(SELECTED)}
          width={800}
          palette={resolvePalette()}
        />
      </svg>,
    )
    expect(strokeWidths(container)).toEqual(['2'])
  })

  it('opens the widget for the clicked junction in its group', () => {
    const model = stubModel(undefined)
    const { container } = render(<SashimiArcsOverlay model={model} />)
    fireEvent.click(container.querySelector('path')!)
    expect(openSashimiWidget).toHaveBeenCalledWith(model, ARC, 'sampleA')
  })

  it('outlines the junction the session has selected', () => {
    const { container } = render(
      <SashimiArcsOverlay model={stubModel(SELECTED)} />,
    )
    expect(strokeWidths(container)).toEqual(['6', '2'])
  })

  it('names the hovered junction so its supporting reads light', () => {
    const model = stubModel(undefined)
    const { container } = render(<SashimiArcsOverlay model={model} />)
    fireEvent.mouseEnter(container.querySelector('path')!)
    expect(model.setHoverState).toHaveBeenCalledWith(
      expect.objectContaining({
        hoveredJunction: {
          groupKey: 'sampleA',
          refName: 'chr1',
          start: 1000,
          end: 2000,
        },
      }),
    )
  })

  it('drops the hover when a press starts a pan over the arc', () => {
    const model = stubModel(undefined)
    const { container } = render(<SashimiArcsOverlay model={model} />)
    const path = container.querySelector('path')!
    fireEvent.mouseEnter(path)
    fireEvent.mouseDown(path)
    expect(model.clearHoverUnlessPinned).toHaveBeenCalled()
    expect(strokeWidths(container)).toEqual(['2'])
  })

  it('strokes an unstranded junction in the export theme grey', () => {
    const unstranded = makeArc({ strand: 0 })
    const model = {
      ...stubModel(undefined),
      sashimiArcSections: [
        {
          groupKey: 'sampleA',
          up: [unstranded],
          down: [],
          coverageOverlayTop: 0,
          sashimiBandTop: 100,
        },
      ],
    } as unknown as LinearAlignmentsDisplayModel
    const stroke = (themeName: string) => {
      const { container } = render(
        <svg>
          <SashimiArcsSvg
            model={model}
            width={800}
            palette={resolvePalette({ themeName })}
          />
        </svg>,
      )
      const value = container.querySelector('path')!.getAttribute('stroke')
      cleanup()
      return value
    }
    expect(stroke('default')).toBe(colorPairLR)
    expect(stroke('darkMinimal')).toBe(colorPairLRDark)
  })
})
