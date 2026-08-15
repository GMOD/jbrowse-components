import { explainTransferError } from './explainTransferError.ts'

// The messages below are Chrome's own, copied off a real worker rather than
// paraphrased — the whole function keys on the index in them, so a paraphrase
// would test nothing. `products/jbrowse-web/browser-tests/suites/transfer-list-
// diagnostics.ts` is what pins them to the browser.
const detached = (i: number) =>
  new DOMException(
    `Failed to execute 'postMessage' on 'DedicatedWorkerGlobalScope': ArrayBuffer at index ${i} is already detached.`,
    'DataCloneError',
  )

test('names the field at the index the browser blamed', () => {
  const value = {
    starts: new Uint32Array(4),
    instanceData: {
      kinds: new Uint8Array(4),
      instanceFeatureIdx: new Uint32Array(4),
    },
  }
  const list = [
    value.starts.buffer,
    value.instanceData.kinds.buffer,
    value.instanceData.instanceFeatureIdx.buffer,
  ]

  const { message } = explainTransferError(detached(2), value, list) as Error

  expect(message).toContain('already detached')
  expect(message).toContain('index 2 is instanceData.instanceFeatureIdx')
})

// A duplicate is the one thing Chrome half-answers: it says an entry duplicates
// "an earlier ArrayBuffer" without saying which, and neither end is named. Both
// fields share one allocation, so both are worth printing.
test('a duplicate names the earlier index and every field sharing the buffer', () => {
  const shared = new Float32Array(8)
  const value = { a: shared.subarray(0, 4), b: shared.subarray(4, 8) }
  const duplicate = new DOMException(
    "Failed to execute 'postMessage' on 'DedicatedWorkerGlobalScope': ArrayBuffer at index 1 is a duplicate of an earlier ArrayBuffer.",
    'DataCloneError',
  )

  const { message } = explainTransferError(duplicate, value, [
    value.a.buffer,
    value.b.buffer,
  ]) as Error

  expect(message).toContain('index 1 repeats index 0')
  expect(message).toContain('a, b')
})

// An unserializable payload fails with no index in it, and appending a report
// about transfers to that would send the next reader somewhere wrong.
test('leaves an error that blames no index alone', () => {
  const value = { fn: () => {} }
  const error = new DOMException(
    "Failed to execute 'postMessage' on 'DedicatedWorkerGlobalScope': () => {} could not be cloned.",
    'DataCloneError',
  )

  expect(explainTransferError(error, value, [])).toBe(error)
})

// An index the list does not have means the wording moved under us. Better to
// hand back the browser's own error than to print "index 7 is undefined".
test('leaves an index past the end of the list alone', () => {
  const error = detached(7)

  expect(explainTransferError(error, {}, [new Uint32Array(1).buffer])).toBe(
    error,
  )
})

test('reports a buffer the walk cannot reach rather than dropping it', () => {
  const orphan = new ArrayBuffer(8)

  const { message } = explainTransferError(detached(0), { nothing: 1 }, [
    orphan,
  ]) as Error

  expect(message).toContain('index 0 is not reachable from the payload')
})

// The annotation has to survive serializeError, which reads name/message/stack
// off the Error — a plain `new Error(...)` would relabel a DataCloneError as
// "Error" and drop the throw site.
test('keeps the browser error name and the original stack', () => {
  const error = detached(0)
  const value = { starts: new Uint32Array(4) }

  const annotated = explainTransferError(error, value, [
    value.starts.buffer,
  ]) as Error

  expect(annotated.name).toBe('DataCloneError')
  expect(annotated.stack).toBe(error.stack)
})

test('passes a non-Error rejection straight through', () => {
  expect(explainTransferError('nope', {}, [])).toBe('nope')
})
