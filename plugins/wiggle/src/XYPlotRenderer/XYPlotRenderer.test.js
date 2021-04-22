import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { renderToAbstractCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'
import XYPlotRenderer, { configSchema, ReactComponent } from '.'

test('several features', async () => {
  const pluginManager = {}
  const renderer = new XYPlotRenderer({
    name: 'XYPlotRenderer',
    ReactComponent,
    configSchema,
    pluginManager,
  })
  const renderProps = {
    features: [
      new SimpleFeature({ id: 't1', data: { start: 1, end: 100, score: 1 } }),
      new SimpleFeature({ id: 't2', data: { start: 101, end: 200, score: 2 } }),
    ],
    regions: [
      {
        end: 100,
        start: 1,
      },
    ],
    scaleOpts: {
      domain: [0, 100],
      scaleType: 'linear',
    },
    config: {},
    bpPerPx: 3,
    highResolutionScaling: 1,
    height: 100,
    ticks: { values: [0, 100] },
  }

  const res = await renderToAbstractCanvas(1000, 200, renderProps, ctx =>
    renderer.draw(ctx, renderProps),
  )
  expect(res).toMatchSnapshot({
    imageData: expect.any(Object),
  })
})
