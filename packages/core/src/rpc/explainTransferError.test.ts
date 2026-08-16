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

// Both of these pin MAX_DEPTH from below, and each was found the same way: too
// short, the walk reports every entry of a long list as "not in the payload",
// which reads as a bug in the transfer list rather than in the walk. At 2 the
// alignments result reported all 86 of its buffers that way; at 3 the variant
// one reported all 109 of its genotype-code arrays, and the test-only check in
// rpcResult threw, taking the fetch behind the matrix and the SVG export.
test('reaches a buffer three containers down, as the alignments result is', () => {
  const starts = new Uint32Array(4)
  const mismatchStarts = new Uint32Array(4)
  const value = {
    groups: [{ data: { starts } }, { data: { mismatchStarts } }],
  }

  const { message } = explainTransferError(detached(1), value, [
    starts.buffer,
    mismatchStarts.buffer,
  ]) as Error

  expect(message).toContain('index 1 is groups.1.data.mismatchStarts')
})

test('reaches a buffer four containers down, as the variant result is', () => {
  const genotypeCodes = new Uint32Array(4)
  const value = {
    perRegionCellData: {
      0: { featureGenotypeMap: { 'feat-1': { genotypeCodes } } },
    },
  }

  const { message } = explainTransferError(detached(0), value, [
    genotypeCodes.buffer,
  ]) as Error

  expect(message).toContain(
    'index 0 is perRegionCellData.0.featureGenotypeMap.feat-1.genotypeCodes',
  )
})

test('terminates on a cyclic payload', () => {
  const value: Record<string, unknown> = { starts: new Uint32Array(4) }
  value.self = value

  const { message } = explainTransferError(detached(0), value, [
    (value.starts as Uint32Array).buffer,
  ]) as Error

  expect(message).toContain('index 0 is starts')
})

// The counts are the whole content of this branch: "2 of 3 are" says the list
// names one buffer the result does not carry, which is a bug in the list. A low
// count would instead say the walk does not cover this payload's shape.
test('reports a buffer the walk cannot reach, with the two counts', () => {
  const value = { starts: new Uint32Array(4), ends: new Uint32Array(4) }
  const orphan = new ArrayBuffer(8)

  const { message } = explainTransferError(detached(2), value, [
    value.starts.buffer,
    value.ends.buffer,
    orphan,
  ]) as Error

  expect(message).toContain(
    'index 2 is not in the payload (2 of 3 entries are)',
  )
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

// Which method built the list is not on the stack — the post runs in a `.then`
// off the method's promise — and a transfer list is only locatable once you know
// which one it is.
test('names the method that built the list', () => {
  const value = { starts: new Uint32Array(4) }

  const { message } = explainTransferError(
    detached(0),
    value,
    [value.starts.buffer],
    'SyntenyGetFeaturesAndPositions',
  ) as Error

  expect(message).toContain('SyntenyGetFeaturesAndPositions: index 0 is starts')
})
