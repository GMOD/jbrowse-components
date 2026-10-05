import { useState } from 'react'

import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import useMeasure from '@jbrowse/core/util/useMeasure'
import {
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material'

import {
  BAR_PX,
  axisTicks,
  copiesOf,
  formatBp,
  mergeNarrowCopies,
  readout,
  rowLayout,
  unitLabel,
} from './layout.ts'

import type { RepeatAllele, TandemRepeat } from './tandemRepeat.ts'

// Tableau 10, whose leading hues stay apart in lightness as well as hue
const UNIT_COLORS = [
  '#4e79a7',
  '#f28e2b',
  '#59a14f',
  '#e15759',
  '#76b7b2',
  '#edc948',
  '#b07aa1',
  '#ff9da7',
  '#9c755f',
  '#bab0ac',
]
const NO_RUNS = '#bdbdbd'
const AXIS_PX = 26
const PAD = 12
const CHAR_PX = 6.6
const MIN_COPY_PX = 3

function textPx(texts: string[]) {
  return Math.max(...texts.map(t => t.length)) * CHAR_PX + PAD
}

function unitColor(unit: number) {
  return UNIT_COLORS[unit % UNIT_COLORS.length]!
}

const swatch = { width: 18, height: BAR_PX - 4, borderRadius: 2 }
const legendRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  fontSize: 12,
  whiteSpace: 'nowrap' as const,
}

function Legend({
  repeat,
  alleles,
  referenceBp,
}: {
  repeat: TandemRepeat
  alleles: RepeatAllele[]
  referenceBp: number
}) {
  const theme = useTheme()
  const unstated = alleles.some(a => !a.runs)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
      {repeat.units.slice(0, UNIT_COLORS.length).map((unit, i) => (
        // eslint-disable-next-line @eslint-react/no-array-index-key -- a unit is identified by its position
        <div key={i} style={legendRow}>
          <div style={{ ...swatch, backgroundColor: unitColor(i) }} />
          <span>
            {unitLabel(repeat.units, i)} · {unit.length.toLocaleString()} bp
          </span>
        </div>
      ))}
      {repeat.units.length > UNIT_COLORS.length ? (
        <div style={legendRow}>
          <span>
            {repeat.units.length - UNIT_COLORS.length} more units share these
            colours
          </span>
        </div>
      ) : null}
      {unstated ? (
        <div style={legendRow}>
          <div style={{ ...swatch, backgroundColor: NO_RUNS }} />
          <span>
            runs not stated
            {repeat.unitLength
              ? `, ticked every ${repeat.unitLength.toLocaleString()} bp`
              : ''}
          </span>
        </div>
      ) : null}
      <div style={legendRow}>
        <svg width={18} height={BAR_PX}>
          <line
            x1={9}
            x2={9}
            y1={0}
            y2={BAR_PX}
            stroke={theme.palette.text.secondary}
            strokeDasharray="3 2"
          />
        </svg>
        <span>reference allele · {formatBp(referenceBp)}</span>
      </div>
    </div>
  )
}

function Row({
  allele,
  repeat,
  y,
  rowPx,
  barPx,
  labelled,
  X,
  scale,
  labelRight,
  text,
  gap,
  referenceBp,
  dimmed,
  onSelect,
}: {
  allele: RepeatAllele
  repeat: TandemRepeat
  y: number
  rowPx: number
  barPx: number
  labelled: boolean
  X: (bp: number) => number
  scale: number
  labelRight: number
  text: string
  gap: string
  referenceBp: number
  dimmed: boolean
  onSelect?: () => void
}) {
  const top = y - barPx / 2
  const copies = copiesOf(allele, repeat.units)
  const runs = mergeNarrowCopies(copies, scale, MIN_COPY_PX)
  const unit = repeat.unitLength
  const ticked =
    !allele.runs && unit !== undefined && unit * scale >= MIN_COPY_PX
  const named = labelled
    ? allele.label
    : `${allele.label}, ${readout(allele, referenceBp, unit)}`
  return (
    <g
      data-testid="tandem-repeat-row"
      opacity={dimmed ? 0.3 : 1}
      style={{ cursor: onSelect ? 'pointer' : undefined }}
      onClick={onSelect}
    >
      <rect
        x={0}
        y={y - rowPx / 2}
        width="100%"
        height={rowPx}
        fill="transparent"
      />
      {labelled ? (
        <text
          x={labelRight}
          y={y + 4}
          fontSize={11}
          textAnchor="end"
          fill={text}
        >
          {allele.label}
        </text>
      ) : null}
      {allele.runs ? (
        runs.map(run => {
          const px = run.bp * scale
          const which =
            run.count > 1
              ? `copies ${run.first + 1}-${run.first + run.count}`
              : `copy ${run.first + 1}`
          return (
            <rect
              key={run.first}
              x={X(run.start)}
              y={top}
              width={Math.max(1, px >= MIN_COPY_PX ? px - 1 : px)}
              height={barPx}
              fill={unitColor(run.unit)}
            >
              <title>
                {`${named}: ${which} of ${copies.length}, ${unitLabel(repeat.units, run.unit)}, ${run.bp.toLocaleString()} bp`}
              </title>
            </rect>
          )
        })
      ) : (
        <rect
          x={X(0)}
          y={top}
          width={Math.max(1, allele.bp * scale)}
          height={barPx}
          fill={NO_RUNS}
        >
          <title>
            {labelled
              ? `${allele.label}: ${allele.bp.toLocaleString()} bp`
              : named}
          </title>
        </rect>
      )}
      {ticked
        ? Array.from({ length: Math.ceil(allele.bp / unit) - 1 }, (_, i) =>
            X((i + 1) * unit),
          ).map(x => (
            <line
              key={x}
              x1={x}
              x2={x}
              y1={top}
              y2={top + barPx}
              stroke={gap}
            />
          ))
        : null}
      {labelled ? (
        <text x={X(allele.bp) + 6} y={y + 4} fontSize={11} fill={text}>
          {readout(allele, referenceBp, unit)}
        </text>
      ) : null}
    </g>
  )
}

const FALLBACK_WIDTH = 360
// per-haplotype rows up to this many read as a sample list; beyond it the panel
// opens on one row per allele, whose frequency stands in for the sample names
const SAMPLE_MAX_ROWS = 24

type Mode = 'sample' | 'allele'

export default function TandemRepeatPanel({
  repeat,
  selectedAlt,
  onSelectAlt,
}: {
  repeat: TandemRepeat
  selectedAlt: number | null
  onSelectAlt: (altIndex: number | null) => void
}) {
  const theme = useTheme()
  const [ref, { width = FALLBACK_WIDTH }] = useMeasure('width')
  const { byAllele, refName, start, end } = repeat
  const [chosen, setChosen] = useState<Mode>()
  const mode: Mode =
    byAllele &&
    (chosen ??
      (repeat.alleles.length > SAMPLE_MAX_ROWS ? 'allele' : 'sample')) ===
      'allele'
      ? 'allele'
      : 'sample'
  const alleles = mode === 'allele' ? byAllele! : repeat.alleles
  const { rowPx, barPx, labelled } = rowLayout(alleles.length)
  const rows = labelled ? alleles : [...alleles].sort((a, b) => b.bp - a.bp)
  const referenceBp = end - start
  const labelPx = labelled ? textPx(alleles.map(a => a.label)) : 0
  const readoutPx = labelled
    ? textPx(alleles.map(a => readout(a, referenceBp, repeat.unitLength)))
    : 0
  const plotPx = Math.max(100, width - labelPx - readoutPx - 2 * PAD)
  const maxBp = Math.max(1, referenceBp, ...alleles.map(a => a.bp))
  const scale = plotPx / maxBp
  const left = PAD + labelPx
  const X = (bp: number) => left + bp * scale
  const height = AXIS_PX + alleles.length * rowPx + PAD
  const text = theme.palette.text.primary
  const faint = theme.palette.text.secondary
  const gap = theme.palette.background.paper
  const noun = mode === 'sample' && byAllele ? 'haplotype' : 'allele'
  const undrawn =
    mode === 'allele'
      ? repeat.calledAlleles - alleles.reduce((n, a) => n + (a.count ?? 0), 0)
      : 0
  return (
    <BaseCard title="Tandem repeat">
      <div ref={ref}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 8,
            paddingBottom: PAD / 2,
          }}
        >
          <Typography variant="body2">
            {repeat.name ? (
              <>
                <b>{repeat.name}</b> ·{' '}
              </>
            ) : null}
            {refName}:{(start + 1).toLocaleString()}-{end.toLocaleString()} ·{' '}
            {alleles.length.toLocaleString()} {noun}
            {alleles.length === 1 ? '' : 's'}
            {mode === 'allele'
              ? ` across ${repeat.calledAlleles.toLocaleString()} called`
              : ''}
            {labelled
              ? null
              : ', longest first, too many to label: hover a copy for its row'}
          </Typography>
          {byAllele ? (
            <ToggleButtonGroup
              value={mode}
              exclusive
              size="small"
              onChange={(_, next: Mode | null) => {
                if (next) {
                  setChosen(next)
                  onSelectAlt(null)
                }
              }}
            >
              <ToggleButton value="allele">By allele</ToggleButton>
              <ToggleButton value="sample">By haplotype</ToggleButton>
            </ToggleButtonGroup>
          ) : null}
          <Legend repeat={repeat} alleles={alleles} referenceBp={referenceBp} />
        </div>
        <svg
          width={width}
          height={height}
          style={{ display: 'block' }}
          data-testid="tandem-repeat-view"
        >
          {axisTicks(maxBp, Math.max(2, Math.floor(plotPx / 50))).map(bp => (
            <g key={bp}>
              <line
                x1={X(bp)}
                x2={X(bp)}
                y1={AXIS_PX - 8}
                y2={AXIS_PX - 3}
                stroke={faint}
              />
              <text
                x={X(bp)}
                y={AXIS_PX - 12}
                fontSize={10}
                textAnchor="middle"
                fill={faint}
              >
                {bp === 0 ? '0' : formatBp(bp)}
              </text>
            </g>
          ))}
          <line
            x1={X(referenceBp)}
            x2={X(referenceBp)}
            y1={AXIS_PX - 3}
            y2={height - PAD / 2}
            stroke={faint}
            strokeDasharray="3 2"
          />
          {rows.map((allele, i) => (
            <Row
              // eslint-disable-next-line @eslint-react/no-array-index-key -- nothing makes a row label unique
              key={`${allele.label}-${i}`}
              allele={allele}
              repeat={repeat}
              y={AXIS_PX + i * rowPx + rowPx / 2}
              rowPx={rowPx}
              barPx={barPx}
              labelled={labelled}
              X={X}
              scale={scale}
              labelRight={left - 8}
              text={text}
              gap={gap}
              referenceBp={referenceBp}
              dimmed={selectedAlt !== null && allele.altIndex !== selectedAlt}
              onSelect={
                byAllele
                  ? () => {
                      onSelectAlt(
                        selectedAlt === allele.altIndex
                          ? null
                          : allele.altIndex,
                      )
                    }
                  : undefined
              }
            />
          ))}
        </svg>
        {undrawn > 0 ? (
          <Typography variant="caption" component="div">
            {undrawn.toLocaleString()} of{' '}
            {repeat.calledAlleles.toLocaleString()} called alleles are not
            &lt;CNV:TR&gt; and are not drawn
          </Typography>
        ) : null}
      </div>
    </BaseCard>
  )
}
