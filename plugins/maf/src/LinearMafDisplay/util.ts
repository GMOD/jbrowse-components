import { getBpDisplayStr, toLocale } from '@jbrowse/core/util'

export interface GenomicPosition {
  refName: string
  coord: number
}

export function generateTooltipContent(
  p1: GenomicPosition | undefined,
  p2: GenomicPosition,
): string {
  return p1
    ? [
        `Start: ${p1.refName}:${toLocale(p1.coord)}`,
        `End: ${p2.refName}:${toLocale(p2.coord)}`,
        `Length: ${getBpDisplayStr(Math.abs(p1.coord - p2.coord))}`,
      ].join('<br/>')
    : `Ref: ${p2.refName}:${toLocale(p2.coord)}`
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
