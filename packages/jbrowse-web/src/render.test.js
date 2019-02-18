import JBrowse from './JBrowse'
import { renderRegion, freeResources } from './render'

const jbrowse = new JBrowse().configure()

const baseprops = {
  region: { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 800 },
  sessionId: 'knickers the cow',
  adapterType: 'BamAdapter',
  adapterConfig: {
    configId: '7Hc9NkuD4x',
    type: 'BamAdapter',
    assemblyName: 'volvox',
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

test('can regularize an assembly name from an alias', async () => {
  const testprops = {
    ...baseprops,
    rendererType: 'PileupRenderer',
    region: { assemblyName: 'vvx', refName: 'ctgA', start: 0, end: 800 },
    rootConfig: { assemblies: { volvox: { aliases: ['vvx'] } } },
  }

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

test('can regularize an assembly name to an alias', async () => {
  const testprops = {
    ...baseprops,
    rendererType: 'PileupRenderer',
    region: { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 800 },
    rootConfig: { assemblies: { vvx: { aliases: ['volvox'] } } },
  }

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

test('can regularize a reference sequence name from an alias', async () => {
  const testprops = {
    ...baseprops,
    rendererType: 'PileupRenderer',
    region: { assemblyName: 'volvox', refName: 'contigA', start: 0, end: 800 },
    rootConfig: {
      assemblies: {
        volvox: { seqNameAliases: { ctgA: ['contigA'] } },
      },
    },
  }

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

test('can regularize a reference sequence name to an alias', async () => {
  const testprops = {
    ...baseprops,
    rendererType: 'PileupRenderer',
    region: { assemblyName: 'volvox', refName: 'contigA', start: 0, end: 800 },
    rootConfig: {
      assemblies: {
        volvox: { seqNameAliases: { contigA: ['ctgA'] } },
      },
    },
  }

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

test('throws if no session ID', async () => {
  const testprops = {
    ...baseprops,
    rendererType: 'PileupRenderer',
    sessionId: undefined,
  }

  await expect(renderRegion(jbrowse.pluginManager, testprops)).rejects.toThrow(
    /must pass a unique session id/,
  )
})

test('throws on unrecoginze worker', async () => {
  const testprops = {
    ...baseprops,
    rendererType: 'NonexistentRenderer',
  }

  await expect(renderRegion(jbrowse.pluginManager, testprops)).rejects.toThrow(
    /renderer "NonexistentRenderer" not found/,
  )
})
