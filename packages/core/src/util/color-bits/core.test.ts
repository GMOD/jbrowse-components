import { from, getAlpha, getBlue, getGreen, getRed, newColor } from './index.ts'

// `from`'s doc comment said "e.g. 0x599eff" while its body read `0xRRGGBBAA`,
// which is the shape of mistake nothing here could catch: every one of these
// returns a plausible colour. So the layout is asserted rather than described,
// on both the number the old comment invited and the one the body actually
// wants.
//
// It has no caller — `./util/color-bits` is not a `packages/core` export path,
// so nothing outside this directory can even reach it — and that is why the
// comment was free to be wrong for as long as it was.
describe('from reads 0xRRGGBBAA, with alpha in the low byte', () => {
  const channels = (c: number) => [
    getRed(c),
    getGreen(c),
    getBlue(c),
    getAlpha(c),
  ]

  it('round-trips a full four-byte value', () => {
    expect(channels(from(0x599effff))).toEqual([0x59, 0x9e, 0xff, 0xff])
    expect(from(0x599effff)).toBe(newColor(0x59, 0x9e, 0xff, 0xff))
  })

  // The case the old comment named. Every channel lands one byte down and the
  // blue becomes the alpha, so a 24-bit CSS hex passed here is a different
  // colour at a different opacity, never an error.
  it('shifts a 24-bit hex down a byte rather than assuming opaque', () => {
    expect(channels(from(0x599eff))).toEqual([0x00, 0x59, 0x9e, 0xff])
    expect(from(0x599eff)).not.toBe(newColor(0x59, 0x9e, 0xff, 0xff))
  })

  it('keeps a zero alpha zero rather than filling it in', () => {
    expect(channels(from(0xff000000))).toEqual([0xff, 0, 0, 0])
  })
})
