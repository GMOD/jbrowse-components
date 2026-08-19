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
