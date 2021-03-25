import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import DensityRenderer, { configSchema, ReactComponent } from '.'

const pluginManager = {}
const renderer = new DensityRenderer({
  name: 'DensityRenderer',
  ReactComponent,
  configSchema,
  pluginManager,
})
test('empty', async () => {
  const result = await renderer.makeImageData({
    regions: [
      {
        end: 100,
        start: 1,
        refName: 'ctgA',
        assemblyName: 'volvox',
      },
    ],
    scaleOpts: {},
    config: {},
  })
  expect(result).toEqual({ width: 0, height: 0 })
})

test('inverted mode and reversed', async () => {
  const result = await renderer.makeImageData({
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
      inverted: true,
      scaleType: 'linear',
    },
    bpPerPx: 3,
    highResolutionScaling: 1,
    config: {},
    height: 100,
  })

  expect(result).toMatchSnapshot({
    imageData: expect.any(Object),
  })
})
