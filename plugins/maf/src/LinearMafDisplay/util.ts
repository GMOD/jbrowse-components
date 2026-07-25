import type { RowHit } from './components/findRowHover.ts'

export interface GenomicPosition {
  refName: string
  coord: number
}

export type MafHover = RowHit & {
  sampleLabel: string
}

export interface MsaHighlight {
  refName: string
  start: number
  end: number
}

interface MsaViewLike {
  type?: string
  connectedViewId?: string
  connectedHighlights?: MsaHighlight[]
}

function isConnectedMsaView(
  v: unknown,
  viewId: string,
): v is Required<Pick<MsaViewLike, 'connectedHighlights'>> & MsaViewLike {
  const candidate = v as MsaViewLike | null
  return (
    !!candidate &&
    candidate.type === 'MsaView' &&
    candidate.connectedViewId === viewId &&
    !!candidate.connectedHighlights
  )
}

/**
 * Collect highlight regions from MSA views connected to `viewId`. Connections
 * are declared on the MSA view side via `connectedViewId`; cross-view access
 * is untyped, so we narrow defensively here in one place.
 */
export function getMsaHighlights(
  sessionViews: readonly unknown[],
  viewId: string,
): MsaHighlight[] {
  const result: MsaHighlight[] = []
  for (const v of sessionViews) {
    if (isConnectedMsaView(v, viewId)) {
      for (const h of v.connectedHighlights) {
        result.push(h)
      }
    }
  }
  return result
}
