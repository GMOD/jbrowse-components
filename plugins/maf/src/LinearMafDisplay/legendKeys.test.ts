import { resolvePalette } from '@jbrowse/core/ui/palette'

import {
  getCodonColors,
  getCodonLegendItems,
} from '../LinearMafRenderer/util.ts'
import { identityLegendItems } from './components/drawRowIdentity.ts'
import {
  SOURCE_CHROM_PALETTE,
  sourceChromLegendItems,
} from './components/drawSourceChrom.ts'

import type { LegendItem } from '@jbrowse/core/ui'

// The color key is the only decoder an exported figure ships with, so each of
// these is built by the module that paints the rendering, out of the colors it
// paints with. `legendItems` on the model is a dispatch over them. These pin the
// three ways the keys had drifted from the screen while they were written out in
// the model instead.
describe('each row rendering keys itself from what it paints', () => {
  const colored = (items: LegendItem[]) => items.filter(i => i.color)

  describe('per-row identity', () => {
    // The heatmap reads off the ramp, so its key shows both ends of it.
    it('keys the heatmap with the two ends of the ramp it shades with', () => {
      const items = identityLegendItems('heatmap')
      const swatches = colored(items)
      expect(swatches).toHaveLength(2)
      expect(swatches[0]!.color).not.toBe(swatches[1]!.color)
      // the color-less row names the metric the ramp measures
      expect(items).toHaveLength(3)
    })

    // The X-Y plot paints every bar the conserved end of that ramp and puts the
    // identity in the bar's HEIGHT. Handed the heatmap's key it advertised a
    // "Divergent" red against a plot that never draws one.
    it('keys the X-Y plot with the one color it paints, not the ramp', () => {
      const swatches = colored(identityLegendItems('xyplot'))
      expect(swatches).toHaveLength(1)
      // and that one color is the conserved end, which is what it fills with
      expect(swatches[0]!.color).toBe(
        colored(identityLegendItems('heatmap'))[0]!.color,
      )
      expect(swatches[0]!.label).toMatch(/height/i)
    })
  })

  describe('source chromosome', () => {
    it('shows one row per rank while the palette still changes', () => {
      expect(sourceChromLegendItems(0)).toHaveLength(1)
      expect(sourceChromLegendItems(1)).toHaveLength(2)
    })

    // Both the color and the label saturate at the palette's last slot, so a
    // row drawing from more source chromosomes than the palette has — a
    // scaffold-level assembly in a many-way alignment reaches dozens — used to
    // repeat an identical "Other source" row per extra rank, growing the key
    // over the rows it sits on.
    it('stops at the palette instead of repeating its last entry', () => {
      const items = sourceChromLegendItems(40)
      expect(items).toHaveLength(SOURCE_CHROM_PALETTE.length)
      expect(new Set(items.map(i => i.label)).size).toBe(items.length)
      expect(new Set(items.map(i => i.color)).size).toBe(items.length)
    })
  })

  describe('codon view', () => {
    // The cells are painted with alpha-composited fills; the key named the raw
    // theme colors, so the faint synonymous fill showed as a saturated blue no
    // cell on screen is.
    it('keys with the composited fills, not the raw theme colors', () => {
      const palette = resolvePalette()
      const { fill } = getCodonColors(palette)
      const items = getCodonLegendItems(palette)
      expect(items.map(i => i.color)).toEqual([
        fill.nonsyn,
        fill.syn,
        fill.stop,
      ])
      // the distinction that matters: these are not the undimmed theme colors
      expect(items[1]!.color).not.toBe(palette.codonSynonymous)
    })

    // A conserved codon takes no fill at all, so it has no swatch to show.
    it('omits the unchanged category, which paints nothing', () => {
      const palette = resolvePalette()
      expect(getCodonColors(palette).fill.same).toBeUndefined()
      expect(getCodonLegendItems(palette)).toHaveLength(3)
    })
  })
})
