import { tooLargeBannerText } from './tooLargeBannerText.ts'

// The banner's wording is shared by both overlay sets and keyed on by the
// screenshot harness, so it is a contract rather than a string. Its own comment
// says so and nothing checked it.
//
// The `zoomCanRelease` half is the part worth pinning: the advice used to be
// unconditionally true, and is not any more. An index quotes whole blocks, so
// for a file whose blocks are large the same bytes come down however far the
// user zooms — and telling them to keep zooming into a fetch whose cost cannot
// fall is the one thing this banner must not do.

test('offers zooming when zooming can actually help', () => {
  const text = tooLargeBannerText('Requested too much data')

  expect(text).toBe(
    'Requested too much data. Zoom in to see features, or force load this track for the rest of the session (may be slow)',
  )
})

test('withholds that advice when zooming cannot release the gate', () => {
  const text = tooLargeBannerText('Requested too much data', {
    zoomCanRelease: false,
  })

  expect(text).not.toMatch(/[Zz]oom/)
  expect(text).toBe(
    'Requested too much data. Force load this track for the rest of the session (may be slow)',
  )
})

test('a display gating without a reason still gets the way out', () => {
  // `regionTooLargeReason` is empty for a display that gates without naming an
  // axis. The reason is dropped rather than punctuated into a leading ". ".
  expect(tooLargeBannerText('')).toBe(
    'Zoom in to see features, or force load this track for the rest of the session (may be slow)',
  )
})

test('force load is offered in every case', () => {
  // Without it the region is unreachable for the rest of the session, whatever
  // the reason and whatever zooming would do.
  for (const zoomCanRelease of [true, false]) {
    for (const reason of ['', 'Requested too much data']) {
      expect(tooLargeBannerText(reason, { zoomCanRelease })).toMatch(
        /force load this track/i,
      )
    }
  }
})
