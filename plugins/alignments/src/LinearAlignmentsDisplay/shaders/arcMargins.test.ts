import { ARC_HEIGHT_MARGIN } from './slang/arc.iface.generated.ts'
import { ARC_MARKER_HEIGHT_MARGIN } from './slang/arcMarker.iface.generated.ts'

// arc.slang and arcMarker.slang each declare their own top-margin constant —
// separate shader modules can't cross-import a `static const`. A read-cloud marker
// must land exactly on the flat arc line's Y, which only holds while the two
// margins are equal (both feed the identical `availH = arcBandH - margin`
// formula). Pin them equal here so a change to one .slang alone is a test
// failure, not a silent 8px vertical offset between the line and its markers.
test('arc and arc-marker height margins stay in lockstep', () => {
  expect(ARC_MARKER_HEIGHT_MARGIN).toBe(ARC_HEIGHT_MARGIN)
})
