// Straight lines connecting normal-orientation pairs whose mates fall inside the
// same displayedRegion. Owned by the linkedReads feature.
//
// MAIN-THREAD derived, not worker output: the worker emits the four fields
// empty in every mode, and `attachLinkedReadLines` fills them from
// `computeLinkedReadLinesByRegion` after layout — the lines embed `readYs`, so
// they cannot exist before rows are placed. Always present, so consumers can
// treat the fields as required.
//
// Populated in PILEUP layout with curved connectors on (`showLinkedReadLines` =
// `showBezierConnections && !isChainMode`), and empty in chain mode, which draws
// its own per-chain `connectingLine` pass instead. (Said the other way round
// until it was checked, and named a `linkedReadBezier` mode that no longer
// exists — 'bezier' left LINKED_READS_MODES to become `showBezierConnections`.)
export interface LinkedReadLinesUploadData {
  linkedReadLinePositions: Uint32Array
  linkedReadLineYs: Uint16Array
  linkedReadLineColorTypes: Uint8Array
  numLinkedReadLines: number
}

export function emptyLinkedReadLinesUploadData(): LinkedReadLinesUploadData {
  return {
    linkedReadLinePositions: new Uint32Array(0),
    linkedReadLineYs: new Uint16Array(0),
    linkedReadLineColorTypes: new Uint8Array(0),
    numLinkedReadLines: 0,
  }
}
