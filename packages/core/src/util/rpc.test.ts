import { transferableBuffers } from './rpc.ts'

test('lists each field buffer once and skips what cannot transfer', () => {
  const shared = new Uint32Array(4)
  const raw = new ArrayBuffer(8)
  const nested = new Float32Array(2)
  const buffers = transferableBuffers(
    { a: shared, b: shared.subarray(1), raw, name: 'x', n: 3 },
    { nested, sab: new Uint8Array(new SharedArrayBuffer(4)) },
  )
  expect(buffers).toEqual([shared.buffer, raw, nested.buffer])
  expect(buffers.map(b => b === shared.buffer)).toEqual([true, false, false])
})
