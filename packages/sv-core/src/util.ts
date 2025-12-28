import { parseBreakend } from '@gmod/vcf'

import type { Track } from './types'
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
    const strand = feature.get('strand')
    const mateStrand = mate.strand
    // Use the correct "side" of the feature based on strand:
    // Forward strand (1): use end position (right side)
    // Reverse strand (-1): use start position (left side)
    const pos = strand === 1 ? feature.get('end') : startPos
    const matePos = mateStrand === 1 ? mate.start : mate.end ?? mate.start
    return {
      pos,
      refName: f(refName),
      mateRefName: f(mate.refName),
      matePos,
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

export function stripIds(arr: Track[]) {
  return arr.map(({ id, displays, ...rest }) => ({
    ...rest,
    displays: displays.map(({ id, ...rest }) => rest),
  }))
}

export function makeTitle(f: Feature) {
  return `${f.get('name') || f.get('id') || 'breakend'} split detail`
}

export interface Region {
  refName: string
  start: number
  end: number
  assemblyName?: string
}

export interface ViewWithAssemblyNames {
  assemblyNames: string[]
}

/**
 * Safely extracts the first assemblyName from a view's assemblyNames getter.
 * Returns undefined if the view or assemblyNames are not available.
 */
export function getAssemblyName(view?: ViewWithAssemblyNames) {
  return view?.assemblyNames[0]
}

/**
 * Splits a region at a breakend position into two overlapping regions.
 *
 * JBrowse uses 0-based, half-open coordinates where `end` is exclusive.
 * To ensure the breakend position is visible in both regions:
 * - Left region: ends at pos + 1 (includes position pos)
 * - Right region: starts at pos (includes position pos)
 *
 * This intentional overlap ensures features at the breakend are displayed.
 */
export function splitRegionAtPosition<
  T extends { refName: string; start: number; end: number },
>(
  region: T,
  pos: number,
  assemblyName?: string,
): [T & { assemblyName?: string }, T & { assemblyName?: string }] {
  return [
    {
      ...region,
      end: pos + 1,
      ...(assemblyName !== undefined && { assemblyName }),
    },
    {
      ...region,
      start: pos,
      ...(assemblyName !== undefined && { assemblyName }),
    },
  ]
}
