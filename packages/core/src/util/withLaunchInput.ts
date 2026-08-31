import { reportUnknownKeys, viewLabel } from './unknownSnapshotKeys.ts'

import type {
  IAnyModelType,
  IModelType,
  IStateTreeNode,
  SnapshotIn,
} from '@jbrowse/mobx-state-tree'

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

export interface LaunchKeyRegistration<Commands> {
  keys: Record<string, LaunchKeySpec>
  passThrough: readonly string[]
  /** never assigned; it carries `Commands` to `withLaunchInput`'s return type */
  commands?: Commands
}

/**
 * The launch keys a view captured, plus the two things it has to report.
 *
 * `Commands` is not made partial: hand-authored JSON is what fills this, so a
 * key the interface marks required is not a guarantee here either way, and the
 * launcher already guards the ones it cannot proceed without.
 */
export type LaunchInput<Commands> = Commands & {
  unknown?: Record<string, unknown>
  legacyInit?: boolean
}

/**
 * A view's snapshot type, widened to the authored shape: every launch key is
 * accepted beside the declared properties, and a key that is both takes either
 * meaning. Excess-property checking then makes a misspelled key an error at
 * every literal site — a `defaultSession` view, an `addView` call, a
 * `createViewState` spec.
 */
export type LaunchSnapshotIn<M extends IAnyModelType, Commands> = Omit<
  SnapshotIn<M>,
  keyof Commands
> & {
  [K in keyof Commands]?: K extends keyof SnapshotIn<M>
    ? Commands[K] | SnapshotIn<M>[K]
    : Commands[K]
} & {
  /** v4's nested form, accepted while the other views still write it */
  init?: Commands
}

export type LaunchInputModel<M extends IAnyModelType, Commands> =
  M extends IModelType<infer P, infer O, any, infer S>
    ? IModelType<P, O, LaunchSnapshotIn<M, Commands>, S>
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
  return (
    keys: Record<keyof Commands, LaunchKeySpec>,
    { passThrough = [] }: { passThrough?: readonly string[] } = {},
  ): LaunchKeyRegistration<Commands> => ({
    keys,
    passThrough,
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
}

function classify(
  snap: Record<string, unknown>,
  { keys, passThrough }: LaunchKeyRegistration<unknown>,
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
      if (launch !== undefined) {
        out.launch[key] = launch
      }
      if (state !== undefined) {
        out.state[key] = state
      }
    } else if (known.has(key) || passThrough.includes(key)) {
      out.state[key] = value
    } else {
      out.unknown[key] = value
    }
  }
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
export function withLaunchInput<M extends IAnyModelType, Commands>(
  model: M,
  registration: LaunchKeyRegistration<Commands>,
): LaunchInputModel<M, Commands> {
  const known: ReadonlySet<string> = new Set(Object.keys(model.properties))
  return model
    .preProcessSnapshot((snap: unknown) => {
      if (!isObject(snap)) {
        return snap
      }
      const { init, ...rest } = snap
      const out: Partitioned = { state: {}, launch: {}, unknown: {} }
      classify(rest, registration, known, out)
      if (isObject(init)) {
        // v4 nested its launch keys here. Everything inside is a launch key or
        // a mistake — a declared property in there was never applied — so the
        // blob's own keys are all this pass has to sort.
        classify(init, { ...registration, passThrough: [] }, new Set(), out)
        out.launch.legacyInit = true
      }
      if (Object.keys(out.unknown).length) {
        out.launch.unknown = out.unknown
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
          console.warn(
            `${viewLabel(self)} nests its settings under "init", which is deprecated: write every setting directly on the view object.`,
          )
        }
        reportUnknownKeys(self, Object.keys(launch?.unknown ?? {}))
      },
    })) as unknown as LaunchInputModel<M, Commands>
}
