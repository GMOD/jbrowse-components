import { formatErrorStack } from './formatErrorStack.ts'

function err(message: string, stack: string, cause?: unknown) {
  const e = new Error(message, cause === undefined ? undefined : { cause })
  e.stack = stack
  return e
}

test('strips the message and returns the frames', () => {
  const e = err(
    'x is not a function',
    'Error: x is not a function\n    at foo (file.js:1:1)',
  )
  expect(formatErrorStack(e)).toBe('    at foo (file.js:1:1)')
})

test('returns empty for an error with no stack', () => {
  expect(formatErrorStack({ message: 'no stack here' })).toBe('')
})

test.each([undefined, null, ''])('returns empty for %s', v => {
  expect(formatErrorStack(v)).toBe('')
})

// the wrapper's frames point at the machinery that caught the error; the cause
// holds the frames of what actually broke
test('appends the cause chain', () => {
  const inner = err(
    'inner boom',
    'Error: inner boom\n    at deep (file.js:9:9)',
  )
  const outer = err('outer', 'Error: outer\n    at wrap (file.js:2:2)', inner)
  expect(formatErrorStack(outer)).toBe(
    [
      '    at wrap (file.js:2:2)',
      'Caused by: Error: inner boom',
      '    at deep (file.js:9:9)',
    ].join('\n'),
  )
})

test('walks a multi-level chain', () => {
  const a = err('a', 'Error: a\n    at a (file.js:1:1)')
  const b = err('b', 'Error: b\n    at b (file.js:2:2)', a)
  const c = err('c', 'Error: c\n    at c (file.js:3:3)', b)
  expect(formatErrorStack(c)).toBe(
    [
      '    at c (file.js:3:3)',
      'Caused by: Error: b',
      '    at b (file.js:2:2)',
      'Caused by: Error: a',
      '    at a (file.js:1:1)',
    ].join('\n'),
  )
})

// firefox stacks carry no message prefix, so the label must not run into the
// first frame
test('separates the label from a firefox-style stack', () => {
  const inner = err('inner boom', 'deep@file.js:9:9')
  const outer = err('outer', 'wrap@file.js:2:2', inner)
  expect(formatErrorStack(outer)).toBe(
    [
      'wrap@file.js:2:2',
      'Caused by: Error: inner boom',
      'deep@file.js:9:9',
    ].join('\n'),
  )
})

test('labels a non-Error cause', () => {
  const e = err(
    'outer',
    'Error: outer\n    at wrap (file.js:2:2)',
    'a string reason',
  )
  expect(formatErrorStack(e)).toBe(
    '    at wrap (file.js:2:2)\nCaused by: a string reason',
  )
})

test('terminates on a cyclic cause chain', () => {
  const a = err('a', 'Error: a\n    at a (file.js:1:1)')
  const b = err('b', 'Error: b\n    at b (file.js:2:2)', a)
  a.cause = b
  expect(formatErrorStack(b)).toBe(
    [
      '    at b (file.js:2:2)',
      'Caused by: Error: a',
      '    at a (file.js:1:1)',
    ].join('\n'),
  )
})

// an AggregateError's own frames only name the collector (PhasedScheduler), so
// without walking .errors the failing plugin never appears in the stack dialog
test('expands the sub-errors of an AggregateError', () => {
  const a = err(
    'plugin a failed',
    'Error: plugin a failed\n    at a (a.js:1:1)',
  )
  const b = err(
    'plugin b failed',
    'Error: plugin b failed\n    at b (b.js:2:2)',
  )
  const aggregate = new AggregateError([a, b], 'Errors during creation')
  aggregate.stack =
    'AggregateError: Errors during creation\n    at run (s.js:3:3)'
  expect(formatErrorStack(aggregate)).toBe(
    [
      '    at run (s.js:3:3)',
      'Aggregated error: Error: plugin a failed',
      '    at a (a.js:1:1)',
      'Aggregated error: Error: plugin b failed',
      '    at b (b.js:2:2)',
    ].join('\n'),
  )
})

test('walks the cause of an aggregated sub-error', () => {
  const root = err('root cause', 'Error: root cause\n    at root (r.js:1:1)')
  const sub = err(
    'plugin failed',
    'Error: plugin failed\n    at p (p.js:2:2)',
    root,
  )
  const aggregate = new AggregateError([sub], 'Errors during creation')
  aggregate.stack =
    'AggregateError: Errors during creation\n    at run (s.js:3:3)'
  expect(formatErrorStack(aggregate)).toContain('Caused by: Error: root cause')
})

test('caps a pathologically long chain', () => {
  let e = err('root', 'Error: root\n    at root (file.js:1:1)')
  for (let i = 0; i < 50; i++) {
    e = err(`wrap${i}`, `Error: wrap${i}\n    at w (file.js:1:1)`, e)
  }
  expect(formatErrorStack(e).split('Caused by:')).toHaveLength(10)
})

// the tests above set .stack by hand; this one uses real thrown errors to keep
// the message-stripping honest against actual V8 output
test('handles real thrown errors end to end', () => {
  function throwsDeep(): never {
    throw new Error('ENOENT: file missing')
  }
  function wraps() {
    try {
      throwsDeep()
    } catch (e) {
      throw new Error('Failed to load track config', { cause: e })
    }
  }
  let caught: unknown
  try {
    wraps()
  } catch (e) {
    caught = e
  }

  const out = formatErrorStack(caught)
  // the wrapper's own message is stripped, its frames are kept
  expect(out).not.toMatch(/^Error: Failed to load track config/)
  expect(out).toContain('at wraps')
  // and the cause — the part that says what actually broke — survives
  expect(out).toContain('Caused by: Error: ENOENT: file missing')
  expect(out).toContain('at throwsDeep')
})
