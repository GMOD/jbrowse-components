import type { StatusCallback } from '../util/progress.ts'
import type { UnwrapRpcResult } from '../util/rpc.ts'
import type { Feature, SimpleFeatureSerialized } from '../util/simpleFeature.ts'
import type { StopToken } from '../util/stopToken.ts'
import type { NoAssemblyRegion } from '../util/types/index.ts'
import type { RpcResult } from './RpcServer.ts'
import type { ByteEstimateScope } from './byteBudget.ts'

export interface RegionLike {
  refName: string
  start: number
  end: number
  assemblyName: string
}

export interface RpcRegistry {
  CoreGetRefNames: {
    args: {
      adapterConfig: Record<string, unknown>
      sequenceAdapter?: Record<string, unknown>
      assemblyName?: string
    }
    return: string[]
  }
  CoreGetRegions: {
    args: {
      adapterConfig: Record<string, unknown>
    }
    // a RegionsAdapter names refNames only — the assembly it belongs to is the
    // caller's context, not the adapter's, so no assemblyName comes back
    return: NoAssemblyRegion[]
  }
  CoreGetSequence: {
    args: {
      region: RegionLike
      adapterConfig: Record<string, unknown>
    }
    return: string | undefined
  }
  CoreGetFeatures: {
    args: {
      regions: RegionLike[]
      adapterConfig: Record<string, unknown>
      sequenceAdapter?: Record<string, unknown>
      opts?: Record<string, unknown>
    }
    return: Feature[]
    // deserializeReturn rebuilds each of these into a SimpleFeature
    wire: SimpleFeatureSerialized[]
  }
  CoreGetRegionByteEstimate: {
    args: {
      adapterConfig: Record<string, unknown>
      regions: RegionLike[]
      /**
       * Which question about the region set to answer, because a byte budget
       * has a **scope** and the two in this codebase differ. Required, with no
       * default, so a third caller has to say which one its budget is.
       *
       * - `largestRegion` — the biggest single region, for a budget enforced
       *   once **per region**. The region-too-large gate's is: every region is
       *   checked against the same limit, so a multi-region view where each
       *   region individually fits must not be blanked by what they add up to.
       * - `wholeRequest` — every region's chunks merged and summed, for a
       *   budget on the **whole download**. "Save track data" pulls all of
       *   them in one go, so that total is what it has to ask permission for,
       *   and merging is what stops two regions sharing a BGZF block being
       *   charged for it twice.
       *
       * The scope used to be implicit: `getRegionByteSize` merges and sums by
       * construction, so every caller silently inherited `wholeRequest`,
       * including the gate whose budget is per-region. A whole-genome VCF in
       * this repo bannered on a total more than 5x its own largest region,
       * while canvas — which measures one region per call — rendered the same
       * file. Both figures, and what splitting the call costs, are in
       * agent-docs/reference/REGION_TOO_LARGE.md § "A budget has a scope".
       */
      scope: ByteEstimateScope
      headers?: Record<string, string>
    }
    return: number | undefined
  }
  // A file header/metadata block is whatever the format carries — adapters
  // declare `getHeader`/`getMetadata` as `unknown` and callers narrow (a VCF
  // header arrives as a string, a hic header as an object). Claiming
  // `Record<string, unknown> | null` here read as a guarantee the worker never
  // made.
  CoreGetInfo: {
    args: {
      adapterConfig: Record<string, unknown>
    }
    return: unknown
  }
  CoreGetMetadata: {
    args: {
      adapterConfig: Record<string, unknown>
    }
    return: unknown
  }
  CoreGetExportData: {
    args: {
      regions: RegionLike[]
      adapterConfig: Record<string, unknown>
      formatType: string
      opts?: Record<string, unknown>
    }
    // undefined means "this adapter does not write this format" — distinct from
    // an empty region, and the signal the caller falls back to features on
    return: string | undefined
  }
  CoreFreeResources: {
    args: Record<string, unknown>
    return: void
  }
}

export type RpcMethodName = keyof RpcRegistry

export type RpcArgs<M extends RpcMethodName> = RpcRegistry[M]['args']

export type RpcReturn<M extends RpcMethodName> = RpcRegistry[M]['return']

/**
 * The caller's handles on an operation: how to stop it, and where it reports.
 *
 * Deliberately NOT part of any method's `args`. They are properties of the
 * call, not of the payload — every method can be cancelled and every method can
 * report — so they are part of {@link RpcCallArgs} instead, accepted for every
 * method whatever its entry says. A registry entry that declares them is stating
 * something it does not get to decide.
 *
 * They used to be per-entry, and the cost was not the 82 repeated lines: it was
 * that omitting them made a method silently uncancellable and silent, with the
 * call site still type-checking (an `...opts` spread suppresses the
 * excess-property check). `CoreGetExportData` shipped that way.
 *
 * A `type`, not an `interface`, and that is load-bearing rather than style. An
 * interface gets no implicit index signature, and an intersection containing one
 * inherits the lack — so `RpcExecuteArgs<M>` would stop being assignable to the
 * `Record<string, unknown>` that adapter options are typed as. Handing the whole
 * args bag to the adapter is how most methods forward these two without naming
 * them (`getRefNames(deserializedArgs)`), so an interface here breaks exactly
 * the pattern the type exists to support.
 */
export type RpcHandles = {
  stopToken?: StopToken
  statusCallback?: StatusCallback
}

// Like RpcHandles: a property of the call, not of any payload. `rpcManager.call`
// takes it as its first parameter and merges it in, so no caller writes one.
export type RpcSession = {
  sessionId: string
}

// What the call layer adds to every payload the worker sees. A helper factored
// out of one method's `execute` takes that method's `RpcExecuteArgs<'Key'>`
// instead; this is for the ones with no single key — a body registered under
// two names, or a method-generic base like RenameRegionsArgs.
export type RpcCallContext = RpcSession & RpcHandles

/**
 * What {@link RpcExecuteArgs} and {@link RpcWireReturn} resolve to for a method
 * name that was written out but has no registry entry: a shape nothing
 * satisfies, so the miss is a compile error naming the method rather than
 * silence.
 *
 * The silence was the problem. Both derivations are conditionals over `keyof
 * RpcRegistry`, and a name that misses falls out the bottom — where `unknown`
 * used to be. So `RpcMethodType<'GetFeatureDetails'>` type-checked with an
 * `execute` free to take and return anything at all. `GetFeatureDetails` is the
 * *class* name; the registry key beside it is `GetPileupFeatureDetails`, and
 * both classes called `GetFeatureDetails` (alignments, canvas) register under a
 * name their class does not carry — so the wrong guess is the natural one, and
 * an opt-in that silently opts you back out is worse than none, because it
 * reads as checked.
 *
 * Only for a name written out. The bare default `string` is the escape hatch
 * documented on {@link RpcMethodType} and still resolves to `unknown`;
 * `string extends M` is what tells the two apart.
 */
export interface NotInRpcRegistry<M extends string> {
  __rpcRegistryError: `no RpcRegistry entry for '${M}'`
}

/**
 * What a registered method's `execute` actually receives: its declared args,
 * plus the session it is pinned to, plus the handles the driver merged in.
 *
 * Derived rather than hand-written, for the reason {@link RpcWireReturn} is:
 * the return type has been checked against the registry for a while and the
 * args have not, which is the whole reason the two could drift. A method
 * parameterized with its own name (`RpcMethodType<'CoreGetSequence'>`) gets
 * both ends checked.
 */
export type RpcExecuteArgs<M extends string> = M extends RpcMethodName
  ? RpcArgs<M & RpcMethodName> & RpcCallContext
  : string extends M
    ? unknown
    : NotInRpcRegistry<M>

/**
 * What a CALLER passes to `rpcManager.call`: the method's own data, plus the
 * {@link RpcHandles} every method takes. No {@link RpcSession} — that one is
 * the call's first parameter, not part of the bag a caller builds.
 *
 * Exported and used by everything that types a `call` — `RpcManager` itself and
 * the structural `RpcMethodCaller` the clustering helpers take — because there
 * were three hand-written copies of this expression and the third one silently
 * lagged the other two the moment the handles moved.
 *
 * A written-out name with no entry lands on {@link NotInRpcRegistry}; it used to
 * fall through to `Record<string, unknown>`, so a mistyped name accepted any
 * args and failed at runtime in the worker. Bare `string` is still the hatch for
 * a caller dispatching on a variable.
 */
export type RpcCallArgs<M extends string> = M extends RpcMethodName
  ? RpcArgs<M & RpcMethodName> & RpcHandles
  : string extends M
    ? Record<string, unknown> & RpcHandles
    : NotInRpcRegistry<M>

/**
 * What a registered method's `execute` resolves to. An RpcMethodType
 * parameterized with its own name (`RpcMethodType<'CoreGetRegions'>`) gets its
 * executor checked against this, so a registry entry can't drift from what the
 * worker actually sends back. `string` (the default) resolves to `unknown`,
 * leaving unparameterized methods unconstrained; a name that is not a key
 * resolves to NotInRpcRegistry, which nothing satisfies.
 *
 * `RpcReturn` is what the CALLER gets, this is what went over, and fifteen
 * entries differ in one of two ways: the return is wrapped in `rpcResult` so
 * postMessage can transfer its buffers, or `deserializeReturn` rebuilds it
 * (features travel serialized and arrive as `SimpleFeature`s). An entry says
 * which, beside the `return` it has to be read against:
 *
 * - **`transferables: true`** — the whole return is wrapped. Ten entries.
 * - **`transferables: T`** — only the `T` arm of a union return is, because only
 *   that arm owns any buffers; the canvas gates wrap their data half and not
 *   their region-too-large half. Two entries.
 * - **`wire: T`** — the return is not what went over at all, and
 *   `deserializeReturn` is what closes the gap. Three entries.
 *
 * The first two are FACTS, not types, so the wire shape is derived from the
 * `return` and the two cannot come apart. The gates restated theirs until the
 * fact got an argument — and a restatement of a union some other file owns is
 * the kind that drifts, since editing `RenderFeatureDataResult` was not visibly
 * editing this. Only `wire:` restates now, which is why
 * {@link _NoRedundantWireInRegistry} fails compilation on one the derivation
 * could have produced: two spellings of "the wire differs" is how the field got
 * two meanings the first time.
 *
 * All of it was a second type parameter on the class until recently, which is a
 * copy of the registry rather than a reference to it — `RpcResult<
 * WiggleDataResult[]> | number` on RenderWiggleData type-checked clean while
 * callers went on receiving `WiggleDataResult[]`.
 */
export type RpcWireReturn<M extends string> = M extends RpcMethodName
  ? WireOf<RpcRegistry[M & RpcMethodName]>
  : string extends M
    ? unknown
    : NotInRpcRegistry<M>

// `transferables: true` is matched ahead of the arm case, or `true` lands in
// the `infer Wrapped` branch and wraps the literal instead of the return.
type WireOf<Entry> = Entry extends { wire: infer W }
  ? W
  : Entry extends { transferables: true; return: infer R }
    ? RpcResult<R>
    : Entry extends { transferables: infer Wrapped; return: infer R }
      ? RpcResult<Wrapped> | Exclude<R, Wrapped>
      : Entry extends { return: infer R }
        ? R
        : never

/**
 * {@link RpcWireReturn} with the `rpcResult` envelope off: what
 * {@link unwrapRpcResult} hands a `deserializeReturn` to rebuild the caller's
 * value from, and — for the majority of methods, which do not override it —
 * what the caller gets.
 */
export type RpcUnwrappedWireReturn<M extends string> = UnwrapRpcResult<
  RpcWireReturn<M>
>

/**
 * What the CALLER of a registered method ends up holding: the entry's `return`.
 *
 * The counterpart of {@link RpcCallArgs}, and here rather than on `RpcManager`
 * for the reason that one is: `RpcManager.call` is not the only signature that
 * has to state it. `RpcMethodType.deserializeReturn` — the code that actually
 * PRODUCES this value, by rebuilding the wire shape — returned `unknown`, so
 * the registry's `return` was a claim checked against `execute` (through
 * {@link RpcWireReturn}) and against nothing at all on the way back out;
 * `RpcManager.call` then cast to it. Typing the hook with this is what closes
 * that half, and it closes covariantly, which is the direction that bites.
 */
export type RpcCallReturn<M extends string> = M extends RpcMethodName
  ? RpcReturn<M & RpcMethodName>
  : string extends M
    ? unknown
    : NotInRpcRegistry<M>

/**
 * Registry entries that declare a field belonging to the CALL rather than to
 * the payload. Should always be `never`; {@link AssertNoCallLevelFields} below
 * is what makes a non-empty one a compile error naming the entry.
 *
 * Checked rather than written down because it went wrong the same way twice: a
 * caller needs the field on one method, it goes into that method's `args`, and
 * the other forty can no longer be passed it. The handles went that way
 * (CoreGetExportData shipped uncancellable), and `sessionId` spread to 22 of 41
 * entries because `RpcCallArgs` had been subtracting it back off.
 */
export type EntriesDeclaringCallLevelFields = {
  [K in RpcMethodName]: Extract<
    keyof RpcArgs<K>,
    keyof RpcCallContext
  > extends never
    ? never
    : K
}[RpcMethodName]

// Fails as "Type 'X' does not satisfy the constraint 'never'", naming the entry
// that has to give the field back to the call layer.
type AssertNoCallLevelFields<T extends never> = T
export type _NoCallLevelFieldsInRegistry =
  AssertNoCallLevelFields<EntriesDeclaringCallLevelFields>

/**
 * Entries whose `wire` says nothing `transferables` could not have derived —
 * the wire unwraps to the declared `return`, so no `deserializeReturn` is
 * closing any gap and the restatement is only waiting to drift from the type it
 * copies. Should always be `never`.
 *
 * The rule this keeps: `wire:` means "the caller does not receive what the
 * worker sent, and a `deserializeReturn` rebuilds it". It meant that AND "only
 * part of the return is wrapped" until the latter became `transferables: T`,
 * and a field with two meanings is one nobody can read off a single entry.
 */
export type EntriesWithRedundantWire = {
  [K in RpcMethodName]: RpcRegistry[K] extends { wire: unknown }
    ? RpcUnwrappedWireReturn<K> extends RpcReturn<K>
      ? K
      : never
    : never
}[RpcMethodName]

// Fails as "Type 'X' does not satisfy the constraint 'never'", naming the entry
// whose `wire` line should be a `transferables` one (or nothing at all).
type AssertNoRedundantWire<T extends never> = T
export type _NoRedundantWireInRegistry =
  AssertNoRedundantWire<EntriesWithRedundantWire>
