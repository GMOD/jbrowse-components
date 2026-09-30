import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import useMeasure from '@jbrowse/core/util/useMeasure'
import { Typography, useTheme } from '@mui/material'

import { axisTicks, copiesOf, formatBp, readout } from './layout.ts'

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
const ROW_PX = 22
const BAR_PX = 12
const AXIS_PX = 26
const PAD = 12
const CHAR_PX = 6.6
// copies narrower than this draw as one run, without separators
const MIN_COPY_PX = 3

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
  referenceBp,
}: {
  repeat: TandemRepeat
  referenceBp: number
}) {
  const theme = useTheme()
  const unstated = repeat.alleles.some(a => !a.runs)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
      {repeat.units.map((unit, i) => (
        <div key={i} style={legendRow}>
          <div style={{ ...swatch, backgroundColor: unitColor(i) }} />
          <span>
            unit {i + 1} · {unit.length.toLocaleString()} bp
          </span>
        </div>
      ))}
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
  X,
  scale,
  labelRight,
  text,
  gap,
  referenceBp,
}: {
  allele: RepeatAllele
  repeat: TandemRepeat
  y: number
  X: (bp: number) => number
  scale: number
  labelRight: number
  text: string
  gap: string
  referenceBp: number
}) {
  const top = y - BAR_PX / 2
  const copies = copiesOf(allele, repeat.units)
  const unit = repeat.unitLength
  const ticked =
    !allele.runs && unit !== undefined && unit * scale >= MIN_COPY_PX
  return (
    <g data-testid="tandem-repeat-row">
      <text x={labelRight} y={y + 4} fontSize={11} textAnchor="end" fill={text}>
        {allele.label}
      </text>
      {allele.runs ? (
        copies.map((copy, i) => {
          const px = copy.bp * scale
          return (
            <rect
              key={i}
              x={X(copy.start)}
              y={top}
              width={Math.max(1, px >= MIN_COPY_PX ? px - 1 : px)}
              height={BAR_PX}
              fill={unitColor(copy.unit)}
            >
              <title>
                {`${allele.label}: copy ${i + 1} of ${copies.length}, unit ${copy.unit + 1}, ${copy.bp.toLocaleString()} bp`}
              </title>
            </rect>
          )
        })
      ) : (
        <rect
          x={X(0)}
          y={top}
          width={Math.max(1, allele.bp * scale)}
          height={BAR_PX}
          fill={NO_RUNS}
        >
          <title>{`${allele.label}: ${allele.bp.toLocaleString()} bp`}</title>
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
              y2={top + BAR_PX}
              stroke={gap}
            />
          ))
        : null}
      <text x={X(allele.bp) + 6} y={y + 4} fontSize={11} fill={text}>
        {readout(allele, referenceBp, unit)}
      </text>
    </g>
  )
}

const FALLBACK_WIDTH = 360

export default function TandemRepeatPanel({
  repeat,
}: {
  repeat: TandemRepeat
}) {
  const theme = useTheme()
  const [ref, { width = FALLBACK_WIDTH }] = useMeasure('width')
  const { alleles, refName, start, end } = repeat
  const referenceBp = end - start
  const readouts = alleles.map(a => readout(a, referenceBp, repeat.unitLength))
  const labelPx = Math.max(...alleles.map(a => a.label.length)) * CHAR_PX + PAD
  const readoutPx = Math.max(...readouts.map(r => r.length)) * CHAR_PX + PAD
  const plotPx = Math.max(100, width - labelPx - readoutPx - 2 * PAD)
  const maxBp = Math.max(referenceBp, ...alleles.map(a => a.bp))
  const scale = plotPx / maxBp
  const left = PAD + labelPx
  const X = (bp: number) => left + bp * scale
  const height = AXIS_PX + alleles.length * ROW_PX + PAD
  const text = theme.palette.text.primary
  const faint = theme.palette.text.secondary
  const gap = theme.palette.background.paper
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
            <b>{repeat.name}</b> · {refName}:{(start + 1).toLocaleString()}-
            {end.toLocaleString()} · {alleles.length} alleles, each on its own
            bp axis
          </Typography>
          <Legend repeat={repeat} referenceBp={referenceBp} />
        </div>
        <svg
          width={width}
          height={height}
          style={{ display: 'block' }}
          data-testid="tandem-repeat-view"
        >
          {axisTicks(maxBp).map(bp => (
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
          {alleles.map((allele, i) => (
            <Row
              key={`${allele.label}-${i}`}
              allele={allele}
              repeat={repeat}
              y={AXIS_PX + i * ROW_PX + ROW_PX / 2}
              X={X}
              scale={scale}
              labelRight={left - 8}
              text={text}
              gap={gap}
              referenceBp={referenceBp}
            />
          ))}
        </svg>
      </div>
    </BaseCard>
  )
}
