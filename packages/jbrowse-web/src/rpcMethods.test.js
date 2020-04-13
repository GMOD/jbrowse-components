import { createTestSession } from './rootModel'
import { render, freeResources } from './rpcMethods'

let pluginManager
beforeAll(() => {
  ;({ pluginManager } = createTestSession())
})

const baseprops = {
  regions: [{ refName: 'ctgA', start: 0, end: 800 }],
  sessionId: 'knickers the cow',
  adapterType: 'BamAdapter',
  adapterConfig: {
    type: 'BamAdapter',
    bamLocation: {
      localPath: require.resolve('../public/test_data/volvox-sorted.bam'),
    },
    index: {
      location: {
        localPath: require.resolve('../public/test_data/volvox-sorted.bam.bai'),
      },
    },
  },
  sessionConfig: {},
  renderProps: { bpPerPx: 1 },
}

test('can render a single region with Pileup + BamAdapter', async () => {
  const testprops = { ...baseprops, rendererType: 'PileupRenderer' }

  const result = await render(pluginManager, testprops)
  expect(new Set(Object.keys(result))).toEqual(
    new Set([
      'features',
      'html',
      'layout',
      'height',
      'width',
      'imageData',
      'maxHeightReached',
    ]),
  )
  expect(result.maxHeightReached).toBe(false)
  expect(result.features.length).toBe(93)
  expect(result.html).toMatchSnapshot()
  expect(result.maxHeightReached).toBe(false)
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
    regions: [{ refName: 'ctgA', start: 0, end: 300 }],
  }

  const result = await render(pluginManager, testprops)
  expect(new Set(Object.keys(result))).toEqual(
    new Set(['html', 'features', 'layout', 'maxHeightReached']),
  )
  expect(result.maxHeightReached).toBe(true)
  expect(result.features.length).toBe(71)
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

  await expect(render(pluginManager, testprops)).rejects.toThrow(
    /must pass a unique session id/,
  )
})
test('can render a single region with SvgFeatures + BamAdapter (larger maxHeight)', async () => {
  const testprops = {
    ...baseprops,
    rendererType: 'SvgFeatureRenderer',
    regions: [{ refName: 'ctgA', start: 0, end: 300 }],
  }
  testprops.renderProps.config = { maxHeight: 5000 }

  const result = await render(pluginManager, testprops)
  expect(new Set(Object.keys(result))).toEqual(
    new Set(['html', 'features', 'layout', 'maxHeightReached']),
  )
  expect(result.maxHeightReached).toBe(false)
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

  await expect(render(pluginManager, testprops)).rejects.toThrow(
    /must pass a unique session id/,
  )
})
test('throws on unrecoginze worker', async () => {
  const testprops = {
    ...baseprops,
    rendererType: 'NonexistentRenderer',
  }

  await expect(render(pluginManager, testprops)).rejects.toThrow(
    /renderer "NonexistentRenderer" not found/,
  )
})
