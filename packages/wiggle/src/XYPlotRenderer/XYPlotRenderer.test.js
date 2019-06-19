import SimpleFeature from '@gmod/jbrowse-core/util/simpleFeature'
import XYPlotRenderer, { configSchema, ReactComponent } from '.'

function XYPlotRendererPlugin() {
  return new XYPlotRenderer({
    name: 'XYPlotRenderer',
    ReactComponent,
    configSchema,
  })
}
test('several features', async () => {
  const result = await XYPlotRendererPlugin().makeImageData({
    features: [
      new SimpleFeature({ id: 't1', data: { start: 1, end: 100, score: 1 } }),
      new SimpleFeature({ id: 't2', data: { start: 101, end: 200, score: 2 } }),
    ],
    region: {
      end: 100,
      start: 1,
    },
    scaleOpts: {
      domain: [0, 100],
      scaleType: 'linear',
    },
    config: {},
    bpPerPx: 3,
    highResolutionScaling: 1,
    horizontallyFlipped: false,
    height: 100,
  })

  expect(result).toMatchSnapshot({
    imageData: expect.any(Object),
  })
})
