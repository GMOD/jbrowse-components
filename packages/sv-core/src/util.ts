import { parseBreakend } from '@gmod/vcf'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'

export function getBreakendCoveringRegions({
  feature,
  assembly,
}: {
  feature: Feature
  assembly: Assembly
}) {
  const alt = feature.get('ALT')?.[0]
  const bnd = alt ? parseBreakend(alt) : undefined
  const startPos = feature.get('start')
  const refName = feature.get('refName')
  const f = (ref: string) => assembly.getCanonicalRefName(ref) || ref

  if (alt === '<TRA>') {
    const INFO = feature.get('INFO')
    return {
      pos: startPos,
      refName: f(refName),
      mateRefName: f(INFO.CHR2[0]),
      matePos: INFO.END[0] - 1,
    }
  } else if (bnd?.MatePosition) {
    const matePosition = bnd.MatePosition.split(':')
    return {
      pos: startPos,
      refName: f(refName),
      mateRefName: f(matePosition[0]!),
      matePos: +matePosition[1]! - 1,
    }
  } else if (feature.get('mate')) {
    const mate = feature.get('mate')
    return {
      pos: startPos,
      refName: f(refName),
      mateRefName: f(mate.refName),
      matePos: mate.start,
    }
  } else {
    return {
      pos: startPos,
      refName: f(refName),
      mateRefName: f(refName),
      matePos: feature.get('end'),
    }
  }
}
