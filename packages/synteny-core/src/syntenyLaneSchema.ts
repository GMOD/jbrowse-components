import { renameDictLane } from './renameDictLane.ts'
import { makeStringDict, UNNAMED } from './stringDict.ts'

import type { SyntenyFeatureLanes } from './syntenyFeatureLanes.generated.ts'

/**
 * The lane table for `SyntenyFeatureData`: every field of the synteny RPC
 * payload, with the facts its writers and readers must agree on — the element
 * kind, the axis the lane describes (what `followAxes` swaps), the value
 * packed when the source has none, and which canonicalizer rewrites a
 * dictionary lane on the main thread.
 *
 * The payload used to be ~14 hand-maintained parallel lanes spelled out
 * independently in the interface, the worker's pack loop, the reader, the
 * renamers and the test harness, and the copies drifted (the harness once
 * packed `name ?? id` against production's `name ?? UNNAMED`). Now
 * `scripts/generateSyntenyLanes.ts` emits the `SyntenyFeatureLanes` interface
 * from this table, `packSyntenyLanes` packs the harness payload by walking it,
 * `canonicalizeSyntenyDictLanes` renames by it, and the one hand-written copy
 * left — the worker's hot pack loop in `executeSyntenyFeaturesAndPositions` —
 * is held to it by `syntenyLaneTable.test.ts`.
 *
 * A `string-dict` lane is a `<name>Dict`/`<name>Ids` field pair (see
 * `StringDict` for why the per-feature strings ship dictionary-encoded). An
 * `opaque` lane is a payload field whose shape is irregular enough that the
 * generator and the walkers skip it; its type and full story stay on the
 * hand-written `SyntenyFeatureData`, and it is listed here so the table is the
 * complete field census the pin test compares the real payload against.
 */
export type SyntenyLaneAxis = 'query' | 'mate' | 'neither'

/**
 * Which canonicalizer `canonicalizeSyntenyDictLanes` puts a dictionary lane
 * through: the query or target axis's refName resolver (one per axis, so two
 * contigs spelled alike on the two assemblies cannot collide), the assembly
 * manager's `getCanonicalAssemblyName`, or none. See
 * `agent-docs/reference/REFNAME_NAMESPACES.md`.
 */
export type SyntenyLaneRename = 'query' | 'target' | 'assembly' | 'none'

interface LaneCommon {
  readonly name: string
  readonly axis: SyntenyLaneAxis
  readonly doc: string
}
export interface SyntenyNumericLaneSpec extends LaneCommon {
  readonly kind: 'u32' | 'i8'
}
export interface SyntenyListLaneSpec extends LaneCommon {
  readonly kind: 'string[]'
}
export interface SyntenyDictLaneSpec extends LaneCommon {
  readonly kind: 'string-dict'
  /** what the packers write when the source carries no value; a lane without
   * one requires a value on every record */
  readonly sentinel: string | undefined
  readonly rename: SyntenyLaneRename
}
export interface SyntenyOpaqueLaneSpec extends LaneCommon {
  readonly kind: 'opaque'
}
export type SyntenyLaneSpec =
  | SyntenyNumericLaneSpec
  | SyntenyListLaneSpec
  | SyntenyDictLaneSpec
  | SyntenyOpaqueLaneSpec

export const SYNTENY_LANES = [
  {
    kind: 'i8',
    name: 'strands',
    axis: 'neither',
    doc: 'Alignment strand, +1 or -1 — the relative orientation of the two axes, so `followAxes` swaps it in neither direction.',
  },
  {
    kind: 'u32',
    name: 'starts',
    axis: 'query',
    doc: 'Chromosome-local feature start (not cumulative), so uint32 holds it as long as no single reference sequence exceeds 2^32 bp — an assumption we accept (agent-docs/ARCHITECTURE.md "Genome-size limits"). The feature-detail panel and the min-length cull read these; drawn positions come from Float64 cumBp arrays that never leave the worker (ADR-067).',
  },
  {
    kind: 'u32',
    name: 'ends',
    axis: 'query',
    doc: 'Chromosome-local feature end; see `starts`.',
  },
  {
    kind: 'string[]',
    name: 'featureIds',
    axis: 'neither',
    doc: 'Genuinely distinct per feature, so this one stays a `string[]`: a dictionary of 500k distinct strings costs the same clone plus an index array. See `makeStringDict`, which is also where the measurement lives.',
  },
  {
    kind: 'string-dict',
    name: 'name',
    axis: 'neither',
    sentinel: UNNAMED,
    rename: 'none',
    doc: 'A gene symbol (an MCScan or ortholog-table row) or nothing at all — a PAF names no features, and the packers write `UNNAMED` so "is this record named" resolves through `unnamedNameId` rather than restating the convention.',
  },
  {
    kind: 'string-dict',
    name: 'refName',
    axis: 'query',
    sentinel: undefined,
    rename: 'query',
    doc: "The contig on the query axis. The worker interns whatever spelling the file uses; the main thread rewrites it into the query assembly's canonical namespace, since every reader there (`dynamicBlocks`, `displayedRegions`, `assembly.refNames`) is canonical.",
  },
  {
    kind: 'string-dict',
    name: 'assemblyName',
    axis: 'query',
    sentinel: '',
    rename: 'none',
    doc: "The query row's assembly as the adapter spells it — deliberately NOT canonicalized: it goes back OUT, as the `regions[]` assembly of `SyntenyResolveMatchingRegion`, which the adapter matches against its own `assemblyNames[]`, so canonicalizing it would break the lookup that works.",
  },
  {
    kind: 'u32',
    name: 'mateStarts',
    axis: 'mate',
    doc: "Mate start in the mate contig's own bp, uint32 like `starts`. There is no mate name lane: `mate.name` was always undefined (no adapter sets it), so it was dropped.",
  },
  {
    kind: 'u32',
    name: 'mateEnds',
    axis: 'mate',
    doc: 'Mate end; see `mateStarts`.',
  },
  {
    kind: 'string-dict',
    name: 'mateRefName',
    axis: 'mate',
    sentinel: undefined,
    rename: 'target',
    doc: "The contig on the target axis — the new information a synteny feature carries, about a region nobody requested. It arrives in the file's spelling and is rewritten into the TARGET assembly's canonical namespace.",
  },
  {
    kind: 'string-dict',
    name: 'mateAssemblyName',
    axis: 'mate',
    sentinel: undefined,
    rename: 'assembly',
    doc: "The mate's assembly: the adapter's `assemblyNames[]` config text, verbatim. Canonicalized through `getCanonicalAssemblyName` because `pickFollowFeature`, `followWindowMapping` and `centerOnFeature` compare it against a view's `assemblyNames[0]`, which is canonical — a track declaring its second assembly by an alias otherwise draws its ribbons while the follow drops every candidate.",
  },
  {
    kind: 'opaque',
    name: 'attributes',
    axis: 'neither',
    doc: 'Float32 channel per numeric attribute, -1 for missing; see `SyntenyFeatureData`.',
  },
  {
    kind: 'opaque',
    name: 'attributeRanges',
    axis: 'neither',
    doc: 'The span each attribute channel actually covered; see `SyntenyFeatureData`.',
  },
  {
    kind: 'opaque',
    name: 'hasCigar',
    axis: 'neither',
    doc: 'Whether anything in this response carried an alignment string to walk; see `SyntenyFeatureData`.',
  },
  {
    kind: 'opaque',
    name: 'offscreenMates',
    axis: 'query',
    doc: 'Per-contig tally of alignments whose mate is not displayed; not per-feature. Its mate contigs name the TARGET assembly and are renamed by `renameOffscreenMates` (its `counts` must SUM on a dictionary collapse, which the generic lane rename cannot do).',
  },
  {
    kind: 'opaque',
    name: 'targetOffscreenMates',
    axis: 'mate',
    doc: 'The mirror tally from the second fetch; its mate contigs name the QUERY assembly. Renamed by `renameOffscreenMates`, like `offscreenMates`.',
  },
] as const satisfies readonly SyntenyLaneSpec[]

export type SyntenyLane = (typeof SYNTENY_LANES)[number]
export type SyntenyNumericLaneName = Extract<
  SyntenyLane,
  { kind: 'u32' | 'i8' }
>['name']
export type SyntenyDictLaneName = Extract<
  SyntenyLane,
  { kind: 'string-dict' }
>['name']
export type SyntenyListLaneName = Extract<
  SyntenyLane,
  { kind: 'string[]' }
>['name']

/** The payload field names one lane spec occupies — a dict lane is two. */
export function syntenyLaneFields(lane: SyntenyLaneSpec) {
  return lane.kind === 'string-dict'
    ? [`${lane.name}Dict`, `${lane.name}Ids`]
    : [lane.name]
}

/**
 * Pack the regular lanes from row objects by walking the table: one reader per
 * lane, the lane's own sentinel behind it, the same first-seen dictionary
 * interning the worker uses. The test harness's `packSyntenyFeatureData` is
 * the caller — a new lane in the table fails its typecheck until a reader is
 * supplied, which is what keeps the harness from drifting off production
 * again.
 */
export function packSyntenyLanes<Item>(
  items: readonly Item[],
  read: {
    numeric: Record<SyntenyNumericLaneName, (item: Item, i: number) => number>
    dict: Record<
      SyntenyDictLaneName,
      (item: Item, i: number) => string | undefined
    >
    list: Record<SyntenyListLaneName, (item: Item, i: number) => string>
  },
): SyntenyFeatureLanes {
  const out: Record<string, unknown> = {}
  for (const lane of SYNTENY_LANES) {
    if (lane.kind === 'u32' || lane.kind === 'i8') {
      const reader = read.numeric[lane.name]
      out[lane.name] =
        lane.kind === 'i8'
          ? Int8Array.from(items, reader)
          : Uint32Array.from(items, reader)
    } else if (lane.kind === 'string-dict') {
      const reader = read.dict[lane.name]
      const dict = makeStringDict()
      out[`${lane.name}Ids`] = Uint32Array.from(items, (item, i) => {
        const value = reader(item, i) ?? lane.sentinel
        if (value === undefined) {
          throw new Error(`lane ${lane.name}: no value and no sentinel`)
        }
        return dict.idFor(value)
      })
      out[`${lane.name}Dict`] = dict.dict
    } else if (lane.kind === 'string[]') {
      out[lane.name] = items.map(read.list[lane.name])
    }
  }
  return out as unknown as SyntenyFeatureLanes
}

/**
 * Rewrite every dictionary lane the table marks for renaming out of the
 * adapter's namespace, each through the resolver its `rename` names — so a new
 * dict lane added to the table is remapped without anyone remembering to
 * (forgetting was the refName-bug class this closes). The opaque offscreen
 * mate tallies are renamed beside this by `renameOffscreenMates`; see their
 * table entries.
 */
export function canonicalizeSyntenyDictLanes<T extends SyntenyFeatureLanes>(
  data: T,
  canonical: Record<
    Exclude<SyntenyLaneRename, 'none'>,
    (name: string) => string
  >,
): T {
  const out: Record<string, unknown> = { ...(data as object) }
  const raw = data as unknown as Record<string, unknown>
  for (const lane of SYNTENY_LANES) {
    if (lane.kind === 'string-dict' && lane.rename !== 'none') {
      const renamed = renameDictLane({
        dict: raw[`${lane.name}Dict`] as string[],
        ids: raw[`${lane.name}Ids`] as Uint32Array,
        canonical: canonical[lane.rename],
      })
      out[`${lane.name}Dict`] = renamed.dict
      out[`${lane.name}Ids`] = renamed.ids
    }
  }
  return out as T
}
