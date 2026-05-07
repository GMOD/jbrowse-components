// Worker → main-thread payload for per-base-quality entries.
// One entry per visible aligned base when colorBy.type === 'perBaseQuality'.
export interface PerBaseQualityUploadData {
  perBaseQualPositions: Uint32Array
  perBaseQualYs: Uint16Array
  perBaseQualScores: Uint8Array
}

export interface PerBaseQualityEntry {
  featureId: string
  position: number
  score: number
}
