import { getConf } from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { bootAlignmentsDisplay } from '../testUtils.ts'
import { getSvChannelsMenuItem, svChannelsActive } from './svChannels.ts'
import { SV_CHANNELS_ON, isSvChannelsActive } from './svChannelsPreset.ts'

// A real display, so the preset meets the config the way the menu row writes
// it: through `applyDisplaySettings`, member by member inside each band.
function createDisplay(displayConfig: Record<string, unknown> = {}) {
  console.warn = jest.fn()
  const { baseSession, mount } = bootAlignmentsDisplay({
    trackConfig: {
      displays: [
        { type: 'LinearAlignmentsDisplay', displayId: 'd1', ...displayConfig },
      ],
    },
  })
  const Session = baseSession.volatile(() => ({ rpcManager: {} }))
  return mount(Session, { configuration: 'd1' }).display
}

function clickRow(display: ReturnType<typeof createDisplay>) {
  getSvChannelsMenuItem(display).onClick()
}

test('the preset writes all four settings, not a subset', () => {
  const display = createDisplay()
  clickRow(display)
  expect(display.showPileup).toBe(false)
  expect(display.facet).toMatchObject({ field: 'pairOrientation' })
  expect(display.drawnReadConnections).toBe('link')
  expect(display.showOrdinaryPairs).toBe(false)
})

// Spelled out rather than compared against SV_CHANNELS_OFF: asserting a model
// against the constant that produced it can only ever pass.
test('clicking the menu row turns the arrangement on, then back off', () => {
  const display = createDisplay()
  expect(getSvChannelsMenuItem(display).checked).toBe(false)

  clickRow(display)
  expect(svChannelsActive(display)).toBe(true)
  expect(getSvChannelsMenuItem(display).checked).toBe(true)

  clickRow(display)
  expect(svChannelsActive(display)).toBe(false)
  expect(display.showPileup).toBe(true)
  expect(display.facet).toBeUndefined()
  expect(display.drawnReadConnections).toBe('off')
  expect(display.showOrdinaryPairs).toBe(true)
})

// UNSET, not false, so each member goes back to its schema default.
test('leaving the arrangement unsets what it wrote', () => {
  const display = createDisplay()
  clickRow(display)
  clickRow(display)
  const conf = display.configuration
  expect(getSnapshot(conf.readConnections)).not.toHaveProperty('show')
  expect(getSnapshot(conf.readConnections.ordinaryPairs)).not.toHaveProperty(
    'show',
  )
  expect(getSnapshot(conf.pileup)).not.toHaveProperty('show')
})

test('the round trip leaves the read color and the placement alone', () => {
  const display = createDisplay({
    encoding: { color: { field: 'tags.HP' } },
    readConnections: { placement: 'up' },
  })
  clickRow(display)
  clickRow(display)
  expect(getConf(display, ['encoding', 'color', 'field'])).toBe('tags.HP')
  expect(display.readConnectionsPlacement).toBe('up')
})

const ON = {
  pileup: { show: false },
  facet: { field: 'pairOrientation' },
  readConnections: {
    show: true,
    mark: 'link',
    ordinaryPairs: { show: false },
  },
} as const

test('the preset reads as itself', () => {
  expect(isSvChannelsActive(SV_CHANNELS_ON)).toBe(true)
  expect(isSvChannelsActive(ON)).toBe(true)
})

// One case per matched member, so dropping any single comparison from
// `isSvChannelsActive` fails a test rather than passing on the others.
test.each([
  ['pileup.show', { ...ON, pileup: { show: true } }],
  ['facet', { ...ON, facet: { field: 'strand' } }],
  [
    'readConnections.show',
    { ...ON, readConnections: { ...ON.readConnections, show: false } },
  ],
  [
    'readConnections.mark.type',
    {
      ...ON,
      readConnections: { ...ON.readConnections, mark: 'rule' as const },
    },
  ],
  [
    'readConnections.ordinaryPairs.show',
    {
      ...ON,
      readConnections: { ...ON.readConnections, ordinaryPairs: { show: true } },
    },
  ],
])('changing %s alone leaves the arrangement', (_name, settings) => {
  expect(isSvChannelsActive(settings)).toBe(false)
})

test('a spec spelling the facet as its field string still matches', () => {
  expect(isSvChannelsActive({ ...ON, facet: 'pairOrientation' })).toBe(true)
})

test('flipping the arcs above the coverage stays in the arrangement', () => {
  const display = createDisplay()
  clickRow(display)
  display.setReadConnectionsPlacement('up')
  expect(svChannelsActive(display)).toBe(true)
})
