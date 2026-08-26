import { applySvChannels, getSvChannelsMenuItem } from './svChannels.ts'
import {
  SV_CHANNELS_ON,
  isSvChannelsActive,
  type SvChannelsSettings,
} from './svChannelsPreset.ts'

// `colorBy` and `readConnectionsDown` are on the mock and in neither preset: the
// arrangement wrote both once, and the round trips below are what say it no
// longer does. Their setters are here so that writing them would be POSSIBLE —
// a mock missing the setter would fail the write rather than record it.
function mockModel(initial: Partial<SvChannelsSettings> = {}) {
  return {
    showPileup: true,
    groupBy: undefined as SvChannelsSettings['groupBy'],
    // The promotable sentinel modelled honestly, because the bug lived in the
    // gap between its two sides: the getter always RESOLVES ('off' when nothing
    // is set), and only the setter can say unset. `readConnectionsWritten` is
    // what reached the config, which is the half a resolved read cannot show.
    readConnections: 'off' as SvChannelsSettings['readConnections'],
    readConnectionsWritten: 'off' as string | undefined,
    drawProperPairArcs: true,
    ...initial,
    colorBy: { type: 'modifications' as const },
    readConnectionsDown: false,
    setShowPileup(show: boolean) {
      this.showPileup = show
    },
    setGroupBy(groupBy?: SvChannelsSettings['groupBy']) {
      this.groupBy = groupBy
    },
    setReadConnections(mode?: SvChannelsSettings['readConnections']) {
      this.readConnectionsWritten = mode
      this.readConnections = mode ?? 'off'
    },
    setReadConnectionsDown(down: boolean) {
      this.readConnectionsDown = down
    },
    setDrawProperPairArcs(draw: boolean) {
      this.drawProperPairArcs = draw
    },
  }
}

test('the preset writes all four settings, not a subset', () => {
  const model = mockModel()
  applySvChannels(model, SV_CHANNELS_ON)
  expect(model.showPileup).toBe(false)
  expect(model.groupBy).toEqual({ type: 'pairOrientation' })
  expect(model.readConnections).toBe('arc')
  expect(model.drawProperPairArcs).toBe(false)
})

// Spelled out rather than compared against SV_CHANNELS_OFF: asserting a model
// against the constant that produced it can only ever pass, and the values this
// pins are exactly the ones that were wrong while it did.
test('clicking the menu row turns the arrangement on, then back off', () => {
  const model = mockModel()
  expect(getSvChannelsMenuItem(model).checked).toBe(false)

  getSvChannelsMenuItem(model).onClick()
  expect(isSvChannelsActive(model)).toBe(true)
  expect(getSvChannelsMenuItem(model).checked).toBe(true)

  getSvChannelsMenuItem(model).onClick()
  expect(isSvChannelsActive(model)).toBe(false)
  expect(model.showPileup).toBe(true)
  expect(model.groupBy).toBeUndefined()
  expect(model.drawProperPairArcs).toBe(true)
})

// UNSET, not 'off'. The slot is a promotable sentinel whose unset state follows
// a session-wide default; writing 'off' pins the track out of one for good.
test('leaving the arrangement unsets read connections rather than pinning off', () => {
  const model = mockModel()
  getSvChannelsMenuItem(model).onClick()
  expect(model.readConnectionsWritten).toBe('arc')

  getSvChannelsMenuItem(model).onClick()
  expect(model.readConnectionsWritten).toBeUndefined()
  // and the track still READS as off, so the picture is what leaving it means
  expect(model.readConnections).toBe('off')
})

test.each([
  ['the color scheme', 'colorBy', { type: 'modifications' }],
  ['which side the arcs hang on', 'readConnectionsDown', false],
] as const)('the round trip leaves %s alone', (_what, key, expected) => {
  const model = mockModel()
  getSvChannelsMenuItem(model).onClick()
  expect(model[key]).toEqual(expected)

  getSvChannelsMenuItem(model).onClick()
  expect(model[key]).toEqual(expected)
})

// One case per matched field, so dropping any single comparison from
// `isSvChannelsActive` fails a test rather than passing on the other three.
test.each([
  ['showPileup', { showPileup: true }],
  ['groupBy', { groupBy: { type: 'strand' as const } }],
  ['readConnections', { readConnections: 'cloud' as const }],
  ['drawProperPairArcs', { drawProperPairArcs: true }],
])('changing %s alone leaves the arrangement', (_name, override) => {
  const model = mockModel({ ...SV_CHANNELS_ON, ...override })
  expect(isSvChannelsActive(model)).toBe(false)
})

test('flipping the arcs above the coverage stays in the arrangement', () => {
  const model = mockModel(SV_CHANNELS_ON)
  model.setReadConnectionsDown(true)
  expect(isSvChannelsActive(model)).toBe(true)
})

test('an ungrouped display does not read as grouped by pair orientation', () => {
  const model = mockModel({ ...SV_CHANNELS_ON, groupBy: undefined })
  expect(isSvChannelsActive(model)).toBe(false)
})
