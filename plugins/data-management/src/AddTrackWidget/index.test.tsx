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
      configuration: {},
      rpcManager: {},
    }))

  // assemblyNames is defined on the view, which is done in LGV for example
  // this is really just used for convenience to automatically fill in the
  // assembly field in the form
  return SessionModel.create(
    {
      view: {
        assemblyNames: ['volvox'],
        id: 'testing',
        type: 'FakeView',
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
  delete window.location
  // @ts-expect-error
  window.location = new URL(loc)
}

const FakeViewModel = types.model('FakeView', {
  assemblyNames: types.maybe(types.array(types.string)),
  id: types.identifier,
  type: types.literal('FakeView'),
})

// register a true fake view plugin because the widget.view is a true
// safeReference to a pluginManager.pluggableMstType('view', 'stateModel')
class FakeViewPlugin extends Plugin {
  name = 'FakeViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() => {
      return new ViewType({
        ReactComponent: () => <div>Hello world</div>,
        name: 'FakeView',
        stateModel: FakeViewModel,
      })
    })
  }
}

describe('tests on an LGV type system with view.assemblyNames, using URL', () => {
  let session: ReturnType<typeof standardInitializer>
  beforeEach(() => {
    session = standardInitializer()
  })

  afterEach(() => {
    window.location = realLocation
  })

  it('adds relative URL (BAM)', () => {
    const { widget } = session
    widget.setTrackData({
      locationType: 'UriLocation',
      uri: 'volvox-sorted.bam',
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
      locationType: 'UriLocation',
      uri: 'http://google.com/volvox-sorted.bam',
    })
    expect(widget.trackName).toBe('volvox-sorted.bam')
    expect(widget.isRelativeUrl).toBe(false)
    expect(widget.assembly).toBe('volvox')
  })

  it('test wrongProtocol returning false', () => {
    const { widget } = session
    widget.setTrackData({
      locationType: 'UriLocation',
      uri: 'http://google.com/volvox-sorted.bam',
    })
    setWindowLoc('http://google.com')

    expect(widget.wrongProtocol).toBe(false)
  })

  it('test wrongProtocol returning true', () => {
    const { widget } = session
    widget.setTrackData({
      locationType: 'UriLocation',
      uri: 'http://google.com/volvox-sorted.bam',
    })
    setWindowLoc('https://google.com')
    expect(widget.wrongProtocol).toBe(true)
  })
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
      id: 'testing',
      type: 'FakeView',
    },
    widget: {
      type: 'AddTrackWidget',
      view: 'testing',
    },
  })

  const { widget } = session
  widget.setTrackData({
    locationType: 'UriLocation',
    uri: 'volvox-sorted.bam',
  })
  expect(widget.trackName).toBe('volvox-sorted.bam')
  expect(widget.isRelativeUrl).toBe(true)
  expect(widget.assembly).toBe(undefined)
})

describe('tests different file types', () => {
  let session: ReturnType<typeof standardInitializer>
  beforeEach(() => {
    session = standardInitializer()
  })

  afterEach(() => {
    window.location = realLocation
  })

  it('adds bam', () => {
    const { widget } = session
    widget.setTrackData({
      locationType: 'UriLocation',
      uri: 'volvox-sorted.bam',
    })
    expect(widget.trackType).toBe('AlignmentsTrack')
  })

  it('adds cram', () => {
    const { widget } = session
    widget.setTrackData({
      locationType: 'UriLocation',
      uri: 'volvox-sorted.cram',
    })
    expect(widget.trackType).toBe('AlignmentsTrack')
  })

  it('adds .vcf.gz', () => {
    const { widget } = session
    widget.setTrackData({
      locationType: 'UriLocation',
      uri: 'volvox-sorted.vcf.gz',
    })
    expect(widget.trackType).toBe('VariantTrack')
  })

  it('adds .gff3', () => {
    const { widget } = session
    widget.setTrackData({
      locationType: 'UriLocation',
      uri: 'volvox-sorted.gff3',
    })
    expect(widget.trackType).toBe('FeatureTrack')
  })

  it('adds .hic', () => {
    const { widget } = session
    widget.setTrackData({
      locationType: 'UriLocation',
      uri: 'volvox-sorted.hic',
    })
    expect(widget.trackType).toBe('HicTrack')
  })
})

describe('tests localpath', () => {
  let session: ReturnType<typeof standardInitializer>
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
