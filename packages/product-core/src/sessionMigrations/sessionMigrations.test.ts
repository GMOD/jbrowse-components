import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { types } from '@jbrowse/mobx-state-tree'

import { migrateSessionSnapshot, migratedDisplayInstanceKeys } from './index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

type DisplayArgs = ConstructorParameters<typeof DisplayType>[0]

function display(
  name: string,
  extra: Partial<DisplayArgs> = {},
  retired?: Record<string, (value: unknown) => Record<string, unknown>>,
) {
  return new DisplayType({
    name,
    configSchema: ConfigurationSchema(name, {}, { retired }),
    stateModel: types.model(name, {}),
    trackType: 'FeatureTrack',
    viewType: 'LinearGenomeView',
    ReactComponent: () => null,
    ...extra,
  })
}

const pluginManager = {
  getDisplayElements: () => [
    display(
      'BandedDisplay',
      {
        retiredTypes: [
          {
            type: 'OneBandDisplay',
            migrate: e => ({ otherBand: false, ...e }),
          },
        ],
        retiredState: {
          keys: ['colorSetting', 'subNode'],
          lift: i =>
            i.colorSetting === undefined ? {} : { legacyColor: i.colorSetting },
        },
      },
      { legacyColor: color => ({ color }) },
    ),
    display('PlainDisplay'),
  ],
} as unknown as PluginManager

function lgv(tracks: unknown[], extra: Record<string, unknown> = {}) {
  return {
    name: 'test',
    views: [{ id: 'v', type: 'LinearGenomeView', tracks }],
    ...extra,
  }
}

function track(trackId: string, displays: Record<string, unknown>[]) {
  return {
    id: `${trackId}-view`,
    type: 'FeatureTrack',
    configuration: trackId,
    displays,
  }
}

const migrate = (snap: Record<string, unknown>) =>
  migrateSessionSnapshot(snap, pluginManager)

const firstInstance = (result: Record<string, unknown>) =>
  (result.views as any)[0].tracks[0].displays[0]

test('a session this build wrote comes back by identity', () => {
  const snap = lgv([
    track('t', [
      { id: 'd', type: 'BandedDisplay', configuration: 't-BandedDisplay' },
    ]),
  ])
  expect(migrate(snap)).toBe(snap)
  const noViews = { name: 'no views' }
  expect(migrate(noViews)).toBe(noViews)
})

test('a retired instance loads as its successor, under the id the successor mints', () => {
  const result = migrate(
    lgv([
      track('t', [
        { id: 'd', type: 'OneBandDisplay', configuration: 't-OneBandDisplay' },
      ]),
    ]),
  )
  expect(firstInstance(result)).toEqual({
    id: 'd',
    type: 'BandedDisplay',
    configuration: 't-BandedDisplay',
  })
  expect(result.trackConfigDeltas).toEqual({
    t: {
      trackId: 't',
      displays: [
        {
          type: 'BandedDisplay',
          displayId: 't-BandedDisplay',
          otherBand: false,
        },
      ],
    },
  })
})

test('a custom config id is kept', () => {
  const result = migrate(
    lgv([
      track('t', [{ id: 'd', type: 'OneBandDisplay', configuration: 'mine' }]),
    ]),
  )
  expect(firstInstance(result).configuration).toBe('mine')
  expect((result.trackConfigDeltas as any).t.displays[0].displayId).toBe('mine')
})

test('lifted state runs through the retired type and the display’s own rewrite', () => {
  const result = migrate(
    lgv([
      track('t', [
        {
          id: 'd',
          type: 'OneBandDisplay',
          configuration: 't-OneBandDisplay',
          colorSetting: 'red',
          subNode: { x: 1 },
          heightPreConfig: 333,
          live: true,
        },
      ]),
    ]),
  )
  expect(firstInstance(result)).toEqual({
    id: 'd',
    type: 'BandedDisplay',
    configuration: 't-BandedDisplay',
    live: true,
  })
  expect((result.trackConfigDeltas as any).t.displays[0]).toEqual({
    type: 'BandedDisplay',
    displayId: 't-BandedDisplay',
    otherBand: false,
    color: 'red',
    height: 333,
  })
})

test('heightPreConfig reaches the height slot of any display type', () => {
  const result = migrate(
    lgv([
      track('t', [
        {
          id: 'd',
          type: 'PlainDisplay',
          configuration: 't-PlainDisplay',
          heightPreConfig: 120,
        },
      ]),
    ]),
  )
  expect(firstInstance(result).heightPreConfig).toBeUndefined()
  expect((result.trackConfigDeltas as any).t.displays[0]).toEqual({
    type: 'PlainDisplay',
    displayId: 't-PlainDisplay',
    height: 120,
  })
})

test('merges into an existing delta entry for the display', () => {
  const result = migrate(
    lgv(
      [
        track('t', [
          {
            id: 'd',
            type: 'BandedDisplay',
            configuration: 't-BandedDisplay',
            colorSetting: 'red',
          },
        ]),
      ],
      {
        trackConfigDeltas: {
          t: {
            trackId: 't',
            displays: [{ displayId: 't-BandedDisplay', height: 321 }],
          },
        },
      },
    ),
  )
  expect((result.trackConfigDeltas as any).t.displays).toEqual([
    { displayId: 't-BandedDisplay', height: 321, color: 'red' },
  ])
})

test('a session track takes the settings in place, on the entry still spelling the retired type', () => {
  const result = migrate(
    lgv(
      [
        track('st', [
          {
            id: 'd',
            type: 'OneBandDisplay',
            configuration: 'st-OneBandDisplay',
            colorSetting: 'red',
          },
        ]),
      ],
      {
        sessionTracks: [
          {
            trackId: 'st',
            type: 'FeatureTrack',
            displays: [
              {
                type: 'OneBandDisplay',
                displayId: 'st-OneBandDisplay',
                height: 50,
              },
            ],
          },
        ],
      },
    ),
  )
  expect(result.trackConfigDeltas).toBeUndefined()
  expect((result.sessionTracks as any)[0].displays).toEqual([
    {
      type: 'OneBandDisplay',
      displayId: 'st-OneBandDisplay',
      height: 50,
      otherBand: false,
      color: 'red',
    },
  ])
})

test('reaches the panels of a view that holds views', () => {
  const result = migrate({
    name: 'test',
    views: [
      {
        type: 'LinearSyntenyView',
        views: [
          {
            type: 'LinearGenomeView',
            tracks: [
              track('t', [
                {
                  id: 'd',
                  type: 'OneBandDisplay',
                  configuration: 't-OneBandDisplay',
                },
              ]),
            ],
          },
        ],
      },
    ],
  })
  expect((result.views as any)[0].views[0].tracks[0].displays[0].type).toBe(
    'BandedDisplay',
  )
})

// a synteny view's panels share one display config
test('the last panel wins when two panels lift into one display config', () => {
  const panel = (height: number) => ({
    type: 'LinearGenomeView',
    tracks: [
      track('t', [
        {
          id: `d${height}`,
          type: 'PlainDisplay',
          configuration: 't-PlainDisplay',
          heightPreConfig: height,
        },
      ]),
    ],
  })
  const result = migrate({
    name: 'test',
    views: [{ type: 'LinearSyntenyView', views: [panel(100), panel(200)] }],
  })
  expect((result.trackConfigDeltas as any).t.displays).toEqual([
    { type: 'PlainDisplay', displayId: 't-PlainDisplay', height: 200 },
  ])
})

test('an unknown display type is left for the prune', () => {
  const snap = lgv([
    track('t', [{ id: 'd', type: 'Gone', configuration: 't-Gone' }]),
  ])
  expect(migrate(snap)).toBe(snap)
})

test('the honoured instance keys come off the DisplayTypes', () => {
  expect(migratedDisplayInstanceKeys(pluginManager)).toEqual({
    '*': ['heightPreConfig'],
    BandedDisplay: ['colorSetting', 'subNode'],
  })
})

test("a delta's display id minted by a retired type is re-keyed, with or without an open instance", () => {
  const snap = {
    name: 'test',
    views: [],
    trackConfigDeltas: {
      t: {
        trackId: 't',
        displays: [
          { displayId: 't-OneBandDisplay', height: 7 },
          { displayId: 't-PlainDisplay', height: 8 },
          { displayId: 'mine', height: 9 },
        ],
      },
    },
  }
  expect(migrateSessionSnapshot(snap, pluginManager).trackConfigDeltas).toEqual(
    {
      t: {
        trackId: 't',
        displays: [
          { displayId: 't-BandedDisplay', height: 7 },
          { displayId: 't-PlainDisplay', height: 8 },
          { displayId: 'mine', height: 9 },
        ],
      },
    },
  )
})

test('a delta naming no retired id comes back by identity', () => {
  const snap = {
    name: 'test',
    views: [],
    trackConfigDeltas: {
      t: { trackId: 't', displays: [{ displayId: 't-BandedDisplay' }] },
    },
  }
  expect(migrateSessionSnapshot(snap, pluginManager)).toBe(snap)
})
