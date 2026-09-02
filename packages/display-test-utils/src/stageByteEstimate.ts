interface GateViewport {
  spanBp: number
  key: string
}

/** What `RegionTooLargeMixin` exposes for a measurement to land on. */
export interface ByteGatedDisplay {
  gateViewport: GateViewport | undefined
  commitFetchBytes: (
    perRegionBytes: (number | undefined)[],
    issued: {
      viewport: GateViewport | undefined
      gated: boolean
      tierKey: undefined
    },
  ) => void
}

/**
 * Stage a byte measurement on a gated display the way a fetch would commit
 * one, minus the fetch: the bytes land against the viewport on screen, and the
 * viewport is not stamped as measured, so the gate still owes the re-measure a
 * real fetch would make. The display has to have `gateEnabled` on, since
 * `commitFetchBytes` returns early without it.
 */
export function stageByteEstimate(display: ByteGatedDisplay, bytes: number) {
  display.commitFetchBytes([bytes], {
    viewport: display.gateViewport,
    gated: false,
    tierKey: undefined,
  })
}
