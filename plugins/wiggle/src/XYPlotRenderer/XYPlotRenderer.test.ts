import { SimpleFeature, renderToAbstractCanvas } from '@jbrowse/core/util'
import { Image, createCanvas } from 'canvas'

// locals
import XYPlotRenderer from './XYPlotRenderer'
import configSchema from './configSchema'
import ReactComponent from '../WiggleRendering'

// @ts-expect-error
global.nodeImage = Image
// @ts-expect-error
global.nodeCreateCanvas = createCanvas

test('several features', async () => {
  const pluginManager = {} as any
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
    // @ts-expect-error
    renderer.draw(ctx, renderProps),
  )
  expect(res).toMatchSnapshot({
    imageData: expect.any(Object),
  })
})
