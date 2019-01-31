import React from 'react'
import WiggleRenderer from './wiggleRenderer'

test('one', () => {
  const result = WiggleRenderer().makeImageData({
    features: [
      { id: 'test', data: { start: 1, end: 100, score: 1 } },
      { id: 'test2', data: { start: 101, end: 200, score: 2 } },
    ],
  })

  expect(result).toMatchSnapshot()
})
