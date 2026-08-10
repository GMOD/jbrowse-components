import {
  colorInterchrom,
  colorShortInsert,
  colorShortInsertArc,
} from '@jbrowse/core/ui/theme'
import { cssColorToNormalizedRgb } from '@jbrowse/core/util/colorBits'

import {
  arcColorPalette,
  arcMarkerColorPalette,
  linkedReadColorPalette,
} from '../../shaders/palettes.ts'
import {
  arcColorSlot,
  linkedReadColorSlot,
} from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import { ARC_COLOR_INTERCHROM } from '../../shaders/slang/arcLine.iface.generated.ts'
import { UNIFORM_SLOT_ARRAYS } from '../../shaders/slang/read.iface.generated.ts'
import { arcYFraction } from './arcYScale.ts'

// The JS palettes (Canvas2D / SVG) and the GPU uniform slots are two hand-kept
// copies of the same color table. If they drift — a color constant added to one
// side but not the other — the GPU copy loop silently uploads a short palette,
// mis-coloring instead of failing. Pin the lengths equal so that drift is a
// test failure, not a subtle visual bug.
describe('arc palette parity (JS ↔ GPU uniform slots)', () => {
  it('arcColorPalette length matches the GPU arcColor slot count', () => {
    expect(arcColorPalette.length).toBe(UNIFORM_SLOT_ARRAYS.arcColor.length)
  })
  it('linkedReadColorPalette length matches the GPU linkedReadColor slot count', () => {
    expect(linkedReadColorPalette.length).toBe(
      UNIFORM_SLOT_ARRAYS.linkedReadColor.length,
    )
  })
})

// arcLine.slang reads ARC_COLOR_INTERCHROM out of the palette directly now that
// a connector tick carries no per-instance color, and the Canvas2D tick loop
// indexes the same constant into `arcColorPalette`. Nothing else ties the
// shader's slot number to what sits at that position in the JS array, so pin it
// — a color inserted above index 3 would repaint every translocation tick.
describe('ARC_COLOR_INTERCHROM', () => {
  it('is the palette position holding the interchrom color', () => {
    expect(arcColorPalette[ARC_COLOR_INTERCHROM]).toEqual(
      cssColorToNormalizedRgb(colorInterchrom),
    )
  })
})

// The index rule the palettes are read with, generated from
// alignmentsUniforms.slang so Canvas2D, SVG and the GPU cannot pick different
// ones. Canvas2D used to spell it `colorIdx % palette.length`, which agrees with
// the shader's clamp on every slot anything currently emits (0-8) and disagrees
// above that — resolving to another real color rather than to a visibly wrong
// one. That is the class of drift the lift exists to end, so pin both ends.
describe('arcColorSlot', () => {
  it('is the identity over every slot the classifier can emit', () => {
    arcColorPalette.forEach((_, i) => {
      expect(arcColorSlot(i)).toBe(i)
    })
  })
  it('clamps past the last slot instead of wrapping to the first', () => {
    const last = arcColorPalette.length - 1
    expect(arcColorSlot(arcColorPalette.length)).toBe(last)
    expect(arcColorSlot(99)).toBe(last)
  })
})

// The linked-read connecting lines have their own palette, their own length and
// therefore their own slot rule. Same story as above: `computeOverlay.ts` spelled
// it `colorType % palette.length` while linkedReadLine.slang clamped.
describe('linkedReadColorSlot', () => {
  it('is the identity over every slot in the palette', () => {
    linkedReadColorPalette.forEach((_, i) => {
      expect(linkedReadColorSlot(i)).toBe(i)
    })
  })
  it('clamps past the last slot, and does not use the arc palette bound', () => {
    const last = linkedReadColorPalette.length - 1
    expect(linkedReadColorSlot(linkedReadColorPalette.length)).toBe(last)
    // The two palettes are different lengths (9 vs 8), so a shared rule taking
    // the wrong bound would show up right here.
    expect(linkedReadColorSlot(99)).not.toBe(arcColorSlot(99))
  })
})

// The read-cloud endpoint squares are opaque fills, so they use the pale
// pileup-fill short-insert (matching the legend + pileup) rather than the
// saturated stroke variant the arc curves use, otherwise the squares read a
// different pink from the legend swatch. This array is what all three draw
// paths use, the GPU included (it is uploaded to the arcMarkerColor uniform
// slots and indexed there), so pinning it here pins every renderer: the one
// substituted slot, and the rest identical to the arc palette.
describe('arcMarkerColorPalette (read-cloud endpoint squares)', () => {
  it('substitutes the pale short-insert fill at the short-insert slot', () => {
    expect(arcMarkerColorPalette[2]).toEqual(
      cssColorToNormalizedRgb(colorShortInsert),
    )
    expect(arcMarkerColorPalette[2]).not.toEqual(
      cssColorToNormalizedRgb(colorShortInsertArc),
    )
    expect(arcColorPalette[2]).toEqual(
      cssColorToNormalizedRgb(colorShortInsertArc),
    )
  })
  it('leaves every other slot identical to the stroke arc palette', () => {
    expect(arcMarkerColorPalette.length).toBe(arcColorPalette.length)
    arcColorPalette.forEach((c, i) => {
      if (i !== 2) {
        expect(arcMarkerColorPalette[i]).toBe(c)
      }
    })
  })
})

// arcYFraction is no longer a JS half of anything: it is generated from
// alignmentsUniforms.slang, which is where the GPU path reads it too (adr-051).
// These golden values predate that and are kept as the behavior pin — they now
// assert the shader's own formula, so an edit to it that changes a plotted
// height fails here rather than silently moving the ruler ticks off the arcs.
describe('arcYFraction', () => {
  describe('linear (arc mode)', () => {
    it('maps yBp as a plain fraction of the domain', () => {
      expect(arcYFraction(50, 200, false)).toBeCloseTo(0.25)
      expect(arcYFraction(200, 200, false)).toBeCloseTo(1)
    })
    it('returns 0 for a zero domain (no divide-by-zero)', () => {
      expect(arcYFraction(50, 0, false)).toBe(0)
    })
  })

  describe('log (read-cloud mode, base-2)', () => {
    it('spreads small inserts and normalizes the domain max to 1', () => {
      expect(arcYFraction(1, 1024, true)).toBeCloseTo(0) // log2(1)=0
      expect(arcYFraction(32, 1024, true)).toBeCloseTo(0.5) // log2(32)/log2(1024)=5/10
      expect(arcYFraction(1024, 1024, true)).toBeCloseTo(1)
    })
    it('clamps yBp below 1 to the baseline (log2 domain starts at 1)', () => {
      expect(arcYFraction(0, 1024, true)).toBeCloseTo(0)
    })
    it('clamps the domain below 2 so the denominator never collapses', () => {
      expect(arcYFraction(2, 1, true)).toBeCloseTo(1) // log2(2)/log2(2)
    })
  })
})
