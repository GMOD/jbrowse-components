/**
 * The arguments every fetch RPC of a display takes, spelled once: the adapter it
 * reads, the byte budget the gate enforces — `undefined` where no gate is on,
 * so an ungated display passes it too and the worker ignores it — and the
 * settings `rpcProps()` returns. What a call adds on top is its own: the
 * regions, and any zoom-swinging term that must not be a cache key (a per-base
 * bin, a resolution, a bpPerPx).
 */
export function rpcArgs<P extends object>(self: {
  adapterConfig: Record<string, unknown>
  resolvedByteLimit: () => number | undefined
  rpcProps: () => P
}) {
  return {
    adapterConfig: self.adapterConfig,
    byteLimit: self.resolvedByteLimit(),
    ...self.rpcProps(),
  }
}
