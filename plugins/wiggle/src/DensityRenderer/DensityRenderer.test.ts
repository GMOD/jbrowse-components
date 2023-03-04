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
  name: 'DensityRenderer',
  ReactComponent,
  configSchema,
  pluginManager,
})

test('inverted mode and reversed', async () => {
  const renderProps = {
    features: [
      new SimpleFeature({ id: 't1', data: { start: 1, end: 100, score: 1 } }),
      new SimpleFeature({ id: 't2', data: { start: 101, end: 200, score: 2 } }),
    ],
    regions: [
      {
        end: 100,
        start: 1,
        reversed: true,
        refName: 'ctgA',
        assemblyName: 'volvox',
      },
    ],
    scaleOpts: {
      domain: [0, 100],
      range: [0, 200],
      inverted: true,
      scaleType: 'linear',
    },
    config: {
      posColor: 'red',
      negColor: 'blue',
    },
    bpPerPx: 3,
    highResolutionScaling: 1,
    height: 100,
  }

  const res = await renderToAbstractCanvas(1000, 200, renderProps, ctx =>
    // @ts-expect-error
    renderer.draw(ctx, renderProps),
  )
  expect(res).toMatchSnapshot({
    imageData: expect.any(Object),
  })
})
