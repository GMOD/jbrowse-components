import React from 'react'
import { GenericFilehandle } from 'generic-filehandle'

import rangeParser from 'range-parser'
import PluginManager from '@jbrowse/core/PluginManager'
import { QueryParamProvider } from 'use-query-params'

import JBrowseWithoutQueryParamProvider from '../JBrowse'
import JBrowseRootModelFactory from '../rootModel'
import configSnapshot from '../../test_data/volvox/config.json'
import corePlugins from '../corePlugins'
jest.mock('../makeWorkerInstance', () => () => {})

// @ts-ignore
configSnapshot.configuration = {
  rpc: {
    defaultDriver: 'MainThreadRpcDriver',
  },
}

export function getPluginManager(initialState: any, adminMode = true) {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()

  const JBrowseRootModel = JBrowseRootModelFactory(pluginManager, adminMode)
  const rootModel = JBrowseRootModel.create(
    {
      jbrowse: initialState || configSnapshot,
      assemblyManager: {},
    },
    { pluginManager },
  )
  if (rootModel && rootModel.jbrowse.defaultSession.length) {
    const { name } = rootModel.jbrowse.defaultSession
    localStorage.setItem(
      `localSaved-1`,
      JSON.stringify({ session: rootModel.jbrowse.defaultSession }),
    )
    rootModel.activateSession(name)
  } else {
    rootModel.setDefaultSession()
  }

  rootModel.session!.views.map(view => view.setWidth(800))
  pluginManager.setRootModel(rootModel)

  pluginManager.configure()
  return pluginManager
}

export function generateReadBuffer(
  getFileFunction: (str: string) => GenericFilehandle,
) {
  return async (request: Request) => {
    try {
      const file = getFileFunction(request.url)
      const maxRangeRequest = 10000000 // kind of arbitrary, part of the rangeParser
      const r = request.headers.get('range')
      if (r) {
        const range = rangeParser(maxRangeRequest, r)
        if (range === -2 || range === -1) {
          throw new Error(`Error parsing range "${r}"`)
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
}

export function setup() {
  window.requestIdleCallback = (cb: Function) => cb()
  window.cancelIdleCallback = () => {}
  window.requestAnimationFrame = (cb: Function) => setTimeout(cb)
  window.cancelAnimationFrame = () => {}

  Storage.prototype.getItem = jest.fn(() => null)
  Storage.prototype.setItem = jest.fn()
  Storage.prototype.removeItem = jest.fn()
  Storage.prototype.clear = jest.fn()
}

// eslint-disable-next-line no-global-assign
window = Object.assign(window, { innerWidth: 800 })

export function canvasToBuffer(canvas: HTMLCanvasElement) {
  return Buffer.from(
    canvas.toDataURL().replace(/^data:image\/\w+;base64,/, ''),
    'base64',
  )
}

export function expectCanvasMatch(canvas: HTMLCanvasElement) {
  expect(canvasToBuffer(canvas)).toMatchImageSnapshot({
    failureThreshold: 0.05,
    failureThresholdType: 'percent',
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function JBrowse(props: any) {
  return (
    <QueryParamProvider>
      <JBrowseWithoutQueryParamProvider {...props} />
    </QueryParamProvider>
  )
}
