import { parseBreakend } from '@gmod/vcf'
import { getEnv, getSession } from '@jbrowse/core/util'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'
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
 * #api
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
  const bnd = alt !== undefined ? parseBreakend(alt) : undefined
  const refName = feature.get('refName')

  if (alt !== undefined && SV_SYMBOLIC_ALLELES.some(a => alt.startsWith(a))) {
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
  } else if (bnd?.MatePosition !== undefined) {
    const [mateRefName, matePosStr] = bnd.MatePosition.split(':')
    if (
      mateRefName === undefined ||
      mateRefName === '' ||
      matePosStr === undefined ||
      matePosStr === ''
    ) {
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

/**
 * #api
 * Resolves the two canonical-refName endpoints a breakend/SV feature spans.
 */
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
  const f = (ref: string) => assembly.getCanonicalRefName(ref) ?? ref

  const parsed = parseSvAlt(feature, alt)
  if (parsed) {
    return {
      pos: startPos,
      refName: f(refName),
      mateRefName: f(parsed.mateRefName),
      matePos: parsed.matePos - 1, // convert to 0-based
    }
  } else if (feature.get('mate') !== undefined) {
    const mate = feature.get('mate') as {
      strand?: number
      start: number
      end?: number
      refName: string
    }
    const strand = feature.get('strand') as number | undefined
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

/**
 * #api
 * Loads the assembly for a breakend feature and resolves the two regions its
 * endpoints span. Throws if the assembly, its regions, or either endpoint's
 * region cannot be found.
 */
export async function getBreakendAssemblyRegions({
  feature,
  session,
  assemblyName,
}: {
  feature: Feature
  session: AbstractSessionModel
  assemblyName: string
}) {
  const { assemblyManager } = session
  const assembly = await assemblyManager.waitForAssembly(assemblyName)
  if (!assembly) {
    throw new Error(`assembly ${assemblyName} not found`)
  }
  if (!assembly.regions) {
    throw new Error(`assembly ${assemblyName} regions not loaded`)
  }
  const coverage = getBreakendCoveringRegions({ feature, assembly })
  const { refName, mateRefName } = coverage
  const region = assembly.regions.find(r => r.refName === refName)
  const mateRegion = assembly.regions.find(r => r.refName === mateRefName)
  if (!region || !mateRegion) {
    throw new Error(
      `regions ${refName}, ${mateRefName} not found in assembly ${assemblyName}`,
    )
  }
  return { coverage, region, mateRegion }
}

export function makeTitle(f: Feature) {
  const name = f.get('name')
  const id = f.get('id')
  const label =
    name !== undefined && name !== ''
      ? name
      : id !== undefined && id !== ''
        ? id
        : 'breakend'
  return `${label} split detail`
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
  return getEnv(getSession(model)).pluginManager.viewTypes.has(
    'BreakpointSplitView',
  )
}

export function navToLoc(
  locString: string,
  model: IAnyStateTreeNode,
  grow?: number,
) {
  const session = getSession(model)
  const { view } = model
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (view) {
    view.navToLocString(locString, undefined, grow).catch((e: unknown) => {
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
 * #api
 * bpPerPx that fits `windowSize` bp on each side of a breakpoint across the
 * view width. Falls back to a zoomed-in default when no window is requested.
 */
export function breakpointBpPerPx(windowSize: number, width: number) {
  return windowSize > 0 ? (windowSize * 2) / width : 10
}

/**
 * #api
 * Splits a region at `pos` into two halves that both include `pos`, so a
 * breakend there stays visible in each.
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
