import Plugin from '@jbrowse/core/Plugin'
import {
  ConfigurationReference,
  ConfigurationSchema,
} from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'
import { createTestSession } from '@jbrowse/web/testUtils'
import { waitFor } from '@testing-library/react'

import type PluginManager from '@jbrowse/core/PluginManager'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// a display drawing from a subgraph, which FromConfigAdapter cannot cut
class SubgraphDisplayPlugin extends Plugin {
  name = 'SubgraphDisplayPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addDisplayType(() => {
      const configSchema = ConfigurationSchema(
        'SubgraphDisplay',
        {},
        {
          explicitIdentifier: 'displayId',
          explicitlyTyped: true,
          closed: 'warn',
        },
      )
      return new DisplayType({
        name: 'SubgraphDisplay',
        configSchema,
        stateModel: types.compose(
          'SubgraphDisplay',
          BaseDisplay,
          types.model({
            type: types.literal('SubgraphDisplay'),
            configuration: ConfigurationReference(configSchema),
          }),
        ),
        trackType: 'FeatureTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: () => null,
        adapterCapabilities: ['getSubgraph'],
      })
    })
  }
}

async function setup() {
  const session = createTestSession({
    runtimePlugins: [
      {
        plugin: new SubgraphDisplayPlugin(),
        definition: { name: 'SubgraphDisplay', umdUrl: 'subgraph.js' },
      },
    ],
    sessionSnapshot: {
      views: [
        {
          type: 'LinearGenomeView',
          offsetPx: 0,
          bpPerPx: 1,
          displayedRegions: [
            { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
          ],
          tracks: [],
        },
      ],
    },
  }) as any
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'ref0',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'ctgA',
            start: 0,
            end: 1000,
            seq: 'A'.repeat(1000),
          },
        ],
      },
    },
  })
  session.addSessionTrackConf({
    trackId: 'genes',
    name: 'Volvox genes',
    assemblyNames: ['volvox'],
    type: 'FeatureTrack',
    adapter: {
      type: 'FromConfigAdapter',
      features: [{ refName: 'ctgA', uniqueId: 'f1', start: 10, end: 100 }],
    },
    displays: [{ type: 'SubgraphDisplay', displayId: 'genes-subgraph' }],
  })
  const view = session.views[0]
  view.setWidth(800)
  await waitFor(() => {
    expect(view.initialized).toBe(true)
  })
  return { session, view }
}

// The config names the display, so it keeps the entry as settings, but the
// adapter cannot feed it: the track opens as a display it can, and neither the
// switcher nor a request offers the one it cannot.
test('a declared display the adapter cannot feed is never opened', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  const { session, view } = await setup()
  const track = await view.launchTrack('genes')
  expect(track.configuration.displays.map((d: any) => d.type)).toContain(
    'SubgraphDisplay',
  )
  expect(track.activeDisplay.type).not.toBe('SubgraphDisplay')
  expect(track.compatibleDisplays.map((d: any) => d.type)).not.toContain(
    'SubgraphDisplay',
  )

  await view.launchTrack('genes', {}, { type: 'SubgraphDisplay' })
  expect(track.activeDisplay.type).not.toBe('SubgraphDisplay')
  expect(session.snackbarMessages.at(-1).message).toContain(
    'cannot be shown as "SubgraphDisplay"',
  )
  consoleError.mockRestore()
}, 20000)

// A name no display answers to used to resolve to no request at all, and the
// track opened as its default display as if the caller had asked for nothing.
test('a requested display type nothing registers is refused', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  const { session, view } = await setup()
  expect(
    await view.launchTrack('genes', {}, { type: 'LinearBasikDisplay' }),
  ).toBeUndefined()
  expect(view.tracks).toHaveLength(0)
  expect(session.snackbarMessages.at(-1).message).toContain(
    'cannot be shown as "LinearBasikDisplay"',
  )
  consoleError.mockRestore()
}, 20000)
