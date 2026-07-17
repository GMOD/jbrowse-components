// Error.stackTraceLimit being V8-only is the whole subject of this file
/* eslint-disable unicorn/no-nonstandard-builtin-properties */
import { setStackTraceLimit } from './setStackTraceLimit.ts'

function deep(n: number): Error {
  return n === 0 ? new Error('boom') : deep(n - 1)
}

const frames = (e: Error) =>
  `${e.stack}`.split('\n').filter(l => l.includes('at ')).length

// V8 only; jest runs on node, so the knob is real here
test('records more frames than V8 records by default', () => {
  const original = Error.stackTraceLimit
  try {
    Error.stackTraceLimit = 10
    const shallow = frames(deep(40))

    setStackTraceLimit()
    const deepened = frames(deep(40))

    expect(shallow).toBe(10)
    expect(deepened).toBeGreaterThan(shallow)
    expect(Error.stackTraceLimit).toBe(50)
  } finally {
    Error.stackTraceLimit = original
  }
})
