import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory,
} from '@jbrowse/plugin-linear-genome-view'
import WigglePlugin from '@jbrowse/plugin-wiggle'
import { waitFor } from '@testing-library/react'

import { configSchemaFactory } from './configSchema.ts'
import { stateModelFactory } from './model.ts'

import type { LinearMarkDisplayModel } from './model.ts'

const REGION = {
  refName: 'ctgA',
  start: 0,
  end: 9_500,
  assemblyName: 'volvox',
}

const NEEDED = [
  { region: { ...REGION, start: 3_300, end: 9_400 }, displayedRegionIndex: 0 },
]

const BINNED_MARKS = [
  {
    mark: 'bar',
    transform: [{ type: 'bin', step: 1000 }],
    encoding: { y: 'count' },
  },
]

const RAW_MARKS = [{ mark: 'bar', encoding: { y: 'score' } }]

async function setup(marks: unknown[]) {
  const env = createDisplayTestEnvironment<LinearMarkDisplayModel>({
    plugins: [new LinearGenomeViewPlugin(), new WigglePlugin()],
    trackType: 'FeatureTrack',
    adapter: { name: 'BedAdapter', config: { type: 'BedAdapter' } },
    displayName: 'LinearMarkDisplay',
    configSchema: () => configSchemaFactory(),
    stateModel: (pm, schema) => stateModelFactory(pm, schema),
    viewModel: linearGenomeViewStateModelFactory,
    displayConfig: { marks },
    regions: [REGION],
    assemblyRegions: [REGION],
    onViewReady: view => {
      view.showAllRegions()
    },
    rpcCall: (_id, method) =>
      method === 'CoreEncodeFeatures'
        ? Promise.resolve({ layers: [] })
        : new Promise(() => {}),
  })
  const { display } = env.createDisplay()
  // the mount fetch covers the whole region, so the plan goes quiet and the
  // only call left to read is the one each test makes
  await waitFor(() => {
    expect(display.loadedRegions.size).toBe(1)
  })
  await waitFor(() => {
    expect(display.isLoading).toBe(false)
  })
  env.mockRpcCall.mockClear()
  return { display, mockRpcCall: env.mockRpcCall }
}

function fetchedRegion(mockRpcCall: jest.Mock) {
  const calls = mockRpcCall.mock.calls.filter(
    ([, method]) => method === 'CoreEncodeFeatures',
  )
  expect(calls).toHaveLength(1)
  return (calls[0]![2] as { region: unknown }).region
}

test('a bin step widens the fetch and the loaded span to the bin edges it straddles', async () => {
  const { display, mockRpcCall } = await setup(BINNED_MARKS)

  display.fetchNeeded(NEEDED)

  // 9_500 rather than 10_000: the displayed region bounds the widening
  await waitFor(() => {
    expect(display.loadedRegions.get(0)).toMatchObject({
      start: 3_000,
      end: 9_500,
    })
  })
  expect(fetchedRegion(mockRpcCall)).toMatchObject({ start: 3_000, end: 9_500 })
})

test('a display with no bin step fetches the span it was handed', async () => {
  const { display, mockRpcCall } = await setup(RAW_MARKS)

  display.fetchNeeded(NEEDED)

  await waitFor(() => {
    expect(display.loadedRegions.get(0)).toMatchObject({
      start: 3_300,
      end: 9_400,
    })
  })
  expect(fetchedRegion(mockRpcCall)).toMatchObject({ start: 3_300, end: 9_400 })
})
