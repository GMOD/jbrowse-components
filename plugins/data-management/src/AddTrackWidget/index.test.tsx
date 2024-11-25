import React from 'react'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import Alignments from '@jbrowse/plugin-alignments'
import Hic from '@jbrowse/plugin-hic'
import SVG from '@jbrowse/plugin-svg'
import Variants from '@jbrowse/plugin-variants'
import { types } from 'mobx-state-tree'
import stateModelFactory from './model'

function standardInitializer() {
  const pluginManager = new PluginManager([
    new FakeViewPlugin(),
    new Alignments(),
    new SVG(),
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

test('test wrongProtocol returning false', () => {
  const session = standardInitializer()
  const { widget } = session
  widget.setTrackData({
    uri: 'http://google.com/volvox-sorted.bam',
    locationType: 'UriLocation',
  })
  setWindowLoc('http://google.com')

  expect(widget.wrongProtocol).toBe(false)
  window.location = realLocation
})

test('test wrongProtocol returning true', () => {
  const session = standardInitializer()
  const { widget } = session
  widget.setTrackData({
    uri: 'http://google.com/volvox-sorted.bam',
    locationType: 'UriLocation',
  })
  setWindowLoc('https://google.com')
  expect(widget.wrongProtocol).toBe(true)
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
