import { parseBreakend } from '@gmod/vcf'
import { getEnv, getSession } from '@jbrowse/core/util'

import type { Breakend } from '@gmod/vcf'
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
 * parseBreakend, honoring its `Breakend | undefined` signature. ALT strings are
 * user data and malformed breakends do occur; @gmod/vcf <=7.0.10 throws on them
 * instead of returning undefined, which would otherwise fail a whole render or
 * feature-parse pass over one bad allele. Use this everywhere rather than
 * importing parseBreakend directly; it can become a plain re-export once the
 * upstream fix ships.
 */
export function safeParseBreakend(alt: string) {
  try {
    return parseBreakend(alt)
  } catch {
    return undefined
  }
}

/**
 * #api
 * The mate locString ("chr2:100") of a parsed breakend, or undefined when it
 * names no navigable position. Two ALT forms reach here without one: a single
 * breakend (`.A` / `G.`) has no mate at all, and the symbolic-mate forms
 * (`G<DEL>`, `<DEL>G`) get a placeholder `<DEL>:1` from parseBreakend, which
 * puts a symbolic allele id where a contig name belongs. Callers that navigate
 * or split-view a mate must drop both rather than treat `<DEL>` as a refName.
 */
export function getBreakendMateLocString(breakend?: Breakend) {
  const matePosition = breakend?.MatePosition
  return matePosition === undefined || matePosition.startsWith('<')
    ? undefined
    : matePosition
}

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
      // Which way the sequence each end KEEPS runs from its breakpoint, as a
      // tick direction (1 = right, -1 = left) — the same convention
      // StarFusionAdapter's `tickDirection` states, since the paired-arc
      // display draws both through one `mateDirection` field.
      mateDirection?: number
      joinDirection?: number
    }
  | undefined {
  const bnd = alt !== undefined ? safeParseBreakend(alt) : undefined
  const mateLocString = getBreakendMateLocString(bnd)
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
  } else if (bnd !== undefined && mateLocString !== undefined) {
    const [mateRefName, matePosStr] = mateLocString.split(':')
    if (
      mateRefName === undefined ||
      mateRefName === '' ||
      matePosStr === undefined ||
      matePosStr === ''
    ) {
      return undefined
    }
    // `Join: 'right'` means the mate piece is joined to the RIGHT of the ref
    // base, so this end is the one that keeps the sequence to its left; the
    // bracket direction says the same thing about the mate. Both are therefore
    // the negation of the string they read, which is what these two used to
    // return.
    return {
      mateRefName,
      matePos: +matePosStr,
      mateDirection: bnd.MateDirection === 'left' ? -1 : 1,
      joinDirection: bnd.Join === 'left' ? 1 : -1,
    }
  }
  return undefined
}

/**
 * #api
 * Where a record's other end is, in the feature's own refName namespace and
 * 0-based like every other coordinate on a feature.
 *
 * The places that need it were each resolving it themselves — `parseSvAlt`
 * first, for a breakend or a symbolic allele carrying CHR2/END, then an
 * explicit `mate` field for a BEDPE row — and each had its own off-by-one to
 * get wrong, since `parseSvAlt` reports VCF's 1-based position while
 * `mate.start` is already 0-based.
 *
 * `undefined` when the record names no other end, which is most of a VCF: a
 * plain SNV, or an indel that is only ever its own span.
 */
export function svMateLocus(feature: Feature) {
  const alt = (feature.get('ALT') as string[] | undefined)?.[0]
  const parsed = parseSvAlt(feature, alt)
  if (parsed) {
    return { refName: parsed.mateRefName, pos: parsed.matePos - 1 }
  }
  const mate = feature.get('mate') as
    | { refName?: string; start?: number }
    | undefined
  return mate?.refName !== undefined && mate.start !== undefined
    ? { refName: mate.refName, pos: mate.start }
    : undefined
}

/**
 * Resolve a refName read out of a feature or an ALT string through the
 * assembly's aliases, leaving one it doesn't know alone. The two functions that
 * turn a VCF record into coordinates — `getBreakendCoveringRegions` here and
 * `junctionFromFeature` — both apply it to both ends, and share it so they
 * cannot drift into speaking different names for the same locus.
 */
export function toCanonicalRefName(assembly: Assembly) {
  return (ref: string) => assembly.getCanonicalRefName2(ref)
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
  const f = toCanonicalRefName(assembly)

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
  const region = assembly.getRegionForRefName(refName)
  const mateRegion = assembly.getRegionForRefName(mateRefName)
  if (!region || !mateRegion) {
    throw new Error(
      `regions ${refName}, ${mateRefName} not found in assembly ${assemblyName}`,
    )
  }
  // the assembly comes back out because resolving a third locus against it is
  // what a chain walk needs, and awaiting it a second time is a second chance
  // for the two to be different objects
  return { assembly, coverage, region, mateRegion }
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

/**
 * Whether `BreakpointSplitView` is registered at all, so a launch site can hide
 * a menu item a host without that plugin cannot honor.
 *
 * Reads the env off the node it is given rather than off `getSession(node)`.
 * The env is the tree's, identical from every node in it, so the hop through
 * the session bought nothing — and it made the function throw
 * `no session model found!` for the one caller that already had the session and
 * passed it (the spreadsheet's FeatureMenu), since `getSession` looks for a
 * session *ancestor* and a session has none. That took out five suites: the
 * throw happens during render, so the gate meant to remove an unusable menu
 * item removed the menu.
 */
export function hasBreakpointSplitView(model: IAnyStateTreeNode) {
  return getEnv(model).pluginManager.viewTypes.has('BreakpointSplitView')
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

/**
 * #api
 * Stable id for the breakpoint split view a given launcher spawns, so repeated
 * launches from the same place reuse one view instead of stacking a new one
 * each time. `ownerId` is whatever the launcher is: a spreadsheet view (shared
 * by the sheet's row menu and the SV inspector's chord clicks, which then land
 * in the same view), or a variant feature widget.
 *
 * Spelling it out inline is the same string until it isn't — the dialog appends
 * its own shape suffix to whatever it is handed, so a launcher that respells the
 * prefix quietly gets a second view rather than a broken one.
 */
export function breakpointSplitViewId(ownerId: string, assemblyName: string) {
  return `${ownerId}_${assemblyName}_breakpointsplitview`
}
