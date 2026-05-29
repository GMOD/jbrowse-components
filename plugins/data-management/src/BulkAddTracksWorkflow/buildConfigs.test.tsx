import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { types } from '@jbrowse/mobx-state-tree'
// @ts-expect-error
import Alignments from '@jbrowse/plugin-alignments'
// @ts-expect-error
import Variants from '@jbrowse/plugin-variants'

import { buildTrackConfigs } from './buildConfigs.ts'
import { pairLocations } from './pairLocations.ts'
import addTrackModelFactory from '../AddTrackWidget/model.ts'

import type { FileLocation } from '@jbrowse/core/util/types'

const FakeViewModel = types.model('FakeView', {
  id: types.identifier,
  type: types.literal('FakeView'),
  assemblyNames: types.maybe(types.array(types.string)),
})

class FakeViewPlugin extends Plugin {
  name = 'FakeViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(
      () =>
        new ViewType({
          name: 'FakeView',
          stateModel: FakeViewModel,
          ReactComponent: () => <div>Hello world</div>,
        }),
    )
  }
}

function makeModel() {
  const pluginManager = new PluginManager([
    new FakeViewPlugin(),
    new Alignments(),
    new Variants(),
  ])
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const SessionModel = types
    .model({
      view: FakeViewModel,
      widget: addTrackModelFactory(pluginManager),
    })
    .volatile(() => ({
      rpcManager: {},
      configuration: {},
    }))

  const session = SessionModel.create(
    {
      view: { id: 'v', type: 'FakeView', assemblyNames: ['volvox'] },
      widget: { type: 'AddTrackWidget', view: 'v' },
    },
    { pluginManager },
  )
  return session.widget
}

function uri(s: string): FileLocation {
  return { uri: s, locationType: 'UriLocation' }
}

function build(locations: FileLocation[], adminMode = true) {
  return buildTrackConfigs({
    pairs: pairLocations(locations),
    model: makeModel(),
    assembly: 'volvox',
    adminMode,
    timestamp: 123,
  })
}

test('detects bam alignments track and pairs its index', () => {
  const rows = build([uri('/a.bam'), uri('/a.bam.bai')])
  expect(rows).toHaveLength(1)
  expect(rows[0]!.adapterType).toBe('BamAdapter')
  expect(rows[0]!.trackType).toBe('AlignmentsTrack')
  expect(rows[0]!.indexName).toBe('a.bam.bai')
  expect(rows[0]!.status).toBe('ok')
  expect(rows[0]!.conf.assemblyNames).toEqual(['volvox'])
})

test('detects bgzipped vcf variant track', () => {
  const rows = build([uri('/v.vcf.gz'), uri('/v.vcf.gz.tbi')])
  expect(rows[0]!.adapterType).toBe('VcfTabixAdapter')
  expect(rows[0]!.trackType).toBe('VariantTrack')
})

test('flags an unrecognized extension as unknown', () => {
  const rows = build([uri('/mystery.qqq')])
  expect(rows[0]!.status).toBe('unknown')
})

test('session track ids get -sessionTrack suffix when not admin', () => {
  const rows = build([uri('/a.bam')], false)
  expect(rows[0]!.conf.trackId.endsWith('-sessionTrack')).toBe(true)
})
