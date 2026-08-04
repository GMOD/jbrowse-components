import { REF_NAME_LABEL_FONT_SIZE } from '../util.ts'
import {
  defaultTextHeight,
  getHeaderLayout,
  insetLabelBaselineY,
  labelBaselineFromTop,
  labelInkHeight,
  offsetLabelBaselineY,
  refNameLabelBaselineY,
  refNameLabelBoxHeight,
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
    const inkBottom =
      offsetLabelBaselineY(textHeight, fontSize) + descent(fontSize)
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

// labelBaselineFromTop stands in for a hanging baseline at the sites whose
// reserved height is computed from labelInkHeight, so it has to mean the same
// thing that reservation assumes: the top of the ink box lands on the given y,
// with the whole box below it.
test.each(fontSizes)(
  'labelBaselineFromTop puts the ink box top at the given y (fontSize %i)',
  fontSize => {
    const top = 7
    const baseline = labelBaselineFromTop(top, fontSize)
    const ink = labelInkHeight(fontSize)
    const d = descent(fontSize)
    expect(baseline - (ink - d)).toBe(top)
    expect(baseline + d).toBe(top + ink)
  },
)

// The bold refName label's clip box used to be sized `fontSize + 2` with its
// baseline at `fontSize` — the export's *general* font size, not the size the
// name is drawn at. That cut the descenders off a name like `chrUn_gl000220` at
// the default 13, and at any smaller export font clipped the tops as well. The
// box is now keyed to REF_NAME_LABEL_FONT_SIZE, so it holds the glyphs whatever
// the caller asks for elsewhere in the export.
test('the refName label box holds the glyphs it clips', () => {
  const d = descent(REF_NAME_LABEL_FONT_SIZE)
  const inkTop =
    refNameLabelBaselineY - (labelInkHeight(REF_NAME_LABEL_FONT_SIZE) - d)
  expect(inkTop).toBeGreaterThanOrEqual(0)
  expect(refNameLabelBaselineY + d).toBeLessThanOrEqual(refNameLabelBoxHeight)
})

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
