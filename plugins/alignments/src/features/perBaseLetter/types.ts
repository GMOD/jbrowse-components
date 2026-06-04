// Worker → main-thread payload for per-base-lettering entries.
// One entry per visible aligned base when colorBy.type === 'perBaseLetter';
// every base is drawn in its nucleotide color (not just mismatches).
export interface PerBaseLetterUploadData {
  perBaseLetterPositions: Uint32Array
  perBaseLetterYs: Uint16Array
  perBaseLetterBases: Uint8Array
}

export interface PerBaseLetterEntry {
  featureId: string
  position: number
  base: number
}
