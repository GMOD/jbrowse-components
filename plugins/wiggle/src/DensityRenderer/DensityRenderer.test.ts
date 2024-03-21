import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { renderToAbstractCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'
import DensityRenderer from './DensityRenderer'
import configSchema from './configSchema'
import ReactComponent from '../WiggleRendering'

import { Image, createCanvas } from 'canvas'

// @ts-expect-error
global.nodeImage = Image

// @ts-expect-error
global.nodeCreateCanvas = createCanvas

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pluginManager = {} as any

const renderer = new DensityRenderer({
  ReactComponent,
  configSchema,
  name: 'DensityRenderer',
  pluginManager,
})

test('inverted mode and reversed', async () => {
  const renderProps = {
    bpPerPx: 3,
    config: {
      negColor: 'blue',
      posColor: 'red',
    },
    features: [
      new SimpleFeature({ data: { end: 100, score: 1, start: 1 }, id: 't1' }),
      new SimpleFeature({ data: { end: 200, score: 2, start: 101 }, id: 't2' }),
    ],
    height: 100,
    highResolutionScaling: 1,
    regions: [
      {
        assemblyName: 'volvox',
        end: 100,
        refName: 'ctgA',
        reversed: true,
        start: 1,
      },
    ],
    scaleOpts: {
      domain: [0, 100],
      inverted: true,
      range: [0, 200],
      scaleType: 'linear',
    },
  }

  const res = await renderToAbstractCanvas(1000, 200, renderProps, ctx =>
    // @ts-expect-error
    renderer.draw(ctx, renderProps),
  )
  expect(res).toMatchSnapshot({
    imageData: expect.any(Object),
  })
})
