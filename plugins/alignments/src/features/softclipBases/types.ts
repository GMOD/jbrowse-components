// Worker → main-thread payload for the soft-clip bases overlay: one entry per
// clipped base of every read, present only while `showSoftClipping` is on (the
// worker builds it from `showSoftClipping ? softclips : []`).
//
// A subset of `CigarUploadData` by construction — the packer is handed the wide
// payload and a mark over the narrow one accepts it — stated here so the mark,
// the painter and the hit test name what they read.
export interface SoftclipBasesUploadData {
  softclipBasePositions: Uint32Array
  softclipBaseYs: Uint16Array
  softclipBaseBases: Uint8Array
}
