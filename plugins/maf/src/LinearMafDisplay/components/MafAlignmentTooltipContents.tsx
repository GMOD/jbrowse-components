import { getBpDisplayStr, toLocale } from '@jbrowse/core/util'

import { describeMafStatus } from '../../util/mafStatus.ts'
import { insertionForwardStart } from './findRowHover.ts'
import { useTooltipStyles } from './tooltipStyles.ts'

import type { MafStatus } from '../../types.ts'
import type { GenomicPosition, MafHover } from '../util.ts'
import type { CodonChange, CodonHit } from './computeVisibleCodons.ts'
import type { SummaryBar } from './computeVisibleSummaryBars.ts'
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

// Every tooltip body is this table; `caption` is omitted only by the bare
// "no hover resolved" readout, which has nothing to title.
function TableShell({
  caption,
  children,
}: {
  caption?: string
  children: ReactNode
}) {
  const { classes } = useTooltipStyles()
  return (
    <table className={classes.table}>
      {caption ? <caption>{caption}</caption> : null}
      <tbody>{children}</tbody>
    </table>
  )
}

// An i-line context side: the status phrasing plus its bp count when the file
// gave one. Paren-free descriptions (see `describeMafStatus`) so the count
// appends without nesting parentheses.
function contextStr(status: MafStatus, count?: number) {
  const bp = count === undefined ? '' : ` (${toLocale(count)} bp)`
  return `${describeMafStatus(status)}${bp}`
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
        // Inclusive of both ends, because the subsequence widget this drag
        // opens extracts `max - min + 1` bases. The exclusive count read
        // "0 bp" over a one-base drag that hands back one base.
        value={getBpDisplayStr(Math.abs(p1.coord - p2.coord) + 1)}
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
            value={contextStr(ctx.leftStatus, ctx.leftCount)}
          />
        ) : null}
        {ctx?.rightStatus ? (
          <Row
            label="After block"
            value={contextStr(ctx.rightStatus, ctx.rightCount)}
          />
        ) : null}
      </TableShell>
    )
  }

  if (hover.kind === 'insertion') {
    // The lowest forward coordinate of the run, which is what the widget the
    // click opens spans from — `hover.pos` is the first base in alignment
    // order, and on a '-' row that is the run's far end.
    const loc = locationStr(
      hover.chr,
      hover.pos === undefined
        ? undefined
        : insertionForwardStart(hover.pos, hover.length, hover.strand),
      hover.strand,
    )
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

/**
 * The zoom-out tier's answer to `HoverContents`. Without it a summary bar is
 * unhoverable in practice: the alignment blocks the row hover resolves against
 * were cleared to get here, so the tooltip fell through to the bare "Ref:
 * position" readout — over a display whose rows *are* per-species, one bar per
 * aligned run, with no other way to find out which species a row is.
 *
 * `score` is the summary file's own, and the two producers mean different
 * things by it (UCSC a normalized HOXD70 alignment score, `maf2bed --summary`
 * percent identity to the reference), so it is labelled as what it is rather
 * than as either. It is what shades the bar, and shading is otherwise the one
 * thing here with no decoder at all.
 */
function SummaryContents({
  bar,
  location,
  sampleLabel,
}: {
  bar: SummaryBar
  location: string
  sampleLabel?: string
}) {
  return (
    <TableShell caption={`Summary - ${location}`}>
      {sampleLabel ? <Row label="Sample" value={sampleLabel} /> : null}
      <Row
        label="Aligned block"
        value={`${toLocale(bar.start + 1)}-${toLocale(bar.end)} (${getBpDisplayStr(bar.end - bar.start)})`}
      />
      <Row label="Score" value={bar.score.toFixed(2)} />
      {bar.leftStatus ? (
        <Row label="Before block" value={contextStr(bar.leftStatus)} />
      ) : null}
      {bar.rightStatus ? (
        <Row label="After block" value={contextStr(bar.rightStatus)} />
      ) : null}
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
    <TableShell caption={`Codon - ${location}`}>
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
  summary,
  summarySampleLabel,
}: {
  p1?: GenomicPosition
  p2: GenomicPosition
  hover?: MafHover
  frame?: FrameHover
  codon?: CodonHit
  summary?: SummaryBar
  summarySampleLabel?: string
}) {
  if (p1) {
    return <RangeContents p1={p1} p2={p2} />
  }
  // The zoom-out tier: `hover` is always absent here (no alignment blocks), so
  // this is the whole readout rather than a section stacked under one. The CDS
  // strip can still draw on this tier, so its table still rides along.
  if (summary) {
    return (
      <>
        <SummaryContents
          bar={summary}
          location={refLabel(p2)}
          sampleLabel={summarySampleLabel}
        />
        {frame ? <FrameContents frame={frame} /> : null}
      </>
    )
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
        <TableShell>
          <Row label="Ref" value={refLabel(p2)} />
        </TableShell>
      )}
      {frame ? <FrameContents frame={frame} /> : null}
    </>
  )
}
