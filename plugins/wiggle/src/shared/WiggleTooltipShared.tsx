import { toP } from '../util.ts'

export function WiggleCursorLine({
  height,
  left,
}: {
  height: number
  left: number
}) {
  return (
    <div
      style={{
        background: 'black',
        border: 'none',
        width: 1,
        height,
        top: 0,
        cursor: 'default',
        position: 'absolute',
        pointerEvents: 'none',
        left,
      }}
    />
  )
}

export function WiggleScoreDisplay({
  score,
  summary,
  minScore,
  maxScore,
}: {
  score: number
  summary?: boolean
  minScore?: number
  maxScore?: number
}) {
  return summary && minScore != null && maxScore != null ? (
    <span>
      min:{toP(minScore)} avg:{toP(score)} max:{toP(maxScore)}
    </span>
  ) : (
    <span>{toP(score)}</span>
  )
}
