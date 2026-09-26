import { rampLutOf, stopsFromRampLut } from '@jbrowse/core/util/colorRamp'

import { rColour, rName } from './rplot.ts'

describe('a colour reaches R in a spelling it takes', () => {
  it('converts the ramp LUT spelling to hex', () => {
    expect(rColour('rgb(68,1,84)')).toBe('#440154')
  })

  it('pads a channel R would otherwise misread', () => {
    expect(rColour('rgb(0,1,255)')).toBe('#0001ff')
  })

  it('keeps the channel order', () => {
    expect(rColour('rgb(255,0,0)')).toBe('#ff0000')
  })

  it('leaves hex and R’s own names alone', () => {
    expect(rColour('#440154')).toBe('#440154')
    expect(rColour('steelblue')).toBe('steelblue')
  })

  /**
   * viridis starts at #440154 by publication, so this reads the whole path —
   * scheme name, baked LUT, stop sampling and the hex conversion — against a
   * number neither this repo nor ggplot2 chose.
   */
  it('lands viridis on its published low end', () => {
    const stops = stopsFromRampLut(rampLutOf({ scheme: 'viridis' }), 16)
    expect(rColour(stops[0]!.color)).toBe('#440154')
  })

  it('reverses when the declaration says to', () => {
    const forward = stopsFromRampLut(rampLutOf({ scheme: 'viridis' }), 16)
    const back = stopsFromRampLut(
      rampLutOf({ scheme: 'viridis', reverse: true }),
      16,
    )
    expect(rColour(back.at(-1)!.color)).toBe(rColour(forward[0]!.color))
  })
})

describe('a name on the left of = in c()', () => {
  it('stays bare where R reads it as an identifier', () => {
    expect(rName('exon')).toBe('exon')
  })

  it('is quoted where R would not', () => {
    expect(rName('+')).toBe('"+"')
    expect(rName('1')).toBe('"1"')
  })
})
