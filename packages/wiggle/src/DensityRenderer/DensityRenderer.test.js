import SimpleFeature from '@gmod/jbrowse-core/util/simpleFeature'
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
    regions: [
      {
        end: 100,
        start: 1,
        refName: 'ctgA',
        assemblyName: 'volvox',
      },
    ],
    features: new Map(),
    bpPerPx: 3,
    height: 100,
    highResolutionScaling: 1,
    scaleOpts: {
      domain: [0, 100],
      range: [0, 100],
      inverted: true,
      scaleType: 'linear',
    },
    config: configSchema.create({}),
  })
  expect(result).toEqual({ width: 0, height: 0 })
})

test('inverted mode and reversed', async () => {
  const result = await DensityRendererPlugin().makeImageData({
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
      range: [0, 100],
      inverted: true,
      scaleType: 'linear',
    },
    bpPerPx: 3,
    highResolutionScaling: 1,
    config: configSchema.create({}),
    height: 100,
  })

  expect(result).toMatchSnapshot({
    imageData: expect.any(Object),
  })
})
