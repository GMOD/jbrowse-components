import { moveUp, moveDown } from './util'

test('moves elements up once', () => {
  let elts = [{ name: 'k1' }, { name: 'k2' }, { name: 'k3' }, { name: 'k4' }]
  elts = moveUp(elts, ['k2', 'k3'])
  expect(elts).toEqual([
    { name: 'k2' },
    { name: 'k3' },
    { name: 'k1' },
    { name: 'k4' },
  ])
})

test('moves elements up twice', () => {
  let elts = [{ name: 'k1' }, { name: 'k2' }, { name: 'k3' }, { name: 'k4' }]
  elts = moveUp(elts, ['k2', 'k3'])
  elts = moveUp(elts, ['k2', 'k3'])
  expect(elts).toEqual([
    { name: 'k2' },
    { name: 'k3' },
    { name: 'k1' },
    { name: 'k4' },
  ])
})

test('moves elements down once', () => {
  let elts = [{ name: 'k1' }, { name: 'k2' }, { name: 'k3' }, { name: 'k4' }]
  elts = moveDown(elts, ['k2', 'k3'])
  expect(elts).toEqual([
    { name: 'k1' },
    { name: 'k4' },
    { name: 'k2' },
    { name: 'k3' },
  ])
})

test('moves elements down twice', () => {
  let elts = [{ name: 'k1' }, { name: 'k2' }, { name: 'k3' }, { name: 'k4' }]
  elts = moveDown(elts, ['k2', 'k3'])
  elts = moveDown(elts, ['k2', 'k3'])
  expect(elts).toEqual([
    { name: 'k1' },
    { name: 'k4' },
    { name: 'k2' },
    { name: 'k3' },
  ])
})
