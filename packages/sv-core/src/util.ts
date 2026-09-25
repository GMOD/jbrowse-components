import { assembleLocString, getEnv, getSession } from '@jbrowse/core/util'
import {
  SV_SYMBOLIC_ALLELES,
  breakendKeepsDirections,
  getBreakendMateLocString,
  parseSvAlt,
  safeParseBreakend,
} from '@jbrowse/core/util/svAlt'
import { openAssemblyInLinearView } from '@jbrowse/core/util/tracks'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type {
  AbstractViewContainer,
  AssemblyHost,
  DialogHost,
  Feature,
  NotificationSink,
} from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * What launching a breakpoint split view asks of its host. Stated once because
 * the launch is a chain — dialog, then one of two navigators, then the view
 * reuse — and each link wants a subset of it.
 */
export {
  SV_SYMBOLIC_ALLELES,
  breakendKeepsDirections,
  getBreakendMateLocString,
  parseSvAlt,
  safeParseBreakend,
}

export interface BreakpointSplitViewHost
  extends AbstractViewContainer, AssemblyHost, NotificationSink, DialogHost {}

/**
 * #api
 * Screen-x of the far end of a breakend's direction tick at screen-x `x`.
 *
 * `keepsDir` is genomic (see `breakendKeepsDirections`) and `reversed` is what
 * turns it into a screen direction, so both are required: a caller cannot
 * compile without answering the question. A reversed displayed region mirrors
 * the axis, so a tick that ignores it points at the side the derivative
 * discards rather than the side it keeps.
 */
export function breakendTickPx(
  x: number,
  keepsDir: number,
  reversed: boolean,
  lengthPx = 20,
) {
  return x + lengthPx * keepsDir * (reversed ? -1 : 1)
}

/**
 * One end of a paired record, 0-based and half-open like every other coordinate
 * on a feature.
 */
export interface FeatureEnd {
  refName: string
  start: number
  end: number
  /** which way the sequence this end keeps runs from it: 1 right, -1 left, 0 unknown */
  mateDirection: number
}

const UNPAIRED_END: FeatureEnd = {
  refName: 'unknown',
  start: 0,
  end: 0,
  mateDirection: 0,
}

/**
 * #api
 * Both ends of a paired record, off whichever of the two things a producer
 * states the far one with: the `mate` field a paired adapter fills in, or a VCF
 * `ALT` this parses. `paired` is false for a record that names no other end,
 * and `k2` is then a placeholder no view resolves.
 *
 * One resolver where there were three — the arc display's endpoint pair,
 * `svMateLocus`'s far end for a chain walk, and `pairedEndsLocString`'s two
 * windows for the row menu. Each spelled the 1-based-to-interbase shift itself
 * (`parseSvAlt` reports VCF's 1-based position while `mate.start` is already
 * 0-based) and two of them read `ALT` ahead of `mate` while the third read
 * `mate` first.
 */
export function makeFeaturePair(feature: Feature, alt?: string) {
  const start = feature.get('start')
  const parsed = parseSvAlt(feature, alt)
  const mate = feature.get('mate') as Partial<FeatureEnd> | undefined
  const isSymbolic =
    alt !== undefined && SV_SYMBOLIC_ALLELES.some(a => alt.startsWith(a))
  // a paired adapter with no VCF ALT to parse (StarFusion, and any adapter that
  // knows which side of its own breakpoint is retained) states the tick on the
  // feature the way it states the mate's on `mate`
  const own = feature.get('mateDirection')
  const there =
    mate?.refName !== undefined && mate.start !== undefined
      ? {
          ...mate,
          refName: mate.refName,
          start: mate.start,
          end: mate.end ?? mate.start + 1,
          mateDirection: mate.mateDirection ?? 0,
        }
      : parsed
        ? {
            refName: parsed.mateRefName,
            start: parsed.matePos - 1,
            end: parsed.matePos,
            mateDirection: parsed.mateDirection ?? 0,
          }
        : undefined
  return {
    k1: {
      refName: feature.get('refName'),
      start,
      // symbolic alleles: an arc spans start→end, so the local end collapses to
      // start + 1
      end: parsed && isSymbolic ? start + 1 : feature.get('end'),
      mateDirection:
        parsed?.joinDirection ?? (typeof own === 'number' ? own : 0),
    },
    k2: there ?? UNPAIRED_END,
    paired: there !== undefined,
  }
}

export type FeaturePair = ReturnType<typeof makeFeaturePair>

/**
 * #api
 * Where a record's other end is, in the feature's own refName namespace and
 * 0-based like every other coordinate on a feature.
 *
 * `undefined` when the record names no other end, which is most of a VCF: a
 * plain SNV, or an indel that is only ever its own span.
 */
export function svMateLocus(feature: Feature) {
  const { k2, paired } = makeFeaturePair(
    feature,
    (feature.get('ALT') as string[] | undefined)?.[0],
  )
  return paired ? { refName: k2.refName, pos: k2.start } : undefined
}

/**
 * One end of a junction: the base beside the join on the side this end keeps,
 * 0-based.
 */
export interface JunctionEnd {
  refName: string
  pos: number
  /** which way the sequence this end keeps runs from it: 1 right, -1 left, 0 unknown */
  keeps: number
}

function keepsOf(mateDirection: unknown, strand: unknown) {
  if (typeof mateDirection === 'number') {
    return mateDirection
  }
  // a BEDPE strand names the side of the block the junction is on: `+` its
  // end, so the block keeps the sequence to its left
  return strand === 1 ? -1 : strand === -1 ? 1 : 0
}

function joinBase(
  self: { start: number; end: number; keeps: number },
  other: { start: number; end: number },
) {
  const keeps =
    self.keeps || (self.start + self.end <= other.start + other.end ? -1 : 1)
  return keeps === -1 ? self.end - 1 : self.start
}

function symbolicKeeps(feature: Feature, alt: string) {
  if (alt.startsWith('<DEL')) {
    return [-1, 1] as const
  }
  if (alt.startsWith('<DUP')) {
    return [1, -1] as const
  }
  const tra = readTranslocationMate(
    (feature.get('INFO') as
      | Parameters<typeof readTranslocationMate>[0]
      | undefined) ?? {},
  )
  return [tra?.myKeepsDir ?? 0, tra?.mateKeepsDir ?? 0] as const
}

/**
 * #api
 * Where a paired record's junction is at each of its two ends, and which side
 * of it each end keeps — the one answer every launcher, the row menu and the
 * chain walk take, whether the record is a VCF breakend, a symbolic SV or a
 * paired adapter's row (BEDPE, STAR-Fusion). Refnames are as the record spells
 * them. `undefined` for a record naming no other end.
 *
 * A VCF end is its own position. A paired adapter's end is a block, and the
 * junction is the block's edge on the side the end keeps: stated by
 * `mateDirection` where the adapter knows it, read off a BEDPE strand
 * otherwise, and with neither the two blocks face each other.
 */
export function junctionEnds(
  feature: Feature,
): { own: JunctionEnd; mate: JunctionEnd } | undefined {
  const refName = feature.get('refName')
  const mate = feature.get('mate') as
    | (Partial<FeatureEnd> & { strand?: number })
    | undefined
  if (mate?.refName !== undefined && mate.start !== undefined) {
    const self = {
      start: feature.get('start'),
      end: feature.get('end'),
      keeps: keepsOf(feature.get('mateDirection'), feature.get('strand')),
    }
    const far = {
      start: mate.start,
      end: mate.end ?? mate.start + 1,
      keeps: keepsOf(mate.mateDirection, mate.strand),
    }
    return {
      own: { refName, pos: joinBase(self, far), keeps: self.keeps },
      mate: {
        refName: mate.refName,
        pos: joinBase(far, self),
        keeps: far.keeps,
      },
    }
  }
  const alt = (feature.get('ALT') as string[] | undefined)?.[0]
  const parsed = parseSvAlt(feature, alt)
  if (!parsed || alt === undefined) {
    return undefined
  }
  const [ownKeeps, mateKeeps] =
    parsed.joinDirection === undefined
      ? symbolicKeeps(feature, alt)
      : [parsed.joinDirection, parsed.mateDirection ?? 0]
  return {
    own: { refName, pos: feature.get('start'), keeps: ownKeeps },
    mate: {
      refName: parsed.mateRefName,
      pos: parsed.matePos - 1,
      keeps: mateKeeps,
    },
  }
}

/**
 * #api
 * Both ends of a paired record as one loc string an LGV opens side by side,
 * `windowBp` either side of each junction. Each panel is turned so the sequence
 * its end keeps reads left to right into the join. Two ends of one contig
 * closer than a window collapse to the single span between them. `undefined`
 * for a record with one end.
 */
export function pairedEndsLocString(feature: Feature, windowBp: number) {
  const ends = junctionEnds(feature)
  if (!ends) {
    return undefined
  }
  const { own, mate } = ends
  const window = (end: JunctionEnd, side: 'left' | 'right') =>
    assembleLocString({
      refName: end.refName,
      start: Math.max(0, end.pos - windowBp),
      end: end.pos + windowBp,
    }) + (panelIsTurned(end.keeps, side) ? '[rev]' : '')
  return own.refName === mate.refName &&
    Math.abs(own.pos - mate.pos) < 2 * windowBp
    ? assembleLocString({
        refName: own.refName,
        start: Math.max(0, Math.min(own.pos, mate.pos) - windowBp),
        end: Math.max(own.pos, mate.pos) + windowBp,
      })
    : `${window(own, 'left')} ${window(mate, 'right')}`
}

/**
 * #api
 * Whether the panel showing an end has to be turned for the join to read left
 * to right across the seam: an end keeping the sequence to its RIGHT is
 * reversed on the left panel, one keeping its LEFT is reversed on the right.
 */
export function panelIsTurned(keeps: number, side: 'left' | 'right') {
  return keeps === (side === 'left' ? 1 : -1)
}

/**
 * #api
 * A breakend locstring reduced to the form two spellings of one locus compare
 * equal in.
 *
 * Case, because that is what the two halves of one record disagree about:
 * nanomonsv writes CHROM `chr3` and spells the same contig `CHR3` inside the ALT
 * bracket, and all 66 BND records of the COLO829 callset the cancer_sv demo
 * serves do it. Case is also the whole of the fallback `getCanonicalRefName`
 * makes, through `lowerCaseRefNameAliases`.
 *
 * For grouping two ends of one junction, not for navigation: `chr10` against
 * `10` still needs an assembly, and the callers here — the overlay's alt
 * matching and its breakend bucketing — hold features and no assembly. A
 * producer that has one resolves properly instead, through
 * `toCanonicalRefName`.
 */
export function breakendLocKey(locString: string) {
  return locString.toLowerCase()
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
 * The two canonical-refName junction positions a breakend/SV feature spans,
 * through `junctionEnds`; a record naming no other end spans its own extent.
 */
export function getBreakendCoveringRegions({
  feature,
  assembly,
}: {
  feature: Feature
  assembly: Assembly
}) {
  const f = toCanonicalRefName(assembly)
  const ends = junctionEnds(feature)
  const refName = f(feature.get('refName'))
  return ends
    ? {
        pos: ends.own.pos,
        refName,
        mateRefName: f(ends.mate.refName),
        matePos: ends.mate.pos,
      }
    : {
        pos: feature.get('start'),
        refName,
        mateRefName: refName,
        matePos: feature.get('end'),
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
  session: AssemblyHost
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
  // A STRANDS char names the strand the record is ON, and an end on `+` keeps
  // the sequence to its LEFT — so the keeps-direction (`breakendKeepsDirections`,
  // +1 = right) is its negation. Resolved here so the one consumer that draws
  // these as ticks does not have to know that, which is how the two conventions
  // came to sit a negation apart in the first place.
  const sign = (s: string) => (s === '+' ? -1 : s === '-' ? 1 : 0)
  return {
    chr,
    pos,
    myDir: myDir ?? '.',
    mateDir: mateDir ?? '.',
    myKeepsDir: sign(myDir ?? '.'),
    mateKeepsDir: sign(mateDir ?? '.'),
  }
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

/**
 * #api
 * A feature widget's view when a launch can copy its tracks: a linear genome
 * view, never a circle, whose tracks carry displays a linear panel cannot draw.
 */
export function linearGenomeViewOf(view?: { type: string }) {
  return view && isLinearGenomeView(view) ? view : undefined
}

function isLinearGenomeView(view: {
  type: string
}): view is LinearGenomeViewModel {
  return view.type === 'LinearGenomeView'
}

/**
 * #api
 * Navigate a feature widget's view to `locString`. A view that cannot navigate
 * to a locus, such as the circular view, opens the locus in a linear genome
 * view of its first assembly with the widget's track.
 */
export function navToLoc(
  locString: string,
  model: IAnyStateTreeNode,
  grow?: number,
) {
  const session = getSession(model)
  const { view } = model
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (!view) {
    session.notify('No view associated with this view anymore')
    return
  }
  const assemblyName = getAssemblyName(view)
  const trackId: string | undefined = model.trackId
  const navigated =
    'navToLocString' in view
      ? view.navToLocString(locString, undefined, grow)
      : assemblyName !== undefined
        ? openAssemblyInLinearView({
            session,
            id: `${view.id}-linear`,
            assemblyName,
            loc: locString,
            tracks: trackId === undefined ? [] : [trackId],
          })
        : Promise.reject(new Error('This view names no assembly to open'))
  navigated.catch((e: unknown) => {
    console.error(e)
    session.notify(`${e}`)
  })
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
 * prefix gets a second view instead of reusing the first, and nothing reports
 * it.
 */
export function breakpointSplitViewId(ownerId: string, assemblyName: string) {
  return `${ownerId}_${assemblyName}_breakpointsplitview`
}
