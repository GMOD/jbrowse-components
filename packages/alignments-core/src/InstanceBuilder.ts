// Growable typed-array buffer for building GPU instance data.
// Both the alignments and synteny plugins use this pattern to pack
// per-feature data into interleaved instance buffers for instanced draws.

export class InstanceBuilder {
  private stride: number
  private bytesPerInstance: number
  private capacity: number
  private count = 0
  private buf: ArrayBuffer
  u32: Uint32Array
  f32: Float32Array

  constructor(bytesPerInstance: number, initialCapacity: number) {
    this.bytesPerInstance = bytesPerInstance
    this.stride = bytesPerInstance / 4
    this.capacity = Math.max(initialCapacity, 1)
    this.buf = new ArrayBuffer(this.capacity * bytesPerInstance)
    this.u32 = new Uint32Array(this.buf)
    this.f32 = new Float32Array(this.buf)
  }

  ensureCapacity(needed: number) {
    if (this.count + needed <= this.capacity) {
      return
    }
    const newCap = Math.max(this.capacity * 2, this.count + needed)
    const newBuf = new ArrayBuffer(newCap * this.bytesPerInstance)
    const newU32 = new Uint32Array(newBuf)
    newU32.set(this.u32.subarray(0, this.count * this.stride))
    this.buf = newBuf
    this.u32 = newU32
    this.f32 = new Float32Array(newBuf)
    this.capacity = newCap
  }

  // Returns the offset (in u32/f32 elements) for the next instance and
  // advances the count. Caller writes data at the returned offset.
  alloc() {
    this.ensureCapacity(1)
    const off = this.count * this.stride
    this.count++
    return off
  }

  getCount() {
    return this.count
  }

  getStride() {
    return this.stride
  }

  getBuffer() {
    return this.buf.slice(0, this.count * this.bytesPerInstance)
  }
}
