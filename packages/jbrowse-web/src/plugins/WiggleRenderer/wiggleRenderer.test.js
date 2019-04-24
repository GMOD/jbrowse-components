import WiggleRenderer from './wiggleRenderer'

import SimpleFeature from '../../util/simpleFeature'

test('empty', async () => {
  const result = await WiggleRenderer().makeImageData({
    region: {
      end: 100,
      start: 1,
    },
    scaleOpts: {},
    config: {},
  })
  expect(result).toEqual({ width: 0, height: 0 })
})
test('several features', async () => {
  const canvas = document.create
  const result = await WiggleRenderer().makeImageData({
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

test('inverted mode and horizontally flipped', async () => {
  const result = await WiggleRenderer().makeImageData({
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
      inverted: true,
      scaleType: 'linear',
    },
    bpPerPx: 3,
    highResolutionScaling: 1,
    config: {},
    horizontallyFlipped: true,
    height: 100,
  })

  expect(result).toMatchSnapshot({
    imageData: expect.any(Object),
  })
})
