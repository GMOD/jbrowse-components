import { formatInsertionLabel } from '@jbrowse/alignments-core'
import { getBpDisplayStr, toLocale } from '@jbrowse/core/util'

import { describeMafStatus } from '../util/mafStatus.ts'

import type {
  CellHit,
  DeletionHit,
  EmptyHit,
  InsertionHit,
  RowHit,
} from './components/findRowHover.ts'

export interface GenomicPosition {
  refName: string
  coord: number
}

export type MafHover = RowHit & {
  sampleLabel: string
  // This species' percent identity (0..1) to the reference over the visible
  // region; undefined when unclassifiable or the row-identity display is off.
  rowIdentity?: number
}

function strandStr(strand?: number) {
  return strand === -1 ? '-' : '+'
}

function contextLine(label: string, status?: string, count?: number) {
  return status
    ? `${label}: ${status}${count === undefined ? '' : ` (${toLocale(count)} bp)`}`
    : undefined
}

function cellLines(h: CellHit & { sampleLabel: string }) {
  const ctx = h.context
  return [
    `Sample: ${h.sampleLabel}`,
    `Base: ${h.base}`,
    h.pos === undefined || !h.chr
      ? undefined
      : `Location: ${h.chr}:${toLocale(h.pos + 1)} (${strandStr(h.strand)})`,
    contextLine(
      'Before block',
      ctx?.leftStatus && describeMafStatus(ctx.leftStatus),
      ctx?.leftCount,
    ),
    contextLine(
      'After block',
      ctx?.rightStatus && describeMafStatus(ctx.rightStatus),
      ctx?.rightCount,
    ),
  ]
}

function insertionLines(h: InsertionHit & { sampleLabel: string }) {
  return [
    `Sample: ${h.sampleLabel}`,
    formatInsertionLabel(h.length, h.sequence),
    h.pos === undefined || !h.chr
      ? undefined
      : `Location: ${h.chr}:${toLocale(h.pos + 1)} (${strandStr(h.strand)})`,
  ]
}

function deletionLines(h: DeletionHit & { sampleLabel: string }) {
  return [`Sample: ${h.sampleLabel}`, `${toLocale(h.length)} bp deletion`]
}

function emptyLines(h: EmptyHit & { sampleLabel: string }) {
  return [
    `Sample: ${h.sampleLabel}`,
    'No aligning sequence here; the flanking alignments are bridged by a chain (UCSC e-line)',
    `Reason: ${describeMafStatus(h.status)}`,
    `Location: ${h.chr}:${toLocale(h.start + 1)} (${strandStr(h.strand)}), ${toLocale(h.size)} bp`,
  ]
}

function hoverLines(hover: MafHover) {
  switch (hover.kind) {
    case 'cell':
      return cellLines(hover)
    case 'insertion':
      return insertionLines(hover)
    case 'deletion':
      return deletionLines(hover)
    case 'empty':
      return emptyLines(hover)
  }
}

export function generateTooltipContent(
  p1: GenomicPosition | undefined,
  p2: GenomicPosition,
  hover?: MafHover,
): string {
  const ref = `Ref: ${p2.refName}:${toLocale(p2.coord)}`
  return p1
    ? [
        `Start: ${p1.refName}:${toLocale(p1.coord)}`,
        `End: ${p2.refName}:${toLocale(p2.coord)}`,
        `Length: ${getBpDisplayStr(Math.abs(p1.coord - p2.coord))}`,
      ].join('<br/>')
    : hover
      ? [...hoverLines(hover).filter(Boolean), ref].join('<br/>')
      : ref
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
