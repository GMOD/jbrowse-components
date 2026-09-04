import {
  reportLegacyInit,
  reportMalformedRows,
  reportUnknownKeys,
} from './unknownSnapshotKeys.ts'

// re-exported here because the surfaces that classify their own keys — a
// session spec, which launches without ever building a snapshot — reach the
// partition's vocabulary through this module
export { legacyInitMessage, unknownKeysMessage } from './unknownSnapshotKeys.ts'

import type {
  IAnyModelType,
  IModelType,
  IStateTreeNode,
  SnapshotIn,
} from '@jbrowse/mobx-state-tree'

/**
 * The slice of a PluginManager the partition reads: which view type a
 * snapshot's `type` names, and that type's state model as REGISTERED — the
 * one `extendViewType` may have composed more properties onto after the
 * factory wrapped its own.
 */
export interface ViewTypeLookup {
  viewTypes: { has: (name: string) => boolean }
  getViewType: (name: string) => {
    isStateModelLoaded: boolean
    stateModel: IAnyModelType
  }
}

/**
 * How a launch key's value is told apart from the state property of the same
 * name. A key whose name collides with nothing is `launch`; the rest name the
 * discriminator that splits one authored array into the recipe entries the
 * launcher resolves and the built snapshots MST restores.
 *
 * `replay` is the one that is not remapped at all: the value lands on its
 * property, and a copy rides in the blob so the launcher can run the ordered
 * imperative step the property write alone does not produce.
 */
export type LaunchKeyKind =
  | 'launch'
  | 'trackEntries'
  | 'rows'
  | 'highlightEntries'
  | 'replay'

export interface LaunchKeySpec {
  kind: LaunchKeyKind
}

export interface LaunchKeyRegistration<
  Commands,
  // `never` rather than `string` because this parameter reaches a mapped type:
  // a widened one turns `LaunchSnapshotIn` into an index signature, which
  // accepts every misspelling rather than failing the build. A reader that only
  // wants the list says `string` for itself.
  PassThrough extends string = never,
> {
  keys: Record<string, LaunchKeySpec>
  passThrough: readonly PassThrough[]
  /** never assigned; it carries `Commands` to `withLaunchInput`'s return type */
  commands?: Commands
}

/**
 * The launch keys a view captured, plus what it has to report.
 *
 * `Commands` is not made partial: hand-authored JSON is what fills this, so a
 * key the interface marks required is not a guarantee here either way, and the
 * launcher already guards the ones it cannot proceed without.
 */
export type LaunchInput<Commands> = Commands & {
  unknown?: Record<string, unknown>
  malformed?: Record<string, unknown>
  legacyInit?: boolean
}

// What afterAttach reports rather than applies. They live in the blob so the
// partition has one place to put everything, and `pendingLaunch` is what keeps
// them from reading as work to do.
const REPORTED = new Set(['unknown', 'malformed', 'legacyInit'])

/**
 * The blob when it still holds something to apply, else undefined. A view's
 * gates ask this rather than the raw property: a snapshot whose only launch
 * content was a typo has nothing to launch, and a view that thinks otherwise
 * waits on an assembly nobody named and never leaves the spinner.
 *
 * Returns the blob itself, never a copy — the launch autorun clears by
 * identity, and a fresh object per read strands the init it just applied.
 */
export function pendingLaunch<C>(launch: LaunchInput<C> | undefined) {
  return launch && Object.keys(launch).some(k => !REPORTED.has(k))
    ? launch
    : undefined
}

/**
 * A view's snapshot type, widened to the authored shape: every launch key is
 * accepted beside the declared properties, and a key that is both takes either
 * meaning. Excess-property checking then makes a misspelled key an error at
 * every literal site — a `defaultSession` view, an `addView` call, a
 * `createViewState` spec.
 */
export type LaunchSnapshotIn<
  M extends IAnyModelType,
  Commands,
  PassThrough extends string = never,
> = Omit<SnapshotIn<M>, keyof Commands> & {
  [K in keyof Commands]?: K extends keyof SnapshotIn<M>
    ? Commands[K] | SnapshotIn<M>[K]
    : Commands[K]
} & {
  [K in PassThrough]?: unknown
} & {
  /**
   * @deprecated v4's nesting. Write every setting directly on the view object;
   * this is unwrapped on the way in and warns.
   */
  init?: Commands
}

// Keys that are a view's identity or its plumbing rather than a setting: `type`
// picks the view, `id` is passed top-level so MST's optional identifier honors
// it, and `launch` is the blob the partition below fills.
type ReservedKey = 'id' | 'type' | 'launch'

/**
 * What a view can be launched with, derived: the keys its launcher interprets
 * (`Commands`) plus every declared property of its state model, optional, in
 * the property's own snapshot type. Nothing is restated, so a property is
 * authorable — and TYPED — from the line that declares it.
 *
 * ```ts
 * export type LinearSyntenyViewInit = ViewInit<
 *   LinearSyntenyViewStateModel,
 *   LinearSyntenyViewCommands
 * >
 * ```
 *
 * The twin of `LaunchSnapshotIn` above, from the other end: that one widens a
 * snapshot type for a literal MST site, this one is what a caller BUILDING a
 * spec annotates, so its commands stay required and its properties optional.
 */
export type ViewInit<M extends IAnyModelType, Commands> = Commands &
  Partial<Omit<SnapshotIn<M>, keyof Commands | ReservedKey>>

export type LaunchInputModel<
  M extends IAnyModelType,
  Commands,
  PassThrough extends string = never,
> =
  M extends IModelType<infer P, infer O, any, infer S>
    ? IModelType<P, O, LaunchSnapshotIn<M, Commands, PassThrough>, S>
    : never

/**
 * Declare one view's launch keys. The argument is
 * `Record<keyof Commands, LaunchKeySpec>`, so a command the view interprets and
 * nobody registered is a compile error rather than a key that partitions as a
 * typo and warns.
 *
 * `passThrough` names keys that are neither a launch key nor a declared
 * property and still belong on the snapshot — a legacy spelling the view's own
 * `preProcessSnapshot` converts.
 */
export function defineLaunchKeys<Commands>() {
  return <const P extends readonly string[] = readonly never[]>(
    keys: Record<keyof Commands, LaunchKeySpec>,
    { passThrough }: { passThrough?: P } = {},
  ): LaunchKeyRegistration<Commands, P[number]> => ({
    keys,
    passThrough: passThrough ?? [],
  })
}

// `id` picks up MST's optional identifier and `type` picks the view, so neither
// is ever a setting and neither can be lifted off the snapshot.
const IDENTITY = new Set(['id', 'type'])

const LAUNCH = 'launch'

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

// Each per-entry kind says only which entries are an authored recipe. A recipe
// goes to the blob for the launcher to resolve; everything else is a built
// snapshot and stays on the property, so a mixed array splits rather than
// picking one meaning for the whole thing.
function isRecipeEntry(kind: LaunchKeyKind, entry: unknown) {
  switch (kind) {
    case 'trackEntries':
      // a built track snapshot cannot carry `trackId` — BaseTrackModel does not
      // declare it. `type` does not discriminate: a spec writes display types
      // inline
      return (
        typeof entry === 'string' || (isObject(entry) && 'trackId' in entry)
      )
    case 'highlightEntries':
      // a string needs coerceHighlight and the assembly manager, neither of
      // which a pure preprocessor can reach; an object is the persisted shape
      return typeof entry === 'string'
    case 'rows':
      // a built row is a view snapshot, and every view's `type` is a required
      // literal
      return !(isObject(entry) && 'type' in entry)
    default:
      return true
  }
}

function splitEntries(kind: LaunchKeyKind, value: unknown) {
  const entries = Array.isArray(value) ? value : [value]
  const recipes = entries.filter(e => isRecipeEntry(kind, e))
  const built = entries.filter(e => !isRecipeEntry(kind, e))
  return {
    launch: recipes.length
      ? Array.isArray(value)
        ? recipes
        : value
      : undefined,
    state: built.length ? (Array.isArray(value) ? built : value) : undefined,
  }
}

interface Partitioned {
  state: Record<string, unknown>
  launch: Record<string, unknown>
  unknown: Record<string, unknown>
  malformed: Record<string, unknown>
}

// The properties a snapshot's keys are classified against are the REGISTERED
// view type's, read at preprocess time: `extendViewType` composes onto the
// model after `withLaunchInput` wrapped it, and a set frozen at wrap time sent
// every added property to `unknown` — restored at its default, with a warning
// naming it a typo. The wrapped model's own properties are the answer when no
// registry is given, or the snapshot names a type it does not hold, which is
// how a factory-built model in a test behaves.
function knownPropsResolver(model: IAnyModelType, registry?: ViewTypeLookup) {
  let cachedProps: object | undefined
  let cachedKeys: ReadonlySet<string> = new Set()
  return (snap: Record<string, unknown>): ReadonlySet<string> => {
    const name = snap.type
    const registered =
      registry && typeof name === 'string' && registry.viewTypes.has(name)
        ? registry.getViewType(name)
        : undefined
    const props: object = registered?.isStateModelLoaded
      ? registered.stateModel.properties
      : model.properties
    if (props !== cachedProps) {
      cachedProps = props
      cachedKeys = new Set(Object.keys(props))
    }
    return cachedKeys
  }
}

function classify(
  snap: Record<string, unknown>,
  { keys, passThrough }: LaunchKeyRegistration<unknown, string>,
  known: ReadonlySet<string>,
  out: Partitioned,
) {
  for (const [key, value] of Object.entries(snap)) {
    const spec = keys[key]
    if (IDENTITY.has(key)) {
      out.state[key] = value
    } else if (spec?.kind === 'launch') {
      out.launch[key] = value
    } else if (spec?.kind === 'replay') {
      out.state[key] = value
      out.launch[key] = value
    } else if (spec) {
      const { launch, state } = splitEntries(spec.kind, value)
      if (spec.kind === 'rows' && launch !== undefined && state !== undefined) {
        // A row list indexes against `levels` and `tracks[i]`, so lifting half
        // of it renumbers the other half. Nothing here can throw — a pure
        // preprocessor runs against snapshots the union is about to reject — so
        // the whole list goes to the bucket afterAttach reports and the view
        // comes up on its import form rather than on a silently misaligned
        // stack.
        out.malformed[key] = value
      } else {
        if (launch !== undefined) {
          out.launch[key] = launch
        }
        if (state !== undefined) {
          out.state[key] = state
        }
      }
    } else if (known.has(key) || passThrough.includes(key)) {
      out.state[key] = value
    } else {
      out.unknown[key] = value
    }
  }
}

// BreakpointSplitView's v4 `init` was a bare array of panels rather than an
// object of settings. A positional list can only be the view's row list, and a
// view declares at most one, so it is read as that key rather than classified
// per index — which would name "0" and "1" as unknown keys.
function legacyInitSnapshot(
  init: Record<string, unknown>,
  { keys }: LaunchKeyRegistration<unknown, string>,
) {
  const rows = Object.entries(keys).find(
    ([, spec]) => spec.kind === 'rows',
  )?.[0]
  return Array.isArray(init) && rows ? { [rows]: init } : init
}

/**
 * Accept a view's settings written directly on the view object, and move the
 * ones a launcher has to resolve into the internal `launch` property.
 *
 * The partition is a `preProcessSnapshot` and is PURE. A session's view type is
 * a `types.union`, so MST runs every member's preprocessor against every
 * candidate snapshot while deciding which one matches, and runs it about twice
 * more per instantiation; a warning from in here fires against snapshots that
 * are about to be rejected. `afterAttach` — reached only by a snapshot that won
 * — reports what the partition captured.
 *
 * `registry` is the PluginManager. With it the partition classifies against
 * the view type as registered, `extendViewType`'s added properties included;
 * without it, against the model as wrapped here.
 *
 * ORDER: MST runs preprocessors in the reverse of the order they were added, so
 * this belongs on the chain BEFORE a view's own legacy-key preprocessor, where
 * it partitions the snapshot MST finally consumes rather than a key that remap
 * is about to convert.
 *
 * The widening cast is the LAST link that may change the creation type: it
 * replaces `CustomC`, so a `.props()` added after it is invisible to
 * `SnapshotIn`. Further `preProcessSnapshot`/`postProcessSnapshot` links are
 * fine — both carry `CustomC` through.
 *
 * Not `types.snapshotProcessor`, which carries the same widened input and stops
 * being a `ModelType`. `PluginManager.pluggableMstType` filters union members on
 * `isModelType`, so a wrapped view is dropped from the session's view union
 * without a word, and `ViewType.stateModel` and every `.properties`
 * introspection site break with it.
 */
export function withLaunchInput<
  M extends IAnyModelType,
  Commands,
  PassThrough extends string,
>(
  model: M,
  registration: LaunchKeyRegistration<Commands, PassThrough>,
  registry?: ViewTypeLookup,
): LaunchInputModel<M, Commands, PassThrough> {
  const knownProps = knownPropsResolver(model, registry)
  const partitioned = model
    .preProcessSnapshot((snap: unknown) => {
      if (!isObject(snap)) {
        return snap
      }
      const known = knownProps(snap)
      const { init, ...rest } = snap
      const out: Partitioned = {
        state: {},
        launch: {},
        unknown: {},
        malformed: {},
      }
      if (isObject(init)) {
        // v4's nesting, unwrapped rather than refused: a nested key sorts the
        // same three ways a flat one does, so honoring it costs one more pass
        // and a deprecation warning, where dropping it opens an admin's
        // `defaultSession` on its defaults. First, so a snapshot spelling one
        // key both ways resolves to the flat one the docs teach.
        classify(
          legacyInitSnapshot(init, registration),
          registration,
          known,
          out,
        )
        out.launch.legacyInit = true
      }
      classify(rest, registration, known, out)
      if (Object.keys(out.unknown).length) {
        out.launch.unknown = out.unknown
      }
      if (Object.keys(out.malformed).length) {
        out.launch.malformed = out.malformed
      }
      const persisted = out.state[LAUNCH]
      return Object.keys(out.launch).length
        ? {
            ...out.state,
            [LAUNCH]: {
              ...(isObject(persisted) ? persisted : {}),
              ...out.launch,
            },
          }
        : out.state
    })
    .actions(self => ({
      afterAttach() {
        const { launch } = self as IStateTreeNode & {
          launch?: LaunchInput<Commands>
        }
        if (launch?.legacyInit) {
          reportLegacyInit(self)
        }
        reportUnknownKeys(self, Object.keys(launch?.unknown ?? {}))
        reportMalformedRows(self, Object.keys(launch?.malformed ?? {}))
      },
    }))
    // `legacyInit` names the SPELLING of the snapshot this view was opened from,
    // and a saved one does not use it — so persisting the flag makes every later
    // restore report nesting the snapshot it is reading does not contain,
    // forever, since nothing clears it (`pendingLaunch` excludes the report
    // keys, so the launch autorun never runs). `unknown` and `malformed` stay:
    // those name content that was DISCARDED, which is still true of the saved
    // snapshot, and the blob is the only record of it.
    .postProcessSnapshot((snap: Record<string, unknown>) => {
      const launch = snap[LAUNCH]
      if (!isObject(launch) || !launch.legacyInit) {
        return snap
      }
      const { legacyInit, ...kept } = launch
      return Object.keys(kept).length
        ? { ...snap, [LAUNCH]: kept }
        : Object.fromEntries(
            Object.entries(snap).filter(([key]) => key !== LAUNCH),
          )
    })
  return partitioned as unknown as LaunchInputModel<M, Commands, PassThrough>
}
