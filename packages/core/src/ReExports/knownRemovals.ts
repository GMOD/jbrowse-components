// The names that left the `@jbrowse/core/*` re-export ABI -- the modules an
// external plugin resolves through `jbrequire` -- keyed `module#name`.
//
// `abiPreviousRelease.test.ts` is the gate: every name the previously published
// release served has to still be served, or be declared here with its reason.
// A removed name is `undefined` inside a bundle nobody is going to rebuild,
// which is how dropping `defaultCodonTable` error-paged published protein3d and
// msaview. Emptying this list is not the goal -- reviewing what goes into it is.
//
// **Grouped, and the groups are the published list.** The v5.0.0 announcement
// carried a hand-written bullet list of these groups covering 29 of the 46
// names, with seventeen sitting under groups the prose had dropped --
// `isContainedWithin` among them, while being named two paragraphs later as a
// break Apollo hits. `website/scripts/generate-abi-removals.ts` renders this
// array into the announcement and into PLUGIN_ABI_STABILITY.md, so a name added
// here reaches both and a group cannot go missing from either.
//
// So `summary` is prose a reader outside this repo has to be able to follow: it
// is published verbatim.
export interface RemovalGroup {
  /** How the announcement and the reference doc name this group. */
  summary: string
  /** `module#name` to the reason, which is this file's own audience. */
  names: Record<string, string>
}

export const REMOVAL_GROUPS: RemovalGroup[] = [
  {
    summary: 'the renderer registry',
    names: {
      // Gone with the server-side rendering pipeline; displays now compose
      // RenderLifecycleMixin + DisplayChrome. No shim exists, and a plugin with
      // a custom RendererType has to be rewritten.
      '@jbrowse/core/pluggableElementTypes#RendererType':
        'renderer registry removed',
      '@jbrowse/core/pluggableElementTypes#FeatureRendererType':
        'renderer registry removed',
      '@jbrowse/core/pluggableElementTypes#BoxRendererType':
        'renderer registry removed',
      '@jbrowse/core/pluggableElementTypes#CircularChordRendererType':
        'renderer registry removed',
      '@jbrowse/core/pluggableElementTypes#ServerSideRendererType':
        'renderer registry removed, core no longer renders on the server',
      '@jbrowse/core/pluggableElementTypes#GlyphType':
        'glyphs are drawn by the GPU displays, not registered',
      '@jbrowse/core/util#getParentRenderProps':
        'fed the renderer registry; nothing in the GPU pipeline consumes render props',
      '@jbrowse/core/util/tracks#getParentRenderProps':
        'fed the renderer registry; nothing in the GPU pipeline consumes render props',
    },
  },
  {
    summary: 'layout, which moved onto the GPU packing path',
    names: {
      '@jbrowse/core/util/layouts#PileupLayout':
        'replaced by GPU instance packing',
      '@jbrowse/core/util/layouts#SceneGraph':
        'replaced by GPU instance packing',
      '@jbrowse/core/util#calculateLayoutBounds':
        'replaced by GPU instance packing',
      '@jbrowse/core/util#getLayoutId': 'replaced by GPU instance packing',
    },
  },
  {
    summary: '`AbortSignal` cancellation, which became stop tokens',
    names: {
      // `checkStopToken` in util/stopToken.ts is the surviving form of the pair.
      '@jbrowse/core/util#abortBreakPoint':
        'AbortSignal cancellation -> stop tokens',
      '@jbrowse/core/util#checkAbortSignal':
        'AbortSignal cancellation -> stop tokens',
      '@jbrowse/core/util#observeAbortSignal':
        'AbortSignal cancellation -> stop tokens',
      '@jbrowse/core/util#makeAbortableReaction':
        'AbortSignal cancellation -> stop tokens',
    },
  },
  {
    summary: "the renderer era's RPC retry and progress reporting",
    names: {
      '@jbrowse/core/util#RetryError': 'RPC retry handling reworked',
      '@jbrowse/core/util#isRetryException': 'RPC retry handling reworked',
      '@jbrowse/core/util#updateStatus2': 'status reporting reworked',
      '@jbrowse/core/util#getProgressDisplayStr': 'status reporting reworked',
      '@jbrowse/core/util#getStatsId': 'feature-density stats reworked',
    },
  },
  {
    summary: 'desktop file handles, which the desktop package now owns',
    names: {
      // Moved behind the contextIsolation preload bridge. `util/tracks` served
      // six of these eight -- not `removeFileHandle` or `cleanupStaleHandles`.
      '@jbrowse/core/util#getFileHandleCache':
        'desktop file handles moved to preload',
      '@jbrowse/core/util#setFileHandleCache':
        'desktop file handles moved to preload',
      '@jbrowse/core/util#removeFileHandle':
        'desktop file handles moved to preload',
      '@jbrowse/core/util#cleanupStaleHandles':
        'desktop file handles moved to preload',
      '@jbrowse/core/util#getPendingFileHandleIds':
        'desktop file handles moved to preload',
      '@jbrowse/core/util#setPendingFileHandleIds':
        'desktop file handles moved to preload',
      '@jbrowse/core/util#clearPendingFileHandleIds':
        'desktop file handles moved to preload',
      '@jbrowse/core/util#restorePendingFileHandles':
        'desktop file handles moved to preload',
      '@jbrowse/core/util/tracks#getFileHandleCache':
        'desktop file handles moved to preload',
      '@jbrowse/core/util/tracks#setFileHandleCache':
        'desktop file handles moved to preload',
      '@jbrowse/core/util/tracks#getPendingFileHandleIds':
        'desktop file handles moved to preload',
      '@jbrowse/core/util/tracks#setPendingFileHandleIds':
        'desktop file handles moved to preload',
      '@jbrowse/core/util/tracks#clearPendingFileHandleIds':
        'desktop file handles moved to preload',
      '@jbrowse/core/util/tracks#restorePendingFileHandles':
        'desktop file handles moved to preload',
    },
  },
  {
    summary:
      'renames with a survivor \u2014 `contrastingTextColor` is `makeContrasting`, `checkStopToken2` is `checkStopToken`, `assembleLocStringFast` is `assembleLocString`, `findLast`/`findLastIndex` are the `Array.prototype` methods',
    names: {
      '@jbrowse/core/util/color#contrastingTextColor':
        'renamed to makeContrasting',
      '@jbrowse/core/util#checkStopToken2': 'renamed to checkStopToken',
      '@jbrowse/core/util#assembleLocStringFast':
        'assembleLocString is the only form now',
      '@jbrowse/core/util#findLast': 'Array.prototype.findLast',
      '@jbrowse/core/util#findLastIndex': 'Array.prototype.findLastIndex',
    },
  },
  {
    summary:
      '`BaseTooltip`, which moved to its own `@jbrowse/core/ui/BaseTooltip` module to keep @floating-ui off the startup path',
    names: {
      // Re-exporting it from the barrel pulled @floating-ui (~266KB) onto the
      // startup path, so it is served as its own module behind React.lazy. A
      // plugin built against the barrel still has to change the import, which is
      // why apollo and react-msaview both had to.
      '@jbrowse/core/ui#BaseTooltip':
        'moved to its own @jbrowse/core/ui/BaseTooltip module to keep @floating-ui off the startup path',
    },
  },
  {
    summary:
      'names with no caller left in core, which the last callers inlined or folded away',
    names: {
      '@jbrowse/core/util#forEachWithStopTokenCheck':
        'folded into the callers that walked features',
      '@jbrowse/core/util#TextSearchManager':
        'still in TextSearch/TextSearchManager.ts, no longer re-exported from util',
      // Not "unused": Apollo takes it off JBrowseExports, which
      // check-published-plugins reports and the announcement names. Unused by
      // CORE is the fact this entry records, and the reason it read as safe.
      '@jbrowse/core/util#isContainedWithin':
        'no caller left in core; published Apollo still takes it',
      '@jbrowse/core/util#iterMap': 'unused after the rewrite',
      '@jbrowse/core/util#when': 'unused after the rewrite',
      '@jbrowse/core/util#blobToDataURL': 'unused after the rewrite',
      '@jbrowse/core/util#cartesianToPolar': 'unused after the rewrite',
      '@jbrowse/core/util#degToRad': 'unused after the rewrite',
      '@jbrowse/core/util#getUriLink': 'unused after the rewrite',
      '@jbrowse/core/util#defaultStops': 'unused after the rewrite',
      '@jbrowse/core/util#useDebouncedCallback': 'unused after the rewrite',
    },
  },
  {
    summary:
      '`isConfigurationSlotType`, with the config models that were flattened',
    names: {
      '@jbrowse/core/configuration#isConfigurationSlotType':
        'config models were flattened; slots are no longer their own MST instances',
    },
  },
]

export const KNOWN_REMOVALS: Record<string, string> = Object.fromEntries(
  REMOVAL_GROUPS.flatMap(g => Object.entries(g.names)),
)

// The other two surfaces PLUGIN_ABI_STABILITY.md names, and it says the session
// is the quietest of the three. Neither has a gate: `abiPreviousRelease.test.ts`
// compares module names against the last published `@jbrowse/core`, and
// `check-published-plugins.ts` filters its findings on `@jbrowse/core/`, so a
// plugin's `exports` object is observed by nothing at all and the session only
// by the fifteen members `pluginFacingSessionApi.test.ts` performs.
//
// Recording them is therefore not the same job as recording a core removal, and
// it is worth doing on its own: `generate-abi-removals.ts` publishes this array
// into the upgrade guide beside the core groups, so a plugin author who lands on
// one of these finds the sentence that explains it. Six of them left in v5 with
// nothing saying so anywhere.
//
// These names are NOT `module#name` keys and must not go into `REMOVAL_GROUPS`:
// its every key has to be a module the previous release served, or
// `abiPreviousRelease.test.ts` reports it as a stale entry. The reverse mistake
// is the dangerous one and `knownRemovals.test.ts` fails it -- a `@jbrowse/core`
// name filed here reads as recorded while skipping the only gate that would have
// caught it.
export interface SurfaceRemovalGroup {
  /** Where a plugin reaches these. Published verbatim. */
  surface: string
  /** Absent now, to what a v4 plugin gets instead. Published verbatim. */
  gone: Record<string, string>
  /**
   * Still there, with a signature a v4 caller does not satisfy. Kept apart from
   * `gone` because the failure is the opposite shape: a deleted member throws at
   * the call, where a changed signature answers with a plausible wrong value and
   * logs nothing. "The signature is as public as the name" is the rule on the
   * reference page; this is where the ones that broke it are written down.
   */
  changed: Record<string, string>
}

export const SESSION_AND_PLUGIN_REMOVALS: SurfaceRemovalGroup[] = [
  {
    surface:
      "**the session**, which a plugin reaches by member lookup (`'x' in session`) rather than by import, so nothing fails at build time",
    gone: {
      removeReferring:
        'deleted, along with the reference-clearing pass it drove; `undefined is not a function` at the call',
      prepareToBreakConnection:
        'deleted with the "N tracks will close" pre-flight it computed; `breakConnection` now closes them without the confirmation step',
      hasWidget:
        'deleted; the same question is `session.widgets.has(id)`, which is what it wrapped',
    },
    changed: {
      getReferring:
        'It takes a `trackId` string now, not the config object it used to take. A v4 caller passing the object reaches `getReferringMultiple`, which tests its `Set` of objects against `node[key]?.trackId` — a string — so every comparison misses and the answer is `[]`. Nothing throws: the caller concludes no view refers to the track and closes it out from under whatever was showing it',
    },
  },
  {
    surface:
      "**`@jbrowse/product-core`'s `Session` barrel**, which is a named allowlist now rather than `export *` over nine modules — so a name the allowlist omits is gone from the package even where its own module still declares it",
    gone: {
      DialogQueueSessionMixin:
        '`Session/DialogQueue.ts` was folded into `BaseSessionModel`, which declares `queueDialog`, `removeActiveDialog`, `DialogComponent` and `DialogProps` itself. The members survive on every session; the composable mixin does not, so a product assembling its own session from mixins has to compose `BaseSessionModel` for them',
      isSessionWithDialogs:
        'same file. Every session that composes `BaseSessionModel` has the dialog members, so there is no longer a narrowing to do',
      SessionWithDialogs:
        'same file; the mixin it was an `Instance` of is gone',
      SessionWithDialogsType:
        'same file; it was the `ReturnType` of that mixin',
    },
    changed: {},
  },
  {
    surface:
      "**`LinearGenomeViewPlugin.exports`**, reached at runtime as `pluginManager.getPlugin('LinearGenomeViewPlugin').exports.X`",
    gone: {
      BaseLinearDisplay:
        'the legacy block-render state model, removed with the server-side render path. A v4 plugin composing `exports.BaseLinearDisplay()` throws while its `install` runs, so its track type never registers and the user opens a saved session with the track simply absent',
      BaseLinearDisplayComponent:
        'the React half of the same pair, and the last reader of the `DisplayMessageComponent` getter on `BaseDisplayModel`, which went with it. A display model no longer holds a React component at all',
    },
    changed: {},
  },
  {
    surface:
      "**`@jbrowse/plugin-linear-genome-view`'s type exports**, which a plugin built against the published package imports rather than looking up at runtime — so these break a build, not a session",
    gone: {
      LayoutRecord:
        'the 4-tuple `[minX, minY, maxX, maxY]` the block layout handed back, exported from the plugin entry and the `BaseLinearDisplay` barrel with no consumer left in the tree. Its 5-tuple `LayoutFeatureMetadata` variant went with the floating-label code, so what was published in v5 was already the narrowed shape. `@jbrowse/plugin-breakpoint-split-view` declares an identical one of its own and still exports it, which is the import to move to',
      Layout:
        'the named-rectangle interface beside it (`minX`/`minY`/`maxX`/`maxY`/`name`), declared in the same file and never exported past it or read anywhere',
    },
    changed: {},
  },
]
