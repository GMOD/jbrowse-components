import rangeParser from 'range-parser' // eslint-disable-line import/no-extraneous-dependencies
import { LocalFile } from 'generic-filehandle' // eslint-disable-line import/no-extraneous-dependencies
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { TextDecoder, TextEncoder } from 'fastestsmallesttextencoderdecoder'
import JBrowseRootModelFactory from '../rootModel'
import configSnapshot from '../../test_data/volvox/config.json'
import corePlugins from '../corePlugins'

configSnapshot.configuration = {
  rpc: {
    defaultDriver: 'MainThreadRpcDriver',
  },
  useUrlSession: false,
}

export function getPluginManager(initialState, adminMode = false) {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()

  const JBrowseRootModel = JBrowseRootModelFactory(pluginManager, adminMode)
  const rootModel = JBrowseRootModel.create({
    jbrowse: initialState || configSnapshot,
    assemblyManager: {},
  })
  if (rootModel.jbrowse && rootModel.jbrowse.savedSessions.length) {
    const { name } = rootModel.jbrowse.savedSessions[0]
    rootModel.activateSession(name)
  } else {
    rootModel.setDefaultSession()
  }
  pluginManager.setRootModel(rootModel)

  pluginManager.configure()
  return pluginManager
}

// resolves a file to the filesystem
const getFile = url => new LocalFile(require.resolve(`../../${url}`))

// fakes server responses from local file object with fetchMock
export const readBuffer = async request => {
  try {
    const file = getFile(request.url)
    const maxRangeRequest = 1000000 // kind of arbitrary, part of the rangeParser
    if (request.headers.get('range')) {
      const range = rangeParser(maxRangeRequest, request.headers.get('range'))
      if (range === -2 || range === -1) {
        throw new Error(`Error parsing range "${request.headers.get('range')}"`)
      }
      const { start, end } = range[0]
      const len = end - start + 1
      const buf = Buffer.alloc(len)
      const { bytesRead } = await file.read(buf, 0, len, start)
      const stat = await file.stat()
      return new Response(buf.slice(0, bytesRead), {
        status: 206,
        headers: [['content-range', `${start}-${end}/${stat.size}`]],
      })
    }
    const body = await file.readFile()
    return new Response(body, { status: 200 })
  } catch (e) {
    console.error(e)
    return new Response(undefined, { status: 404 })
  }
}

export function setup() {
  if (!window.TextEncoder) window.TextEncoder = TextEncoder
  if (!window.TextDecoder) window.TextDecoder = TextDecoder

  window.requestIdleCallback = cb => cb()
  window.cancelIdleCallback = () => {}
  window.requestAnimationFrame = cb => setTimeout(cb)
  window.cancelAnimationFrame = () => {}

  Storage.prototype.getItem = jest.fn(() => null)
  Storage.prototype.setItem = jest.fn()
  Storage.prototype.removeItem = jest.fn()
  Storage.prototype.clear = jest.fn()
}
