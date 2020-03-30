import SimpleFeature from '@gmod/jbrowse-core/util/simpleFeature'
import Layout from '@gmod/jbrowse-core/util/layouts/GranularRectLayout'
import DensityRenderer, { configSchema, ReactComponent } from '.'

function DensityRendererPlugin() {
  return new DensityRenderer({
    name: 'DensityRenderer',
    ReactComponent,
    configSchema,
  })
}

test('empty', async () => {
  const result = await DensityRendererPlugin().makeImageData({
    layout: new Layout(),
    features: new Map(),
    region: {
      end: 100,
      start: 1,
      refName: 'ctgA',
      assemblyName: 'volvox',
    },
    scaleOpts: {
      domain: [0, 100],
      range: [0, 100],
      scaleType: 'linear',
    },
    config: {},
    bpPerPx: 3,
    highResolutionScaling: 1,
    horizontallyFlipped: false,
    height: 100,
    width: 800,
    blockKey: 'test',
  })
  expect(result).toEqual({ width: 0, height: 0 })
})

test('inverted mode and horizontally flipped', async () => {
  const result = await DensityRendererPlugin().makeImageData({
    layout: new Layout(),
    features: new Map([
      [
        't1',
        new SimpleFeature({ id: 't1', data: { start: 1, end: 100, score: 1 } }),
      ],
      [
        't2',
        new SimpleFeature({
          id: 't2',
          data: { start: 101, end: 200, score: 2 },
        }),
      ],
    ]),
    region: {
      end: 100,
      start: 1,
      refName: 'ctgA',
      assemblyName: 'volvox',
    },
    scaleOpts: {
      domain: [0, 100],
      range: [0, 100],
      scaleType: 'linear',
    },
    config: {},
    bpPerPx: 3,
    highResolutionScaling: 1,
    horizontallyFlipped: false,
    height: 100,
    width: 800,
    blockKey: 'test',
  })

  expect(result).toMatchSnapshot({
    imageData: expect.any(Object),
  })
})
