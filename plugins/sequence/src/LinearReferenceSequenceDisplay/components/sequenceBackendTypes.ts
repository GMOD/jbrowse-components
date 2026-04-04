export interface SequenceBackend {
  uploadGeometry(
    rectBuf: Float32Array,
    colorBuf: Uint8Array,
    instanceCount: number,
  ): void
  render(
    instanceCount: number,
    basePx: number,
    bpPerPx: number,
    cssWidth: number,
    cssHeight: number,
  ): void
  dispose(): void
}
