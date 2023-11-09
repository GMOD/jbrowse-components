import React, { useRef, useState } from 'react'
import { observer } from 'mobx-react'
import {
  AbstractSessionModel,
  Feature,
  assembleLocString,
  getContainingView,
  getSession,
  measureText,
} from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { getConf } from '@jbrowse/core/configuration'
import { parseBreakend } from '@gmod/vcf'

// local
import { LinearArcDisplayModel } from '../model'
import { Tooltip } from 'react-svg-tooltip'

type LGV = LinearGenomeViewModel

function f(feature: Feature, alt?: string) {
  const bnd = alt ? parseBreakend(alt) : undefined
  let start = feature.get('start')
  let end = feature.get('end')
  const strand = feature.get('strand')
  const mate = feature.get('mate')
  const refName = feature.get('refName')

  let mateRefName: string | undefined
  let mateEnd = 0
  let mateStart = 0

  // one sided bracket used, because there could be <INS:ME> and we just check
  // startswith below
  const symbolicAlleles = ['<TRA', '<DEL', '<INV', '<INS', '<DUP', '<CNV']
  if (symbolicAlleles.some(a => alt?.startsWith(a))) {
    // END is defined to be a single value, not an array. CHR2 not defined in
    // VCF spec, but should be similar
    const e = feature.get('INFO')?.END?.[0] || feature.get('end')
    mateEnd = e
    mateStart = e - 1
    mateRefName = feature.get('INFO')?.CHR2?.[0] ?? refName
    // re-adjust the arc to be from start to end of feature by re-assigning end
    // to the 'mate'
    start = feature.get('start')
    end = feature.get('start') + 1
  } else if (bnd?.MatePosition) {
    const matePosition = bnd.MatePosition.split(':')
    mateEnd = +matePosition[1]
    mateStart = +matePosition[1] - 1
    mateRefName = matePosition[0]
  }

  return {
    k1: { refName, start, end, strand },
    k2: mate ?? { refName: mateRefName, end: mateEnd, start: mateStart },
  }
}

function makeSummary(feature: Feature, alt?: string) {
  const { k1, k2 } = f(feature, alt)
  return [
    feature.get('name'),
    feature.get('id'),
    assembleLocString(k1),
    assembleLocString(k2),
    feature.get('INFO')?.SVTYPE,
    alt,
  ]
    .filter(f => !!f)
    .join(' - ')
}

// conditionally rendered tooltip only on mouseover, speeds up
const SvgTooltip = React.forwardRef<
  SVGPathElement,
  { feature: Feature; alt?: string }
>(function SvgTooltip2({ feature, alt }, ref) {
  const caption = makeSummary(feature, alt)
  const tooltipWidth = 20 + measureText(caption)
  return ref !== null ? (
    // @ts-expect-error
    <Tooltip triggerRef={ref}>
      <rect
        x={12}
        y={0}
        width={tooltipWidth}
        height={20}
        rx={5}
        ry={5}
        fill="black"
        fillOpacity="50%"
      />
      <text
        x={22}
        y={14}
        fontSize={10}
        fill="white"
        textLength={tooltipWidth - 20}
      >
        {caption}
      </text>
    </Tooltip>
  ) : null
})

const Arc = observer(function ({
  model,
  feature,
  alt,
  assembly,
  view,
}: {
  feature: Feature
  alt?: string
  model: LinearArcDisplayModel
  assembly: Assembly
  session: AbstractSessionModel
  view: LinearGenomeViewModel
}) {
  const [mouseOvered, setMouseOvered] = useState(false)
  const { height } = model
  const { k1, k2 } = f(feature, alt)
  const ref = useRef<SVGPathElement>(null)
  const c = getConf(model, 'color', { feature, alt })
  const ra1 = assembly.getCanonicalRefName(k1.refName) || k1.refName
  const ra2 = assembly.getCanonicalRefName(k2.refName) || k2.refName
  const p1 = k1.start
  const p2 = k2.start
  const r1 = view.bpToPx({ refName: ra1, coord: p1 })?.offsetPx
  const r2 = view.bpToPx({ refName: ra2, coord: p2 })?.offsetPx

  if (r1 !== undefined && r2 !== undefined) {
    const radius = (r2 - r1) / 2
    const absrad = Math.abs(radius)
    const destY = Math.min(height, absrad)
    const p1 = r1 - view.offsetPx
    const p2 = r2 - view.offsetPx
    const left = p1
    const right = p2

    return absrad > 1 ? (
      <>
        <path
          d={`M ${left} 0 C ${left} ${destY}, ${right} ${destY}, ${right} 0`}
          ref={ref}
          stroke={mouseOvered ? 'black' : c}
          strokeWidth={3}
          onMouseOut={() => setMouseOvered(false)}
          onMouseOver={() => setMouseOvered(true)}
          onClick={() => model.selectFeature(feature)}
          fill="none"
          pointerEvents="stroke"
        />
        {mouseOvered ? (
          <SvgTooltip feature={feature} alt={alt} ref={ref} />
        ) : null}
      </>
    ) : null
  }
  return null
})

const Wrapper = observer(function ({
  model,
  exportSVG,
  children,
}: {
  model: LinearArcDisplayModel
  exportSVG?: boolean
  children: React.ReactNode
}) {
  const { height } = model
  const view = getContainingView(model) as LGV
  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  return exportSVG ? (
    <>{children}</>
  ) : (
    <svg width={width} height={height}>
      {children}
    </svg>
  )
})

const Arcs = observer(function ({
  model,
  exportSVG,
}: {
  model: LinearArcDisplayModel
  exportSVG?: boolean
}) {
  const view = getContainingView(model) as LGV
  const session = getSession(model)
  const { assemblyManager } = session
  const { features } = model
  const assembly = assemblyManager.get(view.assemblyNames[0])

  return assembly ? (
    <Wrapper model={model} exportSVG={exportSVG}>
      {features?.map(f => {
        const alts = f.get('ALT') as string[] | undefined
        return (
          alts?.map(a => (
            <Arc
              key={f.id() + '-' + a}
              session={session}
              feature={f}
              alt={a}
              view={view}
              model={model}
              assembly={assembly}
            />
          )) ?? (
            <Arc
              key={f.id()}
              session={session}
              feature={f}
              view={view}
              model={model}
              assembly={assembly}
            />
          )
        )
      })}
    </Wrapper>
  ) : null
})

export default Arcs
