import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import {
  searchBoxMenuItems,
  storedSearchBoxPrefs,
} from '@jbrowse/plugin-linear-genome-view'

import { createTestSessionAsync } from '../rootModel/test_util.ts'

import type { MenuItem } from '@jbrowse/core/ui'

jest.mock('../makeWorkerInstance', () => () => {})

const lgvDisplays = [
  ['FeatureTrack', 'LinearBasicDisplay'],
  ['AlignmentsTrack', 'LinearAlignmentsDisplay'],
  ['SyntenyTrack', 'LGVSyntenyDisplay'],
  ['SyntenyTrack', 'MultiWaySyntenyDisplay'],
  ['VariantTrack', 'LinearVariantDisplay'],
  ['LDTrack', 'LDTrackDisplay'],
  ['QuantitativeTrack', 'LinearWiggleDisplay'],
  ['MafTrack', 'LinearMafDisplay'],
  ['HicTrack', 'LinearHicDisplay'],
  ['GWASTrack', 'LinearManhattanDisplay'],
  ['FeatureTrack', 'LinearMarkDisplay'],
  ['FeatureTrack', 'LinearMultiRowFeatureDisplay'],
] as const

const sequence = {
  type: 'ReferenceSequenceTrack',
  trackId: 'volvox_refseq',
  adapter: {
    type: 'FromConfigSequenceAdapter',
    features: [
      {
        refName: 'ctgA',
        uniqueId: 's',
        start: 0,
        end: 100,
        seq: 'A'.repeat(100),
      },
    ],
  },
}

const volvox = { name: 'volvox', sequence }

function trackIdOf(display: string) {
  return `t-${display}`
}

function trackConfig([type, display]: (typeof lgvDisplays)[number]) {
  return {
    type,
    trackId: trackIdOf(display),
    assemblyNames: ['volvox', 'volvox'],
    adapter: { type: 'FromConfigAdapter', features: [] },
    displays: [{ type: display, displayId: `${trackIdOf(display)}-d` }],
  }
}

function trackState([type, display]: (typeof lgvDisplays)[number]) {
  return {
    id: `s-${display}`,
    type,
    configuration: trackIdOf(display),
    displays: [{ id: `d-${display}`, type: display }],
  }
}

function labelOf(item: MenuItem) {
  return 'label' in item ? String(item.label) : undefined
}

function showRows(items: MenuItem[]) {
  return items.flatMap(i =>
    'subMenu' in i && labelOf(i) === 'Show' ? resolveSubMenu(i) : [],
  )
}

function offenders(items: MenuItem[]) {
  return showRows(items).flatMap(row =>
    'subMenu' in row
      ? [`${labelOf(row)} (nested submenu)`]
      : (row.type === 'checkbox' || row.type === 'radio') &&
          !labelOf(row)?.startsWith('Show ')
        ? [`${labelOf(row)} (${row.type})`]
        : [],
  )
}

const region = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 }

const regionView = (id: string) => ({
  id,
  type: 'LinearGenomeView',
  displayedRegions: [region],
  bpPerPx: 0.1,
})

interface TrackWithMenu {
  id: string
  trackMenuItems: () => MenuItem[]
  displays: { facetByField: (field: string) => void }[]
}

function hasTracks(view: unknown): view is { tracks: TrackWithMenu[] } {
  return typeof view === 'object' && view !== null && 'tracks' in view
}

async function trackOf(display: string) {
  const { views } = await sessionOf([
    {
      id: 'lgv',
      type: 'LinearGenomeView',
      tracks: lgvDisplays.map(trackState),
    },
  ])
  const view = views[0]
  const track = hasTracks(view)
    ? view.tracks.find(t => t.id === `s-${display}`)
    : undefined
  if (track) {
    return track
  } else {
    throw new Error(`no track for ${display}`)
  }
}

function sessionOf(views: Record<string, unknown>[]) {
  return createTestSessionAsync({
    jbrowseConfig: {
      assemblies: [volvox],
      tracks: lgvDisplays.map(trackConfig),
    },
    sessionSnapshot: { views },
  })
}

test.each(lgvDisplays.map(([, display]) => [display]))(
  '%s: every toggle in its Show submenu starts with "Show " and none nests',
  async display => {
    const track = await trackOf(display)
    expect(offenders(track.trackMenuItems())).toEqual([])
  },
)

test.each([
  ['LinearAlignmentsDisplay', 'tags.HP'],
  ['LGVSyntenyDisplay', 'mateAssembly'],
])(
  '%s grouped by %s: the rows grouping adds to Show start with "Show " too',
  async (display, field) => {
    const track = await trackOf(display)
    track.displays[0]!.facetByField(field)
    const rows = showRows(track.trackMenuItems()).map(labelOf)
    expect(rows).toContain('Show groups as one row')
    expect(offenders(track.trackMenuItems())).toEqual([])
  },
)

test.each([
  ['LinearGenomeView', [regionView('lgv')]],
  [
    'BreakpointSplitView',
    [
      {
        id: 'breakpoint',
        type: 'BreakpointSplitView',
        views: [regionView('left'), regionView('right')],
      },
    ],
  ],
])('the %s Show submenu starts every toggle with "Show "', async (_, views) => {
  const session = await sessionOf(views)
  const items = session.views[0]!.menuItems()
  expect(showRows(items).length).toBeGreaterThan(0)
  expect(offenders(items)).toEqual([])
})

test('the linear synteny view Show submenu takes the shared search-box rows, each starting with "Show "', () => {
  const items = makeShowSubMenu(
    searchBoxMenuItems(storedSearchBoxPrefs('synteny', 2)),
  )
  expect(showRows(items)).not.toHaveLength(0)
  expect(offenders(items)).toEqual([])
})
