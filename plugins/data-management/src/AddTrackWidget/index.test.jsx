import React from 'react'
import { types } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import stateModelFactory from './model'
import Alignments from '@jbrowse/plugin-alignments'
import SVG from '@jbrowse/plugin-svg'
import Variants from '@jbrowse/plugin-variants'
import Hic from '@jbrowse/plugin-hic'

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
function setWindowLoc(loc) {
  delete window.location
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

  install(pluginManager) {
    pluginManager.addViewType(() => {
      return new ViewType({
        name: 'FakeView',
        stateModel: FakeViewModel,
        ReactComponent: () => <div>Hello world</div>,
      })
    })
  }
}

describe('tests on an LGV type system with view.assemblyNames, using URL', () => {
  let session
  beforeEach(() => {
    session = standardInitializer()
  })

  afterEach(() => {
    window.location = realLocation
  })

  it('adds relative URL (BAM)', () => {
    console.warn = jest.fn()
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

  it('adds full URL (BAM)', () => {
    const { widget } = session
    widget.setTrackData({
      uri: 'http://google.com/volvox-sorted.bam',
      locationType: 'UriLocation',
    })
    expect(widget.trackName).toBe('volvox-sorted.bam')
    expect(widget.isRelativeUrl).toBe(false)
    expect(widget.assembly).toBe('volvox')
  })

  it('test wrongProtocol returning false', () => {
    const { widget } = session
    widget.setTrackData({
      uri: 'http://google.com/volvox-sorted.bam',
      locationType: 'UriLocation',
    })
    setWindowLoc('http://google.com')

    expect(widget.wrongProtocol).toBe(false)
  })

  it('test wrongProtocol returning true', () => {
    const { widget } = session
    widget.setTrackData({
      uri: 'http://google.com/volvox-sorted.bam',
      locationType: 'UriLocation',
    })
    setWindowLoc('https://google.com')
    expect(widget.wrongProtocol).toBe(true)
  })
})

describe('tests on an view without view.assemblyNames', () => {
  let session
  beforeEach(() => {
    const pluginManager = new PluginManager([new FakeViewPlugin()])
    pluginManager.createPluggableElements()
    pluginManager.configure()
    const SessionModel = types.model({
      view: FakeViewModel,
      widget: stateModelFactory(pluginManager),
    })

    // no assemblyNames on the view, just in case some view does not implement
    // view.assemblyNames (it is just a convenience)
    session = SessionModel.create({
      view: {
        type: 'FakeView',
        id: 'testing',
      },
      widget: {
        type: 'AddTrackWidget',
        view: 'testing',
      },
    })
  })

  it('adds url', () => {
    const { widget } = session
    widget.setTrackData({
      uri: 'volvox-sorted.bam',
      locationType: 'UriLocation',
    })
    expect(widget.trackName).toBe('volvox-sorted.bam')
    expect(widget.isRelativeUrl).toBe(true)
    expect(widget.assembly).toBe(undefined)
  })
})

describe('tests different file types', () => {
  let session
  beforeEach(() => {
    session = standardInitializer()
  })

  afterEach(() => {
    window.location = realLocation
  })

  it('adds bam', () => {
    const { widget } = session
    widget.setTrackData({
      uri: 'volvox-sorted.bam',
      locationType: 'UriLocation',
    })
    expect(widget.trackType).toBe('AlignmentsTrack')
  })

  it('adds cram', () => {
    const { widget } = session
    widget.setTrackData({
      uri: 'volvox-sorted.cram',
      locationType: 'UriLocation',
    })
    expect(widget.trackType).toBe('AlignmentsTrack')
  })

  it('adds .vcf.gz', () => {
    const { widget } = session
    widget.setTrackData({
      uri: 'volvox-sorted.vcf.gz',
      locationType: 'UriLocation',
    })
    expect(widget.trackType).toBe('VariantTrack')
  })

  it('adds .gff3', () => {
    const { widget } = session
    widget.setTrackData({
      uri: 'volvox-sorted.gff3',
      locationType: 'UriLocation',
    })
    expect(widget.trackType).toBe('FeatureTrack')
  })

  it('adds .hic', () => {
    const { widget } = session
    widget.setTrackData({
      uri: 'volvox-sorted.hic',
      locationType: 'UriLocation',
    })
    expect(widget.trackType).toBe('HicTrack')
  })
})

describe('tests localpath', () => {
  let session
  beforeEach(() => {
    session = standardInitializer()
  })
  it('adds bam', () => {
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
})
