// Worker → main-thread payload for per-base-quality entries.
// One entry per visible aligned base under the perBaseQuality base layer.
export interface PerBaseQualityUploadData {
  perBaseQualPositions: Uint32Array
  perBaseQualYs: Uint16Array
  perBaseQualScores: Uint8Array
}
