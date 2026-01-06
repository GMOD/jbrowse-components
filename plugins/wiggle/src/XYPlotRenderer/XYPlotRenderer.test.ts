import { SimpleFeature, renderToAbstractCanvas } from '@jbrowse/core/util'
import { Image, createCanvas } from 'canvas'

import configSchema from './configSchema.ts'
import { drawXY } from '../drawXY.ts'

// @ts-expect-error
global.nodeImage = Image
// @ts-expect-error
global.nodeCreateCanvas = createCanvas

test('several features', async () => {
  const features = [
    new SimpleFeature({ id: 't1', data: { start: 1, end: 100, score: 1 } }),
    new SimpleFeature({ id: 't2', data: { start: 101, end: 200, score: 2 } }),
  ]
  const config = configSchema.create()
  const renderProps = {
    features,
    regions: [
      {
        end: 100,
        start: 1,
        refName: 'ctgA',
        assemblyName: 'volvox',
      },
    ],
    scaleOpts: {
      domain: [0, 100],
      range: [0, 100],
      scaleType: 'linear' as const,
    },
    config,
    bpPerPx: 3,
    highResolutionScaling: 1,
    height: 100,
    ticks: { values: [0, 100] },
    displayCrossHatches: false,
    inverted: false,
    colorCallback: () => 'blue',
  }

  const res = await renderToAbstractCanvas(1000, 200, renderProps, ctx =>
    drawXY(ctx, renderProps),
  )
  expect(res).toMatchSnapshot({
    imageData: expect.any(Object),
  })
})
