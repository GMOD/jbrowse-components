import { anchorPanelTracks } from './anchorPanelTracks.ts'

import type { SourceViewTrack } from './anchorPanelTracks.ts'

// The two fields anchorPanelTracks reads off a view's track: the config (for its
// id and its type, which is all isSyntenyTrack looks at) and the open displays.
function track(
  trackId: string,
  type: string,
  displayType?: string,
): SourceViewTrack {
  return {
    configuration: {
      type,
      trackId,
    } as unknown as SourceViewTrack['configuration'],
    displays: displayType ? [{ type: displayType }] : [],
  }
}

test('carries the open tracks over, keeping the display each is shown as', () => {
  expect(
    anchorPanelTracks([
      track('genes', 'FeatureTrack', 'LinearBasicDisplay'),
      track('variants', 'VariantTrack', 'LinearMultiSampleVariantDisplay'),
    ]),
  ).toEqual([
    { trackId: 'genes', type: 'LinearBasicDisplay' },
    { trackId: 'variants', type: 'LinearMultiSampleVariantDisplay' },
  ])
})

// The chain track the launch came from is about to be the ribbon band between
// the panels; copying it into a panel too would draw the same alignments twice.
test('drops synteny tracks, which the launch is turning into the band', () => {
  expect(
    anchorPanelTracks([
      track('chain', 'SyntenyTrack', 'LGVSyntenyDisplay'),
      track('genes', 'FeatureTrack', 'LinearBasicDisplay'),
    ]),
  ).toEqual([{ trackId: 'genes', type: 'LinearBasicDisplay' }])
})

// A track with no display mounted yet says nothing about which display it wants,
// and `type: undefined` in the init is not the same as no `type`: it reaches
// showTrack as an explicitly requested display type of undefined.
test('omits the display type rather than passing undefined', () => {
  expect(anchorPanelTracks([track('genes', 'FeatureTrack')])).toEqual([
    { trackId: 'genes' },
  ])
})

test('an empty view carries nothing', () => {
  expect(anchorPanelTracks([])).toEqual([])
})
