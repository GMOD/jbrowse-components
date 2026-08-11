import { resolvePalette } from '@jbrowse/core/ui/palette'

import {
  frameColorIndex,
  getFrameColors,
  getFrameLegendItems,
} from '../LinearMafRenderer/util.ts'
import { createMafTestEnvironment } from './testEnv.ts'

import type { LinearMafDisplayModel } from './stateModel.ts'

const palette = resolvePalette()

// The CDS strip's colors used to be resolved by three pieces of arithmetic in
// three files — `(frame % 3) + 1` negated on `−`, `Array.at`'s negative wrap,
// and a palette whose second half is written in reverse so the wrap lands on
// the matching hue. All three had to be right for a strip to be the color
// anything else claims, and none was checkable without the other two.
describe('frameColorIndex is the one place the palette layout is known', () => {
  it('gives a plain, in-range slot for every frame and strand', () => {
    const colors = getFrameColors(palette)
    for (const strand of [1, -1]) {
      for (const frame of [0, 1, 2]) {
        const i = frameColorIndex(frame, strand)
        expect(i).toBeGreaterThanOrEqual(1)
        expect(i).toBeLessThan(colors.length)
        expect(colors[i]).toBeTruthy()
      }
    }
  })

  // The mirroring is the point of the layout: one reading frame is one color
  // whichever strand the gene is on.
  it('maps both strands of a frame onto the same color', () => {
    const colors = getFrameColors(palette)
    for (const frame of [0, 1, 2]) {
      expect(colors[frameColorIndex(frame, -1)]).toBe(
        colors[frameColorIndex(frame, 1)],
      )
    }
  })

  it('gives the three frames three different colors', () => {
    const colors = getFrameColors(palette)
    const distinct = new Set([0, 1, 2].map(f => colors[frameColorIndex(f, 1)]))
    expect(distinct.size).toBe(3)
  })

  // Slot 0 is unused, and a junk `frame` from a malformed file must not index
  // into it (or off the front) and paint the strip a color that means nothing.
  it('stays in range on out-of-spec frame values', () => {
    for (const frame of [-1, 3, 7, -4]) {
      for (const strand of [1, -1]) {
        expect(frameColorIndex(frame, strand)).toBeGreaterThanOrEqual(1)
        expect(frameColorIndex(frame, strand)).toBeLessThanOrEqual(6)
      }
    }
    // and wraps the way the modulo says: -1 is frame 2
    expect(frameColorIndex(-1, 1)).toBe(frameColorIndex(2, 1))
    expect(frameColorIndex(3, 1)).toBe(frameColorIndex(0, 1))
  })
})

// The strip is an *overlay*, drawn over whichever rendering won, while
// `legendItems` is a dispatch on `activeRowRendering` — so no branch of that
// dispatch is ever the strip and it could not have had a key. Three saturated
// colors on every species row, on screen and in every exported figure, with
// nothing anywhere saying they mean reading frame.
describe('the CDS strip keys itself', () => {
  const framesEnv = () =>
    createMafTestEnvironment({ annotationAdapter: { type: 'BigBedAdapter' } })

  // Order matters, and not incidentally: `setShowAnnotations` moves
  // `annotationDataActive`, which is an `rpcProps()` cache key, so
  // SettingsInvalidate clears every per-region map — the frames included. The
  // strip therefore has to be on *before* the frames land, which is the order
  // the real fetch delivers them in too (the toggle is what triggers it).
  function seed(display: LinearMafDisplayModel, showStrip: boolean) {
    display.setSamples({
      samples: [{ id: 'hg38', label: 'hg38' }],
      treeNewick: undefined,
      samplesCanonical: true,
    })
    display.setShowAnnotations(showStrip)
    display.setFramesData(0, [
      {
        refName: 'ctgA',
        start: 100,
        end: 400,
        src: 'hg38',
        frame: 0,
        strand: 1,
        name: 'GAPDH',
      },
    ])
  }

  it('keys from the same indexer the painter uses', () => {
    const colors = getFrameColors(palette)
    expect(getFrameLegendItems(palette).map(i => i.color)).toEqual([
      colors[frameColorIndex(0, 1)],
      colors[frameColorIndex(1, 1)],
      colors[frameColorIndex(2, 1)],
    ])
  })

  // Three, not six: both strands of a frame share a color, so a six-row key
  // would be three duplicated pairs claiming a distinction nothing draws.
  it('has one row per frame, not one per frame and strand', () => {
    expect(getFrameLegendItems(palette)).toHaveLength(3)
  })

  it('appears in the display legend once the strip draws', () => {
    const { display } = framesEnv().createDisplay()
    seed(display, /* strip off */ false)
    expect(display.visibleFrames).toEqual([])
    expect(display.legendItems).toEqual([])

    seed(display, true)
    expect(display.visibleFrames.length).toBeGreaterThan(0)
    expect(display.legendItems.map(i => i.label)).toEqual([
      'CDS frame: 1st codon base',
      '2nd codon base',
      '3rd codon base',
    ])
  })

  // It is appended, not dispatched to, because the strip draws over whichever
  // rendering won — so both keys are on screen at once and the rendering's own
  // swatches stay where a reader of the other modes expects them.
  it('rides alongside the active rendering key rather than replacing it', () => {
    const { display } = framesEnv().createDisplay()
    seed(display, true)
    display.setRowRendering('heatmap')
    // pins the plot on at this zoom, where it would otherwise yield to the bases
    display.setRowIdentityAutoZoom(false)
    expect(display.activeRowRendering).toBe('heatmap')

    const labels = display.legendItems.map(i => i.label)
    expect(labels).toContain('CDS frame: 1st codon base')
    expect(labels.at(-1)).toBe('3rd codon base')
    expect(labels.length).toBeGreaterThan(3)
  })

  // The key decodes what is on screen. Panning off the CDS takes the strip with
  // it, and a key for an overlay that is not there is the dead chrome the band
  // getters exist to avoid.
  it('goes away where no CDS is in view', () => {
    const { display } = framesEnv().createDisplay()
    seed(display, true)
    display.setFramesData(0, [])
    expect(display.visibleFrames).toEqual([])
    expect(display.legendItems).toEqual([])
  })
})
