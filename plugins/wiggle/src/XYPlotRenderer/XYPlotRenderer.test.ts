import { SimpleFeature, renderToAbstractCanvas } from '@jbrowse/core/util'
import { Image, createCanvas } from 'canvas'

// locals
import configSchema from './configSchema'
import XYPlotRenderer from './XYPlotRenderer'
import ReactComponent from '../WiggleRendering'

// @ts-expect-error
global.nodeImage = Image
// @ts-expect-error
global.nodeCreateCanvas = createCanvas

test('several features', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pluginManager = {} as any
  const renderer = new XYPlotRenderer({
    ReactComponent,
    configSchema,
    name: 'XYPlotRenderer',
    pluginManager,
  })
  const renderProps = {
    bpPerPx: 3,
    config: {},
    features: [
      new SimpleFeature({ data: { end: 100, score: 1, start: 1 }, id: 't1' }),
      new SimpleFeature({ data: { end: 200, score: 2, start: 101 }, id: 't2' }),
    ],
    height: 100,
    highResolutionScaling: 1,
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
