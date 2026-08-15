import type { StatusCallback } from '../util/progress.ts'
import type { Feature } from '../util/simpleFeature.ts'
import type { StopToken } from '../util/stopToken.ts'
import type { NoAssemblyRegion } from '../util/types/index.ts'
import type { RpcResult } from './RpcServer.ts'

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
  }
  CoreGetRegionByteEstimate: {
    args: {
      adapterConfig: Record<string, unknown>
      regions: RegionLike[]
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
    return: string
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
 * report — so they ride `rpcManager.call`'s fourth parameter and
 * `BaseRpcDriver.call` merges them into what the worker sees. A registry entry
 * that declares them is stating something it does not get to decide.
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

/**
 * Which session the call belongs to. Like {@link RpcHandles}, a property of the
 * call rather than of any payload — `rpcManager.call` takes it as its FIRST
 * parameter and merges it into the args bag itself, so no caller has ever
 * written it and no registry entry gets to require it.
 *
 * Twenty-two entries declared it anyway, and the cost was the shape this file
 * keeps paying for: `RpcCallArgs` had to `Omit` it back off, because otherwise
 * every caller of those twenty-two would have had to pass a field the layer was
 * about to overwrite — while the other nineteen were fine. A subtraction that
 * exists to undo a declaration is the declaration admitting it was wrong.
 *
 * The worker side is the mirror of the handles, too: {@link RpcExecuteArgs}
 * intersects it in, so `execute` sees `sessionId` whether or not its entry
 * mentioned one, and `getAdapter(pm, sessionId, ...)` type-checks in all
 * forty-one rather than in twenty-two.
 */
export type RpcSession = {
  sessionId: string
}

/**
 * Everything the call layer contributes to what a worker body sees, as one
 * name: the session it is pinned to and the handles it can be stopped and can
 * report through. {@link RpcRouting} is not here — it never crosses.
 *
 * For the code that runs inside a worker this is the *fallback*, not the first
 * answer. Nearly every `execute` is one line long and hands its args to a
 * helper (`executeRenderHicData`, `getScoreMatrix`), and that helper should
 * take `RpcExecuteArgs<'ItsKey'>` — the same type its `execute` declares, so
 * the forward is an identity and a fourth call-level field reaches it without
 * an edit. `Payload & RpcCallContext` recomposes that derivation by hand, which
 * is how the three hand-written copies of `RpcCallArgs` drifted.
 *
 * Reach for it where there is no single key to name: a body registered under
 * two names (`executeDiagonalize`, `getScoreMatrix`), or a method-generic base
 * like {@link RenameRegionsArgs} that describes the shape rather than an entry.
 */
export type RpcCallContext = RpcSession & RpcHandles

/**
 * What the two `RpcExecute*` derivations resolve to for a method name that was
 * written out but has no registry entry: a shape nothing satisfies, so the miss
 * is a compile error naming the method rather than silence.
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
 * Derived rather than hand-written, for the reason {@link RpcExecuteReturn} is:
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
 * Where this one call runs. Like {@link RpcHandles} and for the same reason: a
 * property of the call rather than of the payload, so it belongs to every method
 * and to no registry entry.
 *
 * It was per-entry, and had got exactly as far as the handles had — declared by
 * two of the forty-one (`GetConsensusSequence`, `PileupGetGlobalValueForTag`,
 * both because a caller needed to pin one), which left pinning a driver a
 * type error on the other thirty-nine. `RpcManager.getDriverForCall` has read it
 * off the args bag the whole time, so the fix is to say so once here.
 *
 * Caller-side only: it picks the driver and is not payload, so it stays out of
 * {@link RpcExecuteArgs}. A worker seeing the extra field ignores it, the way it
 * ignores the `blobMap` that `serializeArguments` adds.
 */
export type RpcRouting = {
  rpcDriverName?: string
}

/**
 * What a CALLER passes to `rpcManager.call`: the method's own data, plus the
 * {@link RpcHandles} every method takes and the {@link RpcRouting} that decides
 * where it runs. No {@link RpcSession} — that one is the call's first
 * parameter, not part of the bag a caller builds.
 *
 * Exported and used by everything that types a `call` — `RpcManager` itself and
 * the structural `RpcMethodCaller` the clustering helpers take — because there
 * were three hand-written copies of this expression and the third one silently
 * lagged the other two the moment the handles moved.
 *
 * A written-out name with no entry is an error here for the reason it is one in
 * {@link RpcExecuteArgs}, and this is the side that matters more: there is one
 * `execute` per method and hundreds of call sites, and the fallback used to be
 * `Record<string, unknown>` — so a mistyped or renamed method name accepted any
 * args at all and failed at runtime in the worker, which is exactly the silence
 * {@link NotInRpcRegistry} exists to break. The bare `string` escape hatch is
 * still there, for the callers that genuinely dispatch on a variable.
 */
export type RpcCallArgs<M extends string> = M extends RpcMethodName
  ? RpcArgs<M & RpcMethodName> & RpcHandles & RpcRouting
  : string extends M
    ? Record<string, unknown> & RpcHandles & RpcRouting
    : NotInRpcRegistry<M>

// What a registered method's `execute` may resolve to: the declared return, or
// that return wrapped in rpcResult to carry transferables. An RpcMethodType
// parameterized with its own name (`RpcMethodType<'CoreGetRegions'>`) gets its
// executor checked against the registry, so a registry entry can't drift from
// what the worker actually sends back. `string` (the default) resolves to
// `unknown`, leaving unparameterized methods unconstrained; a name that is not a
// key resolves to NotInRpcRegistry, which nothing satisfies.
export type RpcExecuteReturn<M extends string> = M extends RpcMethodName
  ? RpcReturn<M & RpcMethodName> | RpcResult<RpcReturn<M & RpcMethodName>>
  : string extends M
    ? unknown
    : NotInRpcRegistry<M>

/**
 * Registry entries that declare a field belonging to the CALL rather than to
 * the payload. Should always be `never`; {@link AssertNoCallLevelFields} below
 * is what makes a non-empty one a compile error naming the entry.
 *
 * This went wrong three times with the same shape, which is why it is checked
 * rather than written down. Each time a caller needed one of these on one
 * method, the field went into that method's `args`, and the other forty then
 * could not be passed it — so the property that belongs to every call became a
 * type error on all but the entry that happened to name it. The handles went
 * that way (`CoreGetExportData` shipped uncancellable), `rpcDriverName` went
 * the same way after them, and `sessionId` was the oldest of the three.
 *
 * `sessionId` is the one that shows what a missing check costs over time: it
 * was never a type error, because `RpcCallArgs` subtracted it back off with an
 * `Omit`, so nothing ever pushed back and it spread to 22 of the 41 entries
 * before anyone counted. The union covers all three now, and the `Omit` is
 * gone.
 */
export type EntriesDeclaringCallLevelFields = {
  [K in RpcMethodName]: Extract<
    keyof RpcArgs<K>,
    keyof RpcCallContext | keyof RpcRouting
  > extends never
    ? never
    : K
}[RpcMethodName]

// Fails as "Type 'X' does not satisfy the constraint 'never'", naming the entry
// that has to give the field back to the call layer.
type AssertNoCallLevelFields<T extends never> = T
export type _NoCallLevelFieldsInRegistry =
  AssertNoCallLevelFields<EntriesDeclaringCallLevelFields>
