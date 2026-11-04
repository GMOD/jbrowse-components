import { getConf } from '@jbrowse/core/configuration'
import { resolveSubMenu } from '@jbrowse/core/ui'
import { getContainingTrack } from '@jbrowse/core/util'
import { addMiddleware, getSnapshot } from '@jbrowse/mobx-state-tree'

import { bootAlignmentsDisplay } from '../testUtils.ts'
import {
  PRESETS_LABEL,
  SV_CHANNELS_LABEL,
  SV_CHANNELS_SETTINGS,
  matchesSvChannels,
} from './svChannelsPreset.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// A real display, so the preset meets the config the way the menu row writes
// it: through `applyPlot`, member by member inside each band.
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

function trackMenuLabels(display: ReturnType<typeof createDisplay>) {
  return display
    .trackMenuItems()
    .flatMap((i: MenuItem) => ('label' in i ? [String(i.label)] : []))
}

function subMenuRows(display: ReturnType<typeof createDisplay>, label: string) {
  const item = display
    .trackMenuItems()
    .find((i: MenuItem) => 'label' in i && i.label === label)
  if (!item || !('subMenu' in item)) {
    throw new Error(`no ${label} submenu in the track menu`)
  }
  return resolveSubMenu(item)
}

function svChannelsRow(display: ReturnType<typeof createDisplay>) {
  const row = subMenuRows(display, PRESETS_LABEL).find(
    i => 'label' in i && i.label === SV_CHANNELS_LABEL,
  )
  if (!row || !('onClick' in row)) {
    throw new Error('no SV channels row')
  }
  return row
}

function applySvChannels(display: ReturnType<typeof createDisplay>) {
  svChannelsRow(display).onClick()
}

test('Presets sits right after Read connections, which no longer holds the row', () => {
  const display = createDisplay()
  const labels = trackMenuLabels(display)
  const presetsAt = labels.indexOf(PRESETS_LABEL)
  expect(labels[presetsAt - 1]).toBe('Read connections')
  expect(presetsAt).toBeLessThan(labels.indexOf('Advanced'))
  expect(
    subMenuRows(display, 'Read connections').some(
      i => 'label' in i && i.label === SV_CHANNELS_LABEL,
    ),
  ).toBe(false)
})

test('the row is a plain action, with no checked state', () => {
  const row = svChannelsRow(createDisplay())
  expect('checked' in row).toBe(false)
  expect('type' in row).toBe(false)
})

test('the preset writes all five settings, not a subset', () => {
  const display = createDisplay()
  applySvChannels(display)
  expect(display.showPileup).toBe(false)
  expect(display.facet).toMatchObject({ field: 'svChannel' })
  expect(display.drawnReadConnections).toBe('link')
  expect(display.showOrdinaryPairs).toBe(false)
  expect(display.showSashimi).toBe(false)
})

test('the click saves the track config at once, so it is one undo step', () => {
  const display = createDisplay()
  const pileupShownAtSave: boolean[] = []
  addMiddleware(getContainingTrack(display), (call, next) => {
    if (call.name === 'persistConfigurationNow') {
      pileupShownAtSave.push(display.showPileup)
    }
    return next(call)
  })
  applySvChannels(display)
  expect(pileupShownAtSave).toEqual([false])
})

test('applying it again changes nothing', () => {
  const display = createDisplay()
  applySvChannels(display)
  applySvChannels(display)
  expect(display.showPileup).toBe(false)
  expect(display.facet).toMatchObject({ field: 'svChannel' })
  expect(display.drawnReadConnections).toBe('link')
})

test('it leaves the read color and the arc placement alone', () => {
  const display = createDisplay({
    encoding: { color: { field: 'tags.HP' } },
    readConnections: { placement: 'up' },
  })
  applySvChannels(display)
  expect(getConf(display, ['encoding', 'color', 'field'])).toBe('tags.HP')
  expect(display.readConnectionsPlacement).toBe('up')
})

test('a regrouping keeps the order already set on the SV channel sections', () => {
  const display = createDisplay({
    facet: { field: 'svChannel', sort: ['inversion'] },
  })
  applySvChannels(display)
  expect(getSnapshot(display.configuration.facet)).toEqual({
    field: 'svChannel',
    sort: ['inversion'],
  })
})

test("a tag grouping's section order and hidden sections do not carry over", () => {
  const display = createDisplay({
    facet: { field: 'tags.HP', sort: ['2'], hidden: ['1'] },
  })
  applySvChannels(display)
  expect(getSnapshot(display.configuration.facet)).toEqual({
    field: 'svChannel',
  })
})

const SETTINGS = {
  pileup: { show: false },
  facet: { field: 'svChannel' },
  readConnections: {
    show: true,
    mark: 'link',
    ordinaryPairs: { show: false },
  },
  sashimi: { show: false },
} as const

test('the preset reads as itself', () => {
  expect(matchesSvChannels(SV_CHANNELS_SETTINGS)).toBe(true)
  expect(matchesSvChannels(SETTINGS)).toBe(true)
})

// One case per matched member, so dropping any single comparison from
// `matchesSvChannels` fails a test rather than passing on the others.
test.each([
  ['pileup.show', { ...SETTINGS, pileup: { show: true } }],
  ['facet', { ...SETTINGS, facet: { field: 'strand' } }],
  [
    'readConnections.show',
    {
      ...SETTINGS,
      readConnections: { ...SETTINGS.readConnections, show: false },
    },
  ],
  [
    'readConnections.mark.type',
    {
      ...SETTINGS,
      readConnections: { ...SETTINGS.readConnections, mark: 'rule' as const },
    },
  ],
  ['sashimi.show', { ...SETTINGS, sashimi: { show: true } }],
  [
    'readConnections.ordinaryPairs.show',
    {
      ...SETTINGS,
      readConnections: {
        ...SETTINGS.readConnections,
        ordinaryPairs: { show: true },
      },
    },
  ],
])('changing %s alone is not the preset', (_name, settings) => {
  expect(matchesSvChannels(settings)).toBe(false)
})

test('a spec spelling the facet as its field string still matches', () => {
  expect(matchesSvChannels({ ...SETTINGS, facet: 'svChannel' })).toBe(true)
})
