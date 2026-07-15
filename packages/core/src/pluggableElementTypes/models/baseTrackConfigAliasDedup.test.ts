import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../../PluginManager.ts'
import { ConfigurationSchema } from '../../configuration/index.ts'
import DisplayType from '../DisplayType.ts'
import TrackType from '../TrackType.ts'
import { createBaseTrackConfig } from './index.ts'

// A v4.3.0 alignments share link carries separate display configs
// (LinearPileupDisplay, LinearSNPCoverageDisplay, ...) that are now all aliases
// of LinearAlignmentsDisplay. After normalization they must collapse to one
// display per type, otherwise the Display types menu shows duplicate entries.
function pluginManagerWithAliasedDisplay() {
  const pluginManager = new PluginManager()
  pluginManager.addTrackType(() => {
    const configSchema = ConfigurationSchema(
      'AlignmentsTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'AlignmentsTrack',
      configSchema,
      // stateModel is unused by the alias-dedup path under test; a stub model
      // avoids importing a full track state model.
      stateModel: types.model('AlignmentsTrack', {}),
    })
  })
  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LinearAlignmentsDisplay',
        configSchema: ConfigurationSchema(
          'LinearAlignmentsDisplay',
          {},
          { explicitIdentifier: 'displayId', explicitlyTyped: true },
        ),
        // unused at runtime here; stub model avoids importing a full state model
        stateModel: types.model('LinearAlignmentsDisplay', {}),
        trackType: 'AlignmentsTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: () => null,
        aliases: [
          'LinearPileupDisplay',
          'LinearSNPCoverageDisplay',
          'LinearReadArcsDisplay',
          'LinearReadCloudDisplay',
        ],
      }),
  )
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return pluginManager
}

test('alias display types collapse to a single config per type', () => {
  const pluginManager = pluginManagerWithAliasedDisplay()
  const TrackConfig = pluginManager.getTrackType('AlignmentsTrack').configSchema

  const conf = TrackConfig.create(
    {
      trackId: 'aln1',
      type: 'AlignmentsTrack',
      displays: [
        { type: 'LinearAlignmentsDisplay', displayId: 'aln1-combo' },
        { type: 'LinearPileupDisplay', displayId: 'aln1-pileup' },
        { type: 'LinearSNPCoverageDisplay', displayId: 'aln1-snpcov' },
        { type: 'LinearReadArcsDisplay', displayId: 'aln1-arcs' },
        { type: 'LinearReadCloudDisplay', displayId: 'aln1-cloud' },
      ],
    },
    { pluginManager },
  )

  const displays = conf.displays as { type: string }[]
  expect(displays).toHaveLength(1)
  expect(displays[0]!.type).toBe('LinearAlignmentsDisplay')
})

test('first occurrence wins, preserving the default display', () => {
  const pluginManager = pluginManagerWithAliasedDisplay()
  const TrackConfig = pluginManager.getTrackType('AlignmentsTrack').configSchema

  const conf = TrackConfig.create(
    {
      trackId: 'aln2',
      type: 'AlignmentsTrack',
      displays: [
        { type: 'LinearPileupDisplay', displayId: 'aln2-pileup' },
        { type: 'LinearAlignmentsDisplay', displayId: 'aln2-combo' },
      ],
    },
    { pluginManager },
  )

  const displays = conf.displays as { displayId: string }[]
  expect(displays).toHaveLength(1)
  expect(displays[0]!.displayId).toBe('aln2-pileup')
})
