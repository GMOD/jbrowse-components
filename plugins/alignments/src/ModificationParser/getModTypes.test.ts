import { getModTypes } from './getModTypes'
import { test, expect } from 'vitest'

test('getModTypes', () => {
  expect(getModTypes('C+m,')).toMatchSnapshot()
  expect(getModTypes('C+mh,')).toMatchSnapshot()
  expect(getModTypes('C+16061,')).toMatchSnapshot()
})
