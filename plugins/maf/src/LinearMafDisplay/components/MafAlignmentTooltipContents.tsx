import type { ReactNode } from 'react'

import { getBpDisplayStr, toLocale } from '@jbrowse/core/util'

import { useTooltipStyles } from './tooltipStyles.ts'
import { describeMafStatus } from '../../util/mafStatus.ts'

import type { CodonChange, CodonHit } from './computeVisibleCodons.ts'
import type { GenomicPosition, MafHover } from '../util.ts'

function strandStr(strand?: number) {
  return strand === -1 ? '-' : '+'
}

function locationStr(chr?: string, pos?: number, strand?: number) {
  if (!chr || pos === undefined) {
    return undefined
  }
  return `${chr}:${toLocale(pos + 1)} (${strandStr(strand)})`
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <tr>
      <td>{label}</td>
      <td>{value}</td>
    </tr>
  )
}

function TableShell({
  caption,
  children,
}: {
  caption: string
  children: ReactNode
}) {
  const { classes } = useTooltipStyles()
  return (
    <table className={classes.table}>
      <caption>{caption}</caption>
      <tbody>{children}</tbody>
    </table>
  )
}

function refLabel(p: GenomicPosition) {
  return `${p.refName}:${toLocale(p.coord)}`
}

function RangeContents({
  p1,
  p2,
}: {
  p1: GenomicPosition
  p2: GenomicPosition
}) {
  return (
    <TableShell caption="Selection">
      <Row label="Start" value={refLabel(p1)} />
      <Row label="End" value={refLabel(p2)} />
      <Row
        label="Length"
        value={getBpDisplayStr(Math.abs(p1.coord - p2.coord))}
      />
    </TableShell>
  )
}

function HoverContents({
  hover,
  refName,
  coord,
}: {
  hover: MafHover
  refName: string
  coord: number
}) {
  const location = `${refName}:${toLocale(coord)}`

  if (hover.kind === 'cell') {
    const loc = locationStr(hover.chr, hover.pos, hover.strand)
    const ctx = hover.context
    return (
      <TableShell caption={`Alignment - ${location}`}>
        <Row label="Sample" value={hover.sampleLabel} />
        <Row label="Base" value={hover.base} />
        {loc ? <Row label="Location" value={loc} /> : null}
        {ctx?.leftStatus ? (
          <Row
            label="Before block"
            value={`${describeMafStatus(ctx.leftStatus)}${ctx.leftCount !== undefined ? ` (${toLocale(ctx.leftCount)} bp)` : ''}`}
          />
        ) : null}
        {ctx?.rightStatus ? (
          <Row
            label="After block"
            value={`${describeMafStatus(ctx.rightStatus)}${ctx.rightCount !== undefined ? ` (${toLocale(ctx.rightCount)} bp)` : ''}`}
          />
        ) : null}
      </TableShell>
    )
  }

  if (hover.kind === 'insertion') {
    const loc = locationStr(hover.chr, hover.pos, hover.strand)
    const seq = hover.sequence
    const label =
      seq && seq.length <= 20
        ? `${seq} (${hover.length} bp)`
        : `${hover.length} bp`
    return (
      <TableShell caption={`Insertion - ${location}`}>
        <Row label="Sample" value={hover.sampleLabel} />
        <Row label="Insertion" value={label} />
        {loc ? <Row label="Location" value={loc} /> : null}
      </TableShell>
    )
  }

  if (hover.kind === 'deletion') {
    return (
      <TableShell caption={`Deletion - ${location}`}>
        <Row label="Sample" value={hover.sampleLabel} />
        <Row label="Deletion" value={`${toLocale(hover.length)} bp`} />
      </TableShell>
    )
  }

  // empty (bridged e-line)
  return (
    <TableShell caption={`Bridged - ${location}`}>
      <Row label="Sample" value={hover.sampleLabel} />
      <Row label="Status" value={describeMafStatus(hover.status)} />
      <Row
        label="Location"
        value={`${hover.chr}:${toLocale(hover.start + 1)} (${strandStr(hover.strand)}), ${toLocale(hover.size)} bp`}
      />
    </TableShell>
  )
}

export interface FrameHover {
  name: string
  frame: number
  strand: number
}

// The CDS reading frame projected onto this species' row (UCSC mafFrames),
// shown as its own captioned section so the gene structure is readable by
// hovering any species — alongside the per-base/insertion/etc. hover.
function FrameContents({ frame }: { frame: FrameHover }) {
  return (
    <TableShell caption="CDS frame">
      {frame.name ? <Row label="Gene" value={frame.name} /> : null}
      <Row
        label="Reading frame"
        value={`${frame.frame} (${strandStr(frame.strand)})`}
      />
    </TableShell>
  )
}

const CHANGE_LABEL: Record<CodonChange, string> = {
  same: 'none',
  syn: 'synonymous (silent)',
  nonsyn: 'nonsynonymous',
  stop: 'stop',
}

// The codon under the cursor in codon view (per-species translation): the
// species' codon + amino acid alongside the reference's, so a specific
// syn/nonsyn change reads directly rather than being inferred from cell color.
function CodonContents({ codon }: { codon: CodonHit }) {
  const aaStr =
    codon.refAa !== undefined && codon.refAa !== codon.aa
      ? `${codon.refAa} → ${codon.aa}`
      : codon.aa
  const codonStr =
    codon.refCodon !== undefined && codon.refCodon !== codon.codon
      ? `${codon.refCodon} → ${codon.codon}`
      : codon.codon
  return (
    <TableShell caption="Codon">
      <Row label="Codon" value={codonStr} />
      <Row label="Amino acid" value={aaStr} />
      <Row label="Change" value={CHANGE_LABEL[codon.change]} />
    </TableShell>
  )
}

export default function MafAlignmentTooltipContents({
  p1,
  p2,
  hover,
  frame,
  codon,
}: {
  p1?: GenomicPosition
  p2: GenomicPosition
  hover?: MafHover
  frame?: FrameHover
  codon?: CodonHit
}) {
  const { classes } = useTooltipStyles()

  if (p1) {
    return <RangeContents p1={p1} p2={p2} />
  }
  return (
    <>
      {hover ? (
        <HoverContents hover={hover} refName={p2.refName} coord={p2.coord} />
      ) : (
        <table className={classes.table}>
          <tbody>
            <Row label="Ref" value={refLabel(p2)} />
          </tbody>
        </table>
      )}
      {frame ? <FrameContents frame={frame} /> : null}
      {codon ? <CodonContents codon={codon} /> : null}
    </>
  )
}
