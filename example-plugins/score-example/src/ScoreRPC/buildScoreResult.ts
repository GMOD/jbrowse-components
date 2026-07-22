import type { ScoreRegionData } from './rpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'

// Pure packer: features -> parallel typed arrays. Kept separate from the RPC
// method so it unit-tests without a worker, an adapter, or a plugin manager.
// Scores are normalized to 0..1 against the region's own max so the box heights
// read regardless of the raw score scale.
export function buildScoreResult(
  features: Feature[],
  scoreColumn: string,
): ScoreRegionData {
  const scored = features.filter(f => Number.isFinite(f.get(scoreColumn)))
  const numFeatures = scored.length
  const starts = new Uint32Array(numFeatures)
  const ends = new Uint32Array(numFeatures)
  const scores = new Float32Array(numFeatures)

  let maxScore = 0
  for (const f of scored) {
    maxScore = Math.max(maxScore, f.get(scoreColumn) as number)
  }
  const norm = maxScore || 1

  scored.forEach((f, i) => {
    starts[i] = f.get('start')
    ends[i] = f.get('end')
    scores[i] = (f.get(scoreColumn) as number) / norm
  })

  return { starts, ends, scores, numFeatures }
}
