import { ldStatusParts } from './LDStatusBar.tsx'

// `maxVariantSeparation` decides which pairs are drawn at all, and the plot
// cannot show that: an undrawn out-of-band cell leaves the background, and an
// in-band r² = 0 is the ramp's white end at full alpha, which against a light
// theme is the same pixel. Long-range LD is the case worth looking for, and
// without this line it reads as absent rather than as never drawn.
test('a windowed matrix says how far apart a drawn pair may be', () => {
  expect(ldStatusParts({ loadedLDWindow: 500 })).toEqual([
    'pairs up to 500 variants apart',
  ])
})

// `resolveBand` clamps the request to `n - 1`, at which point every pair the
// file names is drawn and there is no window to report.
test('an unwindowed matrix says nothing, so the bar does not render', () => {
  expect(ldStatusParts({ loadedLDWindow: undefined })).toEqual([])
})
