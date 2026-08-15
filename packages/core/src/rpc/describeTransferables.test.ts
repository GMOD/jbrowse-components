import { describeTransferables } from './describeTransferables.ts'

// The failure this exists for reads, in full: "DataCloneError: Failed to execute
// 'postMessage' on 'DedicatedWorkerGlobalScope': ArrayBuffer at index 19 is
// already detached". An index into a hand-assembled list is not actionable —
// working out what index 19 was took counting the list's layout out of source,
// and the layout moves with the track's attribute-channel count.

function detach(buffer: ArrayBuffer) {
  // transfer() is how a buffer gets detached without a worker; the returned
  // copy is discarded and the original is left in the state postMessage would
  // have put it in
  buffer.transfer()
  return buffer
}

test('names the field, not the index, for a buffer detached earlier', () => {
  const dead = detach(new Uint32Array(4).buffer)
  const value = {
    starts: new Uint32Array(4),
    instanceData: { kinds: new Uint8Array(4), instanceFeatureIdx: dead },
  }

  const detail = describeTransferables(value, [
    value.starts.buffer,
    value.instanceData.kinds.buffer,
    dead,
  ])

  expect(detail).toContain('instanceData.instanceFeatureIdx')
  expect(detail).toContain('index 2')
  expect(detail).toContain('1 of 3')
  // the cause, not just the symptom: nothing in this list detached it
  expect(detail).toContain('survives between RPC calls')
})

// The other cause, which postMessage reports with the SAME words — it detaches
// on the first occurrence, so the second is genuinely "already detached" by the
// time it is reached. The fixes are opposite, so the message has to separate
// them.
test('a duplicate within one list is reported as a duplicate', () => {
  const shared = new Float32Array(8)
  const value = { a: shared.subarray(0, 4), b: shared.subarray(4, 8) }

  const detail = describeTransferables(value, [value.a.buffer, value.b.buffer])

  expect(detail).toContain('already in the list')
  expect(detail).toContain('same buffer as index 0')
  expect(detail).not.toContain('survives between RPC calls')
})

// A post can fail for reasons that have nothing to do with the transfer list —
// an unserializable payload is the common one. Appending a transferables report
// to that error would point at the wrong thing entirely.
test('says nothing when the transfer list is fine', () => {
  const value = { a: new Uint32Array(2), b: new Uint32Array(2) }

  expect(
    describeTransferables(value, [value.a.buffer, value.b.buffer]),
  ).toBeUndefined()
  expect(describeTransferables({ fn: () => {} }, [])).toBeUndefined()
})

// A buffer the walk cannot reach still gets reported. The walk goes two levels
// in, which covers every result shape in the tree, but a report that dropped
// what it could not name would be worse than the index it replaces.
test('falls back to the index for a buffer it cannot find a path to', () => {
  const orphan = detach(new ArrayBuffer(8))

  const detail = describeTransferables({ nothing: 1 }, [orphan])

  expect(detail).toContain('index 0')
  expect(detail).toContain('1 of 1')
})
