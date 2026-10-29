// Straight lines connecting normal-orientation pairs whose mates fall inside the
// same displayedRegion. Owned by the linkedReads feature.
//
// MAIN-THREAD derived, not worker output: the worker emits the four fields
// empty in every mode, and `attachLinkedReadLinesByGroup` fills them after the
// color bake from the one walk `resolveConnectors` makes — the lines embed
// `readYs`, so they cannot exist before rows are placed. Always present, so
// consumers can treat the fields as required.
//
// Populated with pileup connectors on (`showLinkedReadLines`), in chain layout
// too, where each line lies along its chain's `connectingLine`.
export interface LinkedReadLinesUploadData {
  linkedReadLinePositions: Uint32Array
  linkedReadLineYs: Uint16Array
  linkedReadLineColorTypes: Uint16Array
  numLinkedReadLines: number
}

export function emptyLinkedReadLinesUploadData(): LinkedReadLinesUploadData {
  return {
    linkedReadLinePositions: new Uint32Array(0),
    linkedReadLineYs: new Uint16Array(0),
    linkedReadLineColorTypes: new Uint16Array(0),
    numLinkedReadLines: 0,
  }
}
