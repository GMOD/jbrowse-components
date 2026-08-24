import PluginManager from '@jbrowse/core/PluginManager'
import { setConf } from '@jbrowse/core/configuration'
import { defineDisplay } from '@jbrowse/display-kit/defineDisplay'
import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import { waitFor } from '@testing-library/react'

import { stateModelFactory as linearGenomeViewStateModelFactory } from '../LinearGenomeView/index.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// A display built by the factory, inside a real linear genome view: the fetch
// foundation attaches, the factory-registered method is what the fetch calls,
// and the `affects` tags decide what a setting change costs.

interface Payload {
  count: number
}

function makeDisplay() {
  return defineDisplay({
    name: 'TestSpecDisplay',
    trackType: 'FeatureTrack',
    params: {
      color: { type: 'color', defaultValue: 'red', affects: 'frame' },
      column: { type: 'string', defaultValue: 'score', affects: 'fetch' },
      pointSize: { type: 'maybeNumber', promotedBase: 6, affects: 'frame' },
    },
    data: async (): Promise<Payload> => ({ count: 1 }),
    paint: () => {},
  })
}

type DisplayModel = Instance<ReturnType<typeof makeDisplay>['stateModel']>

function setup() {
  const defined = makeDisplay()
  const calls: { method: string; args: { params: unknown } }[] = []
  const env = createDisplayTestEnvironment<DisplayModel>({
    trackType: 'FeatureTrack',
    displayName: defined.name,
    configSchema: () => defined.configSchema,
    stateModel: () => defined.stateModel,
    viewModel: linearGenomeViewStateModelFactory,
    assemblyEnd: 100_000,
    displayConfig: {},
    rpcCall: (_sessionId, method, args) => {
      calls.push({ method, args: args as { params: unknown } })
      return { count: 2 }
    },
  })
  const { session, display } = env.createDisplay() as {
    session: ReturnType<typeof env.createDisplay>['session']
    display: DisplayModel
  }
  return { defined, session, display, calls }
}

async function loaded(display: DisplayModel) {
  await waitFor(() => {
    expect(display.loadedRegions.size).toBeGreaterThan(0)
  })
  await waitFor(() => {
    expect(display.isLoading).toBe(false)
  })
}

test('fetches through its own method, sending only the fetch-tagged params', async () => {
  const { display, calls } = setup()
  await loaded(display)
  expect(calls[0]!.method).toBe('TestSpecDisplayData')
  expect(calls[0]!.args.params).toEqual({ column: 'score' })
  expect(display.rpcDataMap.get(0)).toEqual({ count: 2 })
})

test('the render state carries every setting, resolved', async () => {
  const { display } = setup()
  await loaded(display)
  expect(display.renderState.params).toEqual({
    color: 'red',
    column: 'score',
    pointSize: 6,
  })
  expect(display.renderState.canvasHeight).toBe(display.height)
})

test('a promotable setting resolves through the cascade, never its sentinel', async () => {
  const { session, display } = setup()
  await loaded(display)
  expect(display.renderState.params.pointSize).toBe(6)
  session.setDisplayTypeDefault(display.type, 'pointSize', 8)
  expect(display.renderState.params.pointSize).toBe(8)
  setConf(display, 'pointSize', 9)
  expect(display.renderState.params.pointSize).toBe(9)
})

test('a frame setting redraws without a refetch', async () => {
  const { display, calls } = setup()
  await loaded(display)
  const fetches = calls.length
  setConf(display, 'color', 'blue')
  expect(display.renderState.params.color).toBe('blue')
  await loaded(display)
  expect(calls.length).toBe(fetches)
})

test('a fetch setting refetches with the new value', async () => {
  const { display, calls } = setup()
  await loaded(display)
  const fetches = calls.length
  setConf(display, 'column', 'depth')
  await waitFor(() => {
    expect(calls.length).toBeGreaterThan(fetches)
  })
  expect(calls[calls.length - 1]!.args.params).toEqual({ column: 'depth' })
})

test('install registers the display type and its data method', () => {
  const defined = makeDisplay()
  const pluginManager = new PluginManager([])
  defined.install(pluginManager)
  pluginManager.createPluggableElements()
  expect(pluginManager.getDisplayType('TestSpecDisplay').trackType).toBe(
    'FeatureTrack',
  )
  expect(pluginManager.getRpcMethodType('TestSpecDisplayData').name).toBe(
    'TestSpecDisplayData',
  )
})
