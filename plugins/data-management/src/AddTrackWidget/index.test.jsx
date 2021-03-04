import React from 'react'
import { types } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import stateModelFactory from './model'

const realLocation = window.location

// https://stackoverflow.com/a/60110508/2129219
function setWindowLoc(loc) {
  delete window.location
  window.location = new URL(loc)
}
const FakeViewModel = types.model({
  type: types.literal('FakeView'),
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
    const pluginManager = new PluginManager([new FakeViewPlugin()])
    pluginManager.createPluggableElements()
    pluginManager.configure()
    const SessionModel = types.model({
      view: FakeViewModel,
      widget: stateModelFactory(pluginManager),
    })

    session = SessionModel.create({
      view: {
        type: 'FakeView',
        assemblyNames: ['volvox'],
      },
      widget: {
        type: 'AddTrackWidget',
        view: 'testing',
      },
    })
  })

  afterEach(() => {
    window.location = realLocation
  })

  it('adds url', () => {
    const { widget } = session
    widget.setTrackData({ uri: 'volvox-sorted.bam' })
    expect(widget.trackName).toBe('volvox-sorted.bam')
    expect(widget.isFtp).toBe(false)
    expect(widget.isRelativeUrl).toBe(true)
  })

  it('adds url from wrong protocol', () => {
    const { widget } = session
    widget.setTrackData({ uri: 'http://google.com/volvox-sorted.bam' })
    expect(widget.trackName).toBe('volvox-sorted.bam')
    expect(widget.isRelativeUrl).toBe(false)
  })

  it('test wrongProtocol returning false', () => {
    const { widget } = session
    widget.setTrackData({ uri: 'http://google.com/volvox-sorted.bam' })
    setWindowLoc('http://google.com')

    expect(widget.wrongProtocol).toBe(false)
  })

  it('test wrongProtocol returning true', () => {
    const { widget } = session
    widget.setTrackData({ uri: 'http://google.com/volvox-sorted.bam' })
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

    session = SessionModel.create({
      view: { type: 'FakeView' },
      widget: {
        type: 'AddTrackWidget',
        view: 'testing',
      },
    })
  })

  it('adds url', () => {
    const { widget } = session
    widget.setTrackData({ uri: 'volvox-sorted.bam' })
    expect(widget.trackName).toBe('volvox-sorted.bam')
    expect(widget.isRelativeUrl).toBe(true)
    expect(widget.assembly).toBe(undefined)
  })
})
