import { applySvChannels, getSvChannelsMenuItem } from './svChannels.ts'
import {
  SV_CHANNELS_OFF,
  SV_CHANNELS_ON,
  isSvChannelsActive,
  type SvChannelsSettings,
} from './svChannelsPreset.ts'

// `colorBy` is on the mock and on neither preset: the arrangement used to write
// it, and the round trip below is what says it no longer does.
function mockModel(initial: SvChannelsSettings = SV_CHANNELS_OFF) {
  return {
    ...initial,
    colorBy: { type: 'modifications' as const },
    setShowPileup(show: boolean) {
      this.showPileup = show
    },
    setGroupBy(groupBy?: SvChannelsSettings['groupBy']) {
      this.groupBy = groupBy
    },
    setReadConnections(mode: SvChannelsSettings['readConnections']) {
      this.readConnections = mode
    },
    setReadConnectionsDown(down: boolean) {
      this.readConnectionsDown = down
    },
    setDrawProperPairArcs(draw: boolean) {
      this.drawProperPairArcs = draw
    },
  }
}

test('the preset writes all five settings, not a subset', () => {
  const model = mockModel()
  applySvChannels(model, SV_CHANNELS_ON)
  expect(model.showPileup).toBe(false)
  expect(model.groupBy).toEqual({ type: 'pairOrientation' })
  expect(model.readConnections).toBe('arc')
  expect(model.readConnectionsDown).toBe(true)
  expect(model.drawProperPairArcs).toBe(false)
})

test('clicking the menu row turns the arrangement on, then back off', () => {
  const model = mockModel()
  expect(getSvChannelsMenuItem(model).checked).toBe(false)

  getSvChannelsMenuItem(model).onClick()
  expect(isSvChannelsActive(model)).toBe(true)
  expect(getSvChannelsMenuItem(model).checked).toBe(true)

  getSvChannelsMenuItem(model).onClick()
  expect(isSvChannelsActive(model)).toBe(false)
  expect(model).toMatchObject(SV_CHANNELS_OFF)
})

test('the round trip leaves the color scheme alone', () => {
  const model = mockModel()
  getSvChannelsMenuItem(model).onClick()
  expect(model.colorBy).toEqual({ type: 'modifications' })

  getSvChannelsMenuItem(model).onClick()
  expect(model.colorBy).toEqual({ type: 'modifications' })
})

// One case per matched field, so dropping any single comparison from
// `isSvChannelsActive` fails a test rather than passing on the other four.
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
  const model = mockModel({ ...SV_CHANNELS_ON, readConnectionsDown: false })
  expect(isSvChannelsActive(model)).toBe(true)
})

test('an ungrouped display does not read as grouped by pair orientation', () => {
  const model = mockModel({ ...SV_CHANNELS_ON, groupBy: undefined })
  expect(isSvChannelsActive(model)).toBe(false)
})
