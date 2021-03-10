import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import SNPCoverageRenderer, { configSchema, ReactComponent } from '.'

test('several features', async () => {
  const pluginManager = {}
  const renderer = new SNPCoverageRenderer({
    name: 'SNPCoverageRenderer',
    ReactComponent,
    configSchema,
    pluginManager,
  })
  const result = await renderer.makeImageData({
    features: new Map([
      [
        't1',
        new SimpleFeature({
          id: 't1',
          data: {
            start: 1,
            end: 100,
            score: 1,
            snpinfo: [
              { base: 'reference', score: 2, strands: { '-': 1, '+': 1 } },
              { base: 'total', score: 2 },
            ],
          },
        }),
      ],
      [
        't2',
        new SimpleFeature({
          id: 't2',
          data: {
            start: 101,
            end: 200,
            score: 3,
            snpinfo: [
              { base: 'reference', score: 2, strands: { '-': 1, '+': 1 } },
              { base: 'A', score: 1, strands: { '-': 1 } },
              { base: 'total', score: 3 },
            ],
          },
        }),
      ],
    ]),
    regions: [{ refName: 'ctgA', assemblyName: 'volvox', end: 100, start: 1 }],
    scaleOpts: {
      domain: [0, 50],
      scaleType: 'linear',
      range: [0, 50],
      inverted: false,
    },
    bpPerPx: 3,
    highResolutionScaling: 1,
    height: 100,
    config: {},
    ticks: { values: [0, 100] },
  })

  expect(result).toMatchSnapshot({
    imageData: expect.any(Object),
  })
})
