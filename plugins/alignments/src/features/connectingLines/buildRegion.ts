import type { ConnectingLinesUploadData } from './types.ts'

// Empty TypedArrays must be allocated per-call: the worker transfers their
// underlying ArrayBuffers, which detaches them. Module-level singletons
// cause DataCloneError on the second RPC reply.

export interface ConnectingLinesRegionFields {
  connectingLinePositions: Uint32Array
  connectingLineYs: Uint16Array
  numConnectingLines: number
}

export function buildConnectingLinesFields(
  data: ConnectingLinesUploadData,
): ConnectingLinesRegionFields {
  return {
    connectingLinePositions: data.connectingLinePositions,
    connectingLineYs: data.connectingLineYs,
    numConnectingLines: data.connectingLinePositions.length / 2,
  }
}

export function emptyConnectingLinesFields(): ConnectingLinesRegionFields {
  return {
    connectingLinePositions: new Uint32Array(0),
    connectingLineYs: new Uint16Array(0),
    numConnectingLines: 0,
  }
}
