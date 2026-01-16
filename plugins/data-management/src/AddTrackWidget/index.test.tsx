import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { types } from '@jbrowse/mobx-state-tree'
import Alignments from '@jbrowse/plugin-alignments'
import Hic from '@jbrowse/plugin-hic'
import Variants from '@jbrowse/plugin-variants'

import stateModelFactory from './model.ts'

function standardInitializer() {
  const pluginManager = new PluginManager([
    new FakeViewPlugin(),
    new Alignments(),
    new Variants(),
    new Hic(),
  ])
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const SessionModel = types
    .model({
      view: FakeViewModel,
      widget: stateModelFactory(pluginManager),
    })
    .volatile(() => ({
      rpcManager: {},
      configuration: {},
    }))

  // assemblyNames is defined on the view, which is done in LGV for example
  // this is really just used for convenience to automatically fill in the
  // assembly field in the form
  return SessionModel.create(
    {
      view: {
        id: 'testing',
        type: 'FakeView',
        assemblyNames: ['volvox'],
      },
      widget: {
        type: 'AddTrackWidget',
        view: 'testing',
      },
    },
    { pluginManager },
  )
}

const realLocation = window.location

// https://stackoverflow.com/a/60110508/2129219
function setWindowLoc(loc: string) {
  // @ts-expect-error
  // biome-ignore lint/performance/noDelete:
  delete window.location
  // @ts-expect-error
  window.location = new URL(loc)
}

const FakeViewModel = types.model('FakeView', {
  id: types.identifier,
  type: types.literal('FakeView'),
  assemblyNames: types.maybe(types.array(types.string)),
})

// register a true fake view plugin because the widget.view is a true
// safeReference to a pluginManager.pluggableMstType('view', 'stateModel')
class FakeViewPlugin extends Plugin {
  name = 'FakeViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() => {
      return new ViewType({
        name: 'FakeView',
        stateModel: FakeViewModel,
        ReactComponent: () => <div>Hello world</div>,
      })
    })
  }
}

test('adds relative URL (BAM)', () => {
  const session = standardInitializer()
  const { widget } = session
  widget.setTrackData({
    uri: 'volvox-sorted.bam',
    locationType: 'UriLocation',
  })
  expect(widget.trackName).toBe('volvox-sorted.bam')
  expect(widget.isFtp).toBe(false)
  expect(widget.isRelativeUrl).toBe(true)
  expect(widget.assembly).toBe('volvox')
  expect(widget.trackType).toBe('AlignmentsTrack')
})

test('adds full URL (BAM)', () => {
  const session = standardInitializer()
  const { widget } = session
  widget.setTrackData({
    uri: 'http://google.com/volvox-sorted.bam',
    locationType: 'UriLocation',
  })
  expect(widget.trackName).toBe('volvox-sorted.bam')
  expect(widget.isRelativeUrl).toBe(false)
  expect(widget.assembly).toBe('volvox')
})

xtest('test wrongProtocol returning false', () => {
  const session = standardInitializer()
  const { widget } = session
  widget.setTrackData({
    uri: 'http://google.com/volvox-sorted.bam',
    locationType: 'UriLocation',
  })
  setWindowLoc('http://google.com')

  expect(widget.wrongProtocol).toBe(false)
  // @ts-expect-error
  window.location = realLocation
})

// broken by jest 30
xtest('test wrongProtocol returning true', () => {
  const session = standardInitializer()
  const { widget } = session
  widget.setTrackData({
    uri: 'http://google.com/volvox-sorted.bam',
    locationType: 'UriLocation',
  })
  setWindowLoc('https://google.com')
  expect(widget.wrongProtocol).toBe(true)
  // @ts-expect-error
  window.location = realLocation
})

test('tests on an view without view.assemblyNames', () => {
  const pluginManager = new PluginManager([new FakeViewPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const SessionModel = types.model({
    view: FakeViewModel,
    widget: stateModelFactory(pluginManager),
  })
  // no assemblyNames on the view, just in case some view does not implement
  // view.assemblyNames (it is just a convenience)
  const session = SessionModel.create({
    view: {
      type: 'FakeView',
      id: 'testing',
    },
    widget: {
      type: 'AddTrackWidget',
      view: 'testing',
    },
  })

  const { widget } = session
  widget.setTrackData({
    uri: 'volvox-sorted.bam',
    locationType: 'UriLocation',
  })
  expect(widget.trackName).toBe('volvox-sorted.bam')
  expect(widget.isRelativeUrl).toBe(true)
  expect(widget.assembly).toBe(undefined)
})

test('adds bam', () => {
  const session = standardInitializer()
  const { widget } = session
  widget.setTrackData({
    uri: 'volvox-sorted.bam',
    locationType: 'UriLocation',
  })
  expect(widget.trackType).toBe('AlignmentsTrack')
})

test('adds cram', () => {
  const session = standardInitializer()
  const { widget } = session
  widget.setTrackData({
    uri: 'volvox-sorted.cram',
    locationType: 'UriLocation',
  })
  expect(widget.trackType).toBe('AlignmentsTrack')
})

test('adds .vcf.gz', () => {
  const session = standardInitializer()
  const { widget } = session
  widget.setTrackData({
    uri: 'volvox-sorted.vcf.gz',
    locationType: 'UriLocation',
  })
  expect(widget.trackType).toBe('VariantTrack')
})

test('adds .gff3', () => {
  const session = standardInitializer()
  const { widget } = session
  widget.setTrackData({
    uri: 'volvox-sorted.gff3',
    locationType: 'UriLocation',
  })
  expect(widget.trackType).toBe('FeatureTrack')
})

test('adds .hic', () => {
  const session = standardInitializer()
  const { widget } = session
  widget.setTrackData({
    uri: 'volvox-sorted.hic',
    locationType: 'UriLocation',
  })
  expect(widget.trackType).toBe('HicTrack')
})

test('adds bam localpath', () => {
  const session = standardInitializer()
  const { widget } = session
  widget.setTrackData({
    localPath: 'volvox-sorted.bam',
    locationType: 'LocalPathLocation',
  })
  expect(widget.trackType).toBe('AlignmentsTrack')
  expect(widget.trackName).toBe('volvox-sorted.bam')
  // the localPath is not a "relativeUrl"
  expect(widget.isRelativeUrl).toBe(false)
  expect(widget.isFtp).toBe(false)
  expect(widget.wrongProtocol).toBe(false)
  expect(widget.assembly).toBe('volvox')
})

test('clearData resets all volatile state', () => {
  const session = standardInitializer()
  const { widget } = session

  // Set various state
  widget.setTrackData({
    uri: 'test.bam',
    locationType: 'UriLocation',
  })
  widget.setIndexTrackData({
    uri: 'test.bam.bai',
    locationType: 'UriLocation',
  })
  widget.setTrackName('Custom Name')
  widget.setTrackType('FeatureTrack')
  widget.setAssembly('customAssembly')
  widget.setAdapterHint('BamAdapter')
  widget.setTextIndexTrack(false)
  widget.setTextIndexingConf({ attributes: ['Gene'], exclude: ['mRNA'] })
  widget.setMixinData({ extra: 'data' })

  // Verify state was set
  expect(widget.trackData).toBeDefined()
  expect(widget.indexTrackData).toBeDefined()
  expect(widget.altTrackName).toBe('Custom Name')
  expect(widget.altTrackType).toBe('FeatureTrack')
  expect(widget.altAssemblyName).toBe('customAssembly')
  expect(widget.adapterHint).toBe('BamAdapter')
  expect(widget.textIndexTrack).toBe(false)
  expect(widget.textIndexingConf).toEqual({
    attributes: ['Gene'],
    exclude: ['mRNA'],
  })
  expect(widget.mixinData).toEqual({ extra: 'data' })

  // Clear and verify reset
  widget.clearData()

  expect(widget.trackData).toBeUndefined()
  expect(widget.indexTrackData).toBeUndefined()
  expect(widget.altTrackName).toBe('')
  expect(widget.altTrackType).toBe('')
  expect(widget.altAssemblyName).toBe('')
  expect(widget.adapterHint).toBe('')
  expect(widget.textIndexTrack).toBe(true)
  expect(widget.textIndexingConf).toBeUndefined()
  expect(widget.mixinData).toEqual({})
})

test('setTrackData clears adapterHint for re-evaluation', () => {
  const session = standardInitializer()
  const { widget } = session

  widget.setTrackData({
    uri: 'test.bam',
    locationType: 'UriLocation',
  })
  widget.setAdapterHint('BamAdapter')
  expect(widget.adapterHint).toBe('BamAdapter')

  // Changing track data should clear the adapter hint
  widget.setTrackData({
    uri: 'test.vcf.gz',
    locationType: 'UriLocation',
  })
  expect(widget.adapterHint).toBe('')
})

test('setIndexTrackData clears adapterHint for re-evaluation', () => {
  const session = standardInitializer()
  const { widget } = session

  widget.setTrackData({
    uri: 'test.bam',
    locationType: 'UriLocation',
  })
  widget.setAdapterHint('BamAdapter')
  expect(widget.adapterHint).toBe('BamAdapter')

  // Changing index data should also clear the adapter hint
  widget.setIndexTrackData({
    uri: 'test.bam.csi',
    locationType: 'UriLocation',
  })
  expect(widget.adapterHint).toBe('')
})

test('detects FTP URLs in track data', () => {
  const session = standardInitializer()
  const { widget } = session

  widget.setTrackData({
    uri: 'ftp://example.com/test.bam',
    locationType: 'UriLocation',
  })
  expect(widget.isFtp).toBe(true)
})

test('detects FTP URLs in index data', () => {
  const session = standardInitializer()
  const { widget } = session

  widget.setTrackData({
    uri: 'https://example.com/test.bam',
    locationType: 'UriLocation',
  })
  widget.setIndexTrackData({
    uri: 'ftp://example.com/test.bam.bai',
    locationType: 'UriLocation',
  })
  expect(widget.isFtp).toBe(true)
})

test('warningMessage returns FTP warning', () => {
  const session = standardInitializer()
  const { widget } = session

  widget.setTrackData({
    uri: 'ftp://example.com/test.bam',
    locationType: 'UriLocation',
  })
  expect(widget.warningMessage).toContain('ftp protocol')
})

test('warningMessage returns relative URL warning', () => {
  const session = standardInitializer()
  const { widget } = session

  widget.setTrackData({
    uri: 'path/to/test.bam',
    locationType: 'UriLocation',
  })
  expect(widget.warningMessage).toContain('relative URL')
})

test('root-relative URLs are not considered relative', () => {
  const session = standardInitializer()
  const { widget } = session

  widget.setTrackData({
    uri: '/absolute/path/test.bam',
    locationType: 'UriLocation',
  })
  expect(widget.isRelativeUrl).toBe(false)
})

test('mixinData is stored and can be retrieved', () => {
  const session = standardInitializer()
  const { widget } = session

  expect(widget.mixinData).toEqual({})

  widget.setMixinData({
    adapter: {
      customOption: 'value',
    },
    metadata: {
      description: 'Test track',
    },
  })

  expect(widget.mixinData).toEqual({
    adapter: {
      customOption: 'value',
    },
    metadata: {
      description: 'Test track',
    },
  })
})

test('trackName falls back to filename when altTrackName is empty', () => {
  const session = standardInitializer()
  const { widget } = session

  widget.setTrackData({
    uri: 'https://example.com/my-track.bam',
    locationType: 'UriLocation',
  })
  expect(widget.trackName).toBe('my-track.bam')

  widget.setTrackName('Custom Name')
  expect(widget.trackName).toBe('Custom Name')
})

test('assembly falls back to view assemblyNames when altAssemblyName is empty', () => {
  const session = standardInitializer()
  const { widget } = session

  // Should use view's assembly
  expect(widget.assembly).toBe('volvox')

  // Setting altAssemblyName should override
  widget.setAssembly('customAssembly')
  expect(widget.assembly).toBe('customAssembly')
})

test('handles undefined view gracefully', () => {
  const pluginManager = new PluginManager([new FakeViewPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const SessionModel = types.model({
    widget: stateModelFactory(pluginManager),
  })

  const session = SessionModel.create({
    widget: {
      type: 'AddTrackWidget',
      // no view reference
    },
  })

  const { widget } = session
  // Should not throw when view is undefined
  expect(widget.assembly).toBeUndefined()
})
