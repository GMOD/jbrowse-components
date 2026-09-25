import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { resolvePalette } from '@jbrowse/core/ui/palette'

import {
  getCodonColors,
  getCodonLegendItems,
} from '../LinearMafRenderer/util.ts'
import {
  identityColorScale,
  identityRgb,
} from './components/drawRowIdentity.ts'
import {
  SOURCE_CHROM_PALETTE,
  sourceChromLegendItems,
} from './components/drawSourceChrom.ts'
import { createMafTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// The color key is the only decoder an exported figure ships with, so each of
// these is built by the module that paints the rendering, out of the colors it
// paints with. `colorScales` on the model is a dispatch over them. These pin the
// three ways the keys had drifted from the screen while they were written out in
// the model instead.
describe('each row rendering keys itself from what it paints', () => {
  describe('per-row identity', () => {
    // Each pixel is the mean identity of the bases under it, so every step of
    // the ramp is on screen; two end swatches left the grey middle unkeyed.
    it('keys the heatmap with the ramp it shades with, 0% to 100%', () => {
      const scale = identityColorScale('heatmap')
      expect(scale.kind).toBe('ramp')
      if (scale.kind === 'ramp') {
        expect(scale.stops.map(s => s.color)).toEqual(
          [0, 0.5, 1].map(identityRgb),
        )
        expect(scale.format!(0)).toBe('0%')
        expect(scale.format!(1)).toBe('100%')
      }
    })

    // The X-Y plot paints every bar the conserved end of that ramp and puts the
    // identity in the bar's HEIGHT. Handed the heatmap's key it advertised a
    // "Divergent" red against a plot that never draws one.
    it('keys the X-Y plot with the one color it paints, not the ramp', () => {
      const scale = identityColorScale('xyplot')
      expect(scale.kind).toBe('categorical')
      if (scale.kind === 'categorical') {
        expect(scale.entries).toHaveLength(1)
        expect(scale.entries[0]!.color).toBe(identityRgb(1))
        expect(scale.entries[0]!.label).toMatch(/height/i)
      }
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

// maf was the last row display with no `showLegend` at all: the key drew
// whatever the reader thought of it, and `FloatingLegend`'s close button had
// nothing to write.
describe('the color key is dismissible, like every other row display', () => {
  function rows(items: MenuItem[]): string[] {
    return items.flatMap(i => [
      ...('label' in i && typeof i.label === 'string' ? [i.label] : []),
      ...('subMenu' in i ? rows(resolveSubMenu(i)) : []),
    ])
  }

  function heatmapDisplay() {
    const { display, view } = createMafTestEnvironment().createDisplay()
    display.setRowRendering('identity')
    // the identity plots swap themselves out for the bases at base level
    view.zoomTo(100)
    view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
    return display
  }

  it('offers the shared row where a key exists', () => {
    const display = heatmapDisplay()
    expect(rows(display.trackMenuItems())).toContain('Show legend')
    expect(display.showLegend).toBe(true)
    display.setShowLegend(false)
    expect(display.showLegend).toBe(false)
  })

  it('offers nothing in bases mode, which has no key to show', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    expect(display.colorScales).toEqual([])
    expect(rows(display.trackMenuItems())).not.toContain('Show legend')
  })

  it('the heatmap key is one scale named for the rendering', () => {
    const display = heatmapDisplay()
    expect(display.colorScales).toMatchObject([
      { kind: 'ramp', id: 'heatmap', title: 'Per-base identity to reference' },
    ])
  })
})
