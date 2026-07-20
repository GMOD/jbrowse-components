import { getBpDisplayStr, toLocale } from '@jbrowse/core/util'

import { describeMafStatus } from '../../util/mafStatus.ts'
import { useTooltipStyles } from './tooltipStyles.ts'

import type { GenomicPosition, MafHover } from '../util.ts'
import type { CodonChange, CodonHit } from './computeVisibleCodons.ts'
import type { ReactNode } from 'react'

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

// Just the gene name; the raw reading-frame number isn't useful to read.
export interface FrameHover {
  name: string
}

// The CDS gene projected onto this species' row (UCSC mafFrames), so the gene is
// identifiable by hovering any species. Shown only in the base view — codon view
// folds the gene into the consolidated codon table.
function FrameContents({ frame }: { frame: FrameHover }) {
  return frame.name ? (
    <TableShell caption="CDS">
      <Row label="Gene" value={frame.name} />
    </TableShell>
  ) : null
}

const CHANGE_LABEL: Record<CodonChange, string> = {
  same: 'none',
  syn: 'synonymous',
  nonsyn: 'nonsynonymous',
  stop: 'stop',
}

// The codon under the cursor in codon view, as a single compact table: the
// species + gene + the species' codon/amino acid against the reference's, so a
// specific syn/nonsyn change reads directly rather than inferred from cell color.
function CodonContents({
  codon,
  location,
  sampleLabel,
  gene,
}: {
  codon: CodonHit
  location: string
  sampleLabel?: string
  gene?: string
}) {
  const aaStr =
    codon.refAa !== undefined && codon.refAa !== codon.aa
      ? `${codon.refAa} → ${codon.aa}`
      : codon.aa
  const codonStr =
    codon.refCodon !== undefined && codon.refCodon !== codon.codon
      ? `${codon.refCodon} → ${codon.codon}`
      : codon.codon
  return (
    <TableShell caption={`Codon — ${location}`}>
      {sampleLabel ? <Row label="Sample" value={sampleLabel} /> : null}
      {gene ? <Row label="Gene" value={gene} /> : null}
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
  // Codon view: one consolidated table (species + gene + codon change) instead
  // of stacking the per-base alignment, CDS, and codon tables.
  if (codon) {
    return (
      <CodonContents
        codon={codon}
        location={refLabel(p2)}
        sampleLabel={hover?.sampleLabel}
        gene={frame?.name}
      />
    )
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
    </>
  )
}
