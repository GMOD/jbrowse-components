import createCache from '@emotion/cache'

import { createCssAndCx } from './cssAndCx.ts'

function setup() {
  const cache = createCache({ key: 'css' })
  return { cache, ...createCssAndCx({ cache }) }
}

test('css returns a cache-keyed class and inserts the rule', () => {
  const { css, cache } = setup()
  const cls = css({ color: 'red' })
  expect(cls.startsWith('css-')).toBe(true)
  expect(cache.registered[cls]).toBeDefined()
})

test('css is stable for equal style objects', () => {
  const { css } = setup()
  expect(css({ color: 'red' })).toBe(css({ color: 'red' }))
})

test('cx joins plain class names and drops falsy args', () => {
  const { cx } = setup()
  expect(cx('a', false, undefined, 'c')).toBe('a c')
})

test('cx merges two emotion classes into one combined class', () => {
  const { css, cx, cache } = setup()
  const a = css({ color: 'red' })
  const b = css({ color: 'blue' })
  const merged = cx(a, b)

  // two registered styles collapse into a single new emotion class
  expect(merged.split(' ')).toHaveLength(1)
  expect(merged).not.toBe(a)
  expect(merged).not.toBe(b)
  expect(cache.registered[merged]).toBeDefined()
})

test('cx passes a single emotion class through unchanged', () => {
  const { css, cx } = setup()
  const a = css({ color: 'red' })
  expect(cx(a)).toBe(a)
})

test('cx supports the object form', () => {
  const { cx } = setup()
  expect(cx('base', { on: true, off: false })).toBe('base on')
})
