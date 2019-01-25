import JBrowse from './JBrowse'
import { renderRegion, freeResources } from './render.worker'

const jbrowse = new JBrowse().configure()

const baseprops = {
  region: { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 800 },
  sessionId: 'knickers the cow',
  adapterType: 'BamAdapter',
  adapterConfig: {
    configId: '7Hc9NkuD4x',
    type: 'BamAdapter',
    bamLocation: {
      path: require.resolve('../public/test_data/volvox-sorted.bam'),
    },
    index: {
      configId: 'sGW8va26pr',
      location: {
        path: require.resolve('../public/test_data/volvox-sorted.bam.bai'),
      },
    },
  },
  rootConfig: {},
  renderProps: { bpPerPx: 1 },
}

test('can render a single region with Pileup + BamAdapter', async () => {
  const testprops = { rendererType: 'PileupRenderer', ...baseprops }

  const result = await renderRegion(jbrowse.pluginManager, testprops)
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
    freeResources(jbrowse.pluginManager, {
      sessionId: 'knickers the cow',
    }),
  ).toBe(2)

  expect(
    freeResources(jbrowse.pluginManager, {
      sessionId: 'fozzy bear',
    }),
  ).toBe(0)
})

test('can render a single region with SvgFeatures + BamAdapter', async () => {
  const testprops = {
    ...baseprops,
    rendererType: 'SvgFeatureRenderer',
    region: { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 300 },
  }

  const result = await renderRegion(jbrowse.pluginManager, testprops)
  expect(new Set(Object.keys(result))).toEqual(
    new Set(['html', 'features', 'layout']),
  )
  expect(result.features.length).toBe(25)
  expect(result.html).toMatchSnapshot()
  expect(result.layout).toMatchSnapshot()

  expect(
    freeResources(jbrowse.pluginManager, {
      sessionId: 'knickers the cow',
    }),
  ).toBe(2)

  expect(
    freeResources(jbrowse.pluginManager, {
      sessionId: 'fozzy bear',
    }),
  ).toBe(0)
})
