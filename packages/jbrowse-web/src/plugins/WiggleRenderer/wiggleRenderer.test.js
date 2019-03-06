import WiggleRenderer from './wiggleRenderer'

import SimpleFeature from '../../util/simpleFeature'

test('empty', async () => {
  const result = await WiggleRenderer().makeImageData({
    region: {
      end: 100,
      start: 1,
    },
    config: {},
  })
  expect(result).toEqual({ width: 0, height: 0 })
})
test('several features', async () => {
  const result = await WiggleRenderer().makeImageData({
    features: [
      new SimpleFeature({ id: 't1', data: { start: 1, end: 100, score: 1 } }),
      new SimpleFeature({ id: 't2', data: { start: 101, end: 200, score: 2 } }),
    ],
    region: {
      end: 100,
      start: 1,
    },
    yScale: {
      max: 100,
    },
    bpPerPx: 3,
    horizontallyFlipped: false,
    config: {
      height: 100,
    },
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
    yScale: {
      max: 100,
    },
    bpPerPx: 3,
    horizontallyFlipped: true,
    config: {
      height: 100,
      inverted: true,
    },
  })

  expect(result).toMatchSnapshot({
    imageData: expect.any(Object),
  })
})

test('test render', async () => {
  const result = await WiggleRenderer().makeImageData({
    features: [
      new SimpleFeature({ id: 't1', data: { start: 1, end: 100, score: 1 } }),
      new SimpleFeature({ id: 't2', data: { start: 101, end: 200, score: 2 } }),
    ],
    dataAdapter: {
      bigWigLocation: '../BigWigAdapter/test_data/volvox.bw',
    },
    region: {
      end: 100,
      start: 1,
    },
    yScale: {
      max: 100,
    },
    bpPerPx: 3,
    horizontallyFlipped: true,
    config: {
      height: 100,
      inverted: true,
    },
  })

  expect(result).toMatchSnapshot({
    imageData: expect.any(Object),
  })
})
