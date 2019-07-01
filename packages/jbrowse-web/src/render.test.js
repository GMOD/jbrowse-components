import { createTestEnv } from './JBrowse'
import { renderRegion, freeResources } from './rpcMethods'

let pluginManager
beforeAll(async () => {
  ;({ pluginManager } = await createTestEnv())
})

const baseprops = {
  region: { refName: 'ctgA', start: 0, end: 800 },
  sessionId: 'knickers the cow',
  adapterType: 'BamAdapter',
  adapterConfig: {
    configId: '7Hc9NkuD4x',
    type: 'BamAdapter',
    bamLocation: {
      localPath: require.resolve('../public/test_data/volvox-sorted.bam'),
    },
    index: {
      configId: 'sGW8va26pr',
      location: {
        localPath: require.resolve('../public/test_data/volvox-sorted.bam.bai'),
      },
    },
  },
  rootConfig: {},
  renderProps: { bpPerPx: 1 },
}

test('can render a single region with Pileup + BamAdapter', async () => {
  const testprops = { ...baseprops, rendererType: 'PileupRenderer' }

  const result = await renderRegion(pluginManager, testprops)
  expect(new Set(Object.keys(result))).toEqual(
    new Set(['features', 'html', 'layout', 'height', 'width', 'imageData']),
  )
  expect(result.features.length).toBe(93)
  expect(result.html).toMatchSnapshot()
  expect(result.layout).toMatchSnapshot()
  expect(result.imageData.width).toBe(800)
  expect(result.imageData.height).toBe(result.layout.totalHeight)
  expect(result.width).toBe(800)
  expect(result.height).toBe(result.layout.totalHeight)

  expect(
    freeResources(pluginManager, {
      sessionId: 'knickers the cow',
    }),
  ).toBe(2)

  expect(
    freeResources(pluginManager, {
      sessionId: 'fozzy bear',
    }),
  ).toBe(0)
})

test('can render a single region with SvgFeatures + BamAdapter', async () => {
  const testprops = {
    ...baseprops,
    rendererType: 'SvgFeatureRenderer',
    region: { refName: 'ctgA', start: 0, end: 300 },
  }

  const result = await renderRegion(pluginManager, testprops)
  expect(new Set(Object.keys(result))).toEqual(
    new Set(['html', 'features', 'layout']),
  )
  expect(result.features.length).toBe(93)
  expect(result.html).toMatchSnapshot()
  expect(result.layout).toMatchSnapshot()

  expect(
    freeResources(pluginManager, {
      sessionId: 'knickers the cow',
    }),
  ).toBe(2)

  expect(
    freeResources(pluginManager, {
      sessionId: 'fozzy bear',
    }),
  ).toBe(0)
})

test('throws if no session ID', async () => {
  const testprops = {
    ...baseprops,
    rendererType: 'PileupRenderer',
    sessionId: undefined,
  }

  await expect(renderRegion(pluginManager, testprops)).rejects.toThrow(
    /must pass a unique session id/,
  )
})

test('throws on unrecoginze worker', async () => {
  const testprops = {
    ...baseprops,
    rendererType: 'NonexistentRenderer',
  }

  await expect(renderRegion(pluginManager, testprops)).rejects.toThrow(
    /renderer "NonexistentRenderer" not found/,
  )
})
