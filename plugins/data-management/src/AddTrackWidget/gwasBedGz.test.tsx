import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { types } from '@jbrowse/mobx-state-tree'
import Bed from '@jbrowse/plugin-bed'
import GWAS from '@jbrowse/plugin-gwas'

import { alternativeAdapters } from './components/util.ts'
import stateModelFactory from './model.ts'

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
          ReactComponent: () => null,
        }),
    )
  }
}

// GWAS results are mostly a bgzipped BED, which the format list reads as a
// plain BED: the form has to offer the GWAS reading, and taking it has to
// build the GWAS track the retired GWAS workflow built.
test('a bgzipped BED is offered as GWAS, and taking it makes a GWAS track', () => {
  const pluginManager = new PluginManager([
    new FakeViewPlugin(),
    new Bed(),
    new GWAS(),
  ])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const { widget } = types
    .model({ view: FakeViewModel, widget: stateModelFactory(pluginManager) })
    .volatile(() => ({
      rpcManager: {},
      configuration: {},
      assemblies: [{ name: 'hg38' }],
      assemblyManager: { get: () => ({ name: 'hg38' }) },
    }))
    .create(
      {
        view: { id: 'v', type: 'FakeView', assemblyNames: ['hg38'] },
        widget: { type: 'AddTrackWidget', view: 'v' },
      },
      { pluginManager },
    )
  const uri = 'https://example.com/gwas.bed.gz'
  widget.setTrackData({ uri, locationType: 'UriLocation' })
  expect(widget.trackAdapterType).toBe('BedTabixAdapter')
  expect(
    alternativeAdapters({
      adaptersList: pluginManager.getAdapterElements(),
      fileName: 'gwas.bed.gz',
      chosenAdapterType: widget.trackAdapterType,
    }).map(a => a.name),
  ).toContain('GWASAdapter')

  widget.setAdapterHint('GWASAdapter')
  expect(widget.trackType).toBe('GWASTrack')
  expect(widget.getTrackConfig(Date.now())?.adapter).toMatchObject({
    type: 'GWASAdapter',
    bedGzLocation: { uri },
    index: { location: { uri: `${uri}.tbi` } },
  })
})
