import SimpleFeature from './simpleFeature'

test('can create a simple feature', () => {
  const f = new SimpleFeature({
    end: 200,
    start: 100,
    uniqueId: 'test',
  })
  expect(f.id()).toEqual('test')
  expect(f.get('start')).toEqual(100)
  expect(f.get('end')).toEqual(200)
})

test('can create a simple with subfeatures', () => {
  const f = new SimpleFeature({
    end: 500,
    start: 100,
    subfeatures: [
      { end: 200, start: 100 },
      { end: 500, start: 400 },
    ],
    uniqueId: 'test',
  })
  expect(f.id()).toEqual('test')
  expect(f.get('start')).toEqual(100)
  expect(f.get('end')).toEqual(500)
  expect(f.get('subfeatures')[0].get('start')).toEqual(100)
})
