import {
  defaultTextHeight,
  getHeaderLayout,
  insetLabelBaselineY,
  labelInkHeight,
  offsetLabelBaselineY,
} from './util.ts'

// Chrome reports a 13px Latin string's ink box as 15px tall (12 above the
// baseline, 3 below), which is what these helpers are calibrated against. The
// clearances below are checked against that measured descent rather than
// against the constants, so a tweak to LABEL_INK_EM can't quietly restore the
// old behaviour: a fixed 18px band with the label drawn at y=5 left the
// descenders 0.41px shy of the track body.
const descent = (fontSize: number) => Math.ceil(fontSize * 0.22)
const fontSizes = [10, 11, 13, 16, 20, 26, 30]

test.each(fontSizes)(
  'an offset label at fontSize %i clears the track body below it',
  fontSize => {
    const textHeight = defaultTextHeight(fontSize)
    const inkBottom = offsetLabelBaselineY(textHeight, fontSize) + descent(fontSize)
    expect(textHeight - inkBottom).toBeGreaterThanOrEqual(2)
  },
)

test.each(fontSizes)(
  'an offset label at fontSize %i stays inside its own band',
  fontSize => {
    const textHeight = defaultTextHeight(fontSize)
    const baseline = offsetLabelBaselineY(textHeight, fontSize)
    const inkTop = baseline - (labelInkHeight(fontSize) - descent(fontSize))
    expect(inkTop).toBeGreaterThanOrEqual(0)
  },
)

// A caller pinning the old 18 (it was the default before the band scaled with
// the font) must still clear the features: the shortfall comes out of the gap
// above the label, never out of the gap below it.
test('a caller-supplied textHeight keeps the clearance below the label', () => {
  const inkBottom = offsetLabelBaselineY(18, 13) + descent(13)
  expect(18 - inkBottom).toBeGreaterThanOrEqual(2)
})

test.each(fontSizes)(
  'an overlay label at fontSize %i stays below the top edge it draws over',
  fontSize => {
    const inkTop =
      insetLabelBaselineY(fontSize) -
      (labelInkHeight(fontSize) - descent(fontSize))
    expect(inkTop).toBeGreaterThanOrEqual(0)
  },
)

// The header stacks assembly name, scalebar and ruler by ink box, not by
// fontSize: reserving only fontSize clipped the assembly name's ascenders
// against the top edge of the export.
test.each(fontSizes)(
  'the exported header reserves the assembly label at fontSize %i',
  fontSize => {
    const { assemblyLabelBaselineY, cytobandTop } = getHeaderLayout({
      fontSize,
      showCytobands: false,
      rulerHeight: 34,
    })
    const inkTop =
      assemblyLabelBaselineY - (labelInkHeight(fontSize) - descent(fontSize))
    expect(inkTop).toBeGreaterThanOrEqual(0)
    expect(cytobandTop).toBeGreaterThan(assemblyLabelBaselineY)
  },
)
