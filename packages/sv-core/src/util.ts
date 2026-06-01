import { parseBreakend } from '@gmod/vcf'
import { getEnv, getSession } from '@jbrowse/core/util'

import type { Track } from './types.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export const SV_SYMBOLIC_ALLELES = [
  '<TRA',
  '<DEL',
  '<INV',
  '<INS',
  '<DUP',
  '<CNV',
]

/**
 * Parse raw (non-assembly-resolved) mate coordinates from a VCF SV feature+alt.
 * Returns undefined when no mate coordinate info is found.
 */
export function parseSvAlt(
  feature: Feature,
  alt?: string,
):
  | {
      mateRefName: string
      matePos: number // VCF 1-based coordinate
      mateDirection?: number // for BND arrow rendering: 1=left, -1=right
      joinDirection?: number // for BND arrow rendering: -1=left, 1=right
    }
  | undefined {
  const bnd = alt ? parseBreakend(alt) : undefined
  const refName = feature.get('refName')

  if (alt && SV_SYMBOLIC_ALLELES.some(a => alt.startsWith(a))) {
    const info = feature.get('INFO') as
      | Record<string, (string | number)[]>
      | undefined
    const matePos = info?.END?.[0] as number | undefined
    if (matePos === undefined) {
      return undefined
    }
    return {
      mateRefName: (info?.CHR2?.[0] as string | undefined) ?? refName,
      matePos,
    }
  } else if (bnd?.MatePosition) {
    const [mateRefName, matePosStr] = bnd.MatePosition.split(':')
    if (!mateRefName || !matePosStr) {
      return undefined
    }
    return {
      mateRefName,
      matePos: +matePosStr,
      mateDirection: bnd.MateDirection === 'left' ? 1 : -1,
      joinDirection: bnd.Join === 'left' ? -1 : 1,
    }
  }
  return undefined
}

export function getBreakendCoveringRegions({
  feature,
  assembly,
}: {
  feature: Feature
  assembly: Assembly
}) {
  const startPos = feature.get('start')
  const refName = feature.get('refName')
  const alt = (feature.get('ALT') as string[] | undefined)?.[0]
  const f = (ref: string) => assembly.getCanonicalRefName(ref) || ref

  const parsed = parseSvAlt(feature, alt)
  if (parsed) {
    return {
      pos: startPos,
      refName: f(refName),
      mateRefName: f(parsed.mateRefName),
      matePos: parsed.matePos - 1, // convert to 0-based
    }
  } else if (feature.get('mate')) {
    const mate = feature.get('mate') as {
      strand: number
      start: number
      end?: number
      refName: string
    }
    const strand = feature.get('strand')!
    const mateStrand = mate.strand
    // Forward strand (1): use end position (right side)
    // Reverse strand (-1): use start position (left side)
    const pos = strand === 1 ? feature.get('end') : startPos
    const matePos = mateStrand === 1 ? mate.start : (mate.end ?? mate.start)
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

// Read the mate destination from a VCF translocation INFO record. CHR2/END
// give the mate ref+position; STRANDS[0] is a two-char code (e.g. "+-") where
// the first char is this side's strand and the second is the mate's. Returns
// undefined when CHR2/END aren't both present.
export function readTranslocationMate(info: {
  CHR2?: string[]
  END?: number[]
  STRANDS?: string[]
}) {
  const chr = info.CHR2?.[0]
  const pos = info.END?.[0]
  if (chr === undefined || pos === undefined) {
    return undefined
  }
  const [myDir, mateDir] = info.STRANDS?.[0]?.split('') ?? ['.', '.']
  return { chr, pos, myDir: myDir ?? '.', mateDir: mateDir ?? '.' }
}

export function hasBreakpointSplitView(model: IAnyStateTreeNode) {
  try {
    return !!getEnv(getSession(model)).pluginManager.getViewType(
      'BreakpointSplitView',
    )
  } catch {
    return false
  }
}

export function navToLoc(locString: string, model: IAnyStateTreeNode) {
  const session = getSession(model)
  const { view } = model
  if (view) {
    view.navToLocString(locString).catch((e: unknown) => {
      console.error(e)
      session.notify(`${e}`)
    })
  } else {
    session.notify('No view associated with this view anymore')
  }
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
