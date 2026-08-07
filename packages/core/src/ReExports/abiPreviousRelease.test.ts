import previous from './abiPreviousRelease.json'
import libs from './modules.ts'

// abi.test.ts pins the ABI going forward: its baseline was snapshotted from this
// branch, so it catches the *next* removal. It cannot catch the ones that
// already happened, because the names were gone before the baseline recorded
// them -- and those are the ones sitting in published UMDs right now.
//
// This checks the other direction. abiPreviousRelease.json is the export list of
// the @jbrowse/core we last published, so every name in it is one some plugin
// out there may have been built against. A name no longer in `libs` becomes
// `undefined` inside a bundle nobody is going to rebuild, which is how dropping
// `defaultCodonTable` error-paged published protein3d and msaview.
//
// Regenerate at release time, after the version bump lands:
//   node --experimental-strip-types scripts/gen-abi-previous-release.ts <version>
//
// KNOWN_REMOVALS is the escape hatch, keyed `module#name`. Every entry is a
// deliberate break, so give the reason and say which published plugins you
// checked. Emptying it is not the goal -- reviewing what goes into it is.
//
// The v5 entries below were checked against all 17 bundles in the v2 plugin
// store (jbrowse.org/plugin-store/v2/plugins.json) by extracting each one's
// `JBrowseExports[...]` reads. Four link against something in this list:
// jbrowse-plugin-gwas (FeatureRendererType, now vendored in-tree as
// plugins/gwas), jbrowse-plugin-gdc and jbrowse-plugin-apollo
// (getParentRenderProps, plus isContainedWithin and BaseTooltip for apollo), and
// jbrowse-plugin-tview (BaseTooltip). jbrowse-plugin-multilevel-linear-view2
// vendors its own copy of the util barrel, so it reads only getParentRenderProps
// off the host. Store entries all declare `jbrowseRange: "*"`, so pinning them
// is the other half of this.
const KNOWN_REMOVALS: Record<string, string> = {
  // The renderer registry is gone with the server-side rendering pipeline;
  // displays now compose RenderLifecycleMixin + DisplayChrome. No shim exists,
  // and a plugin with a custom RendererType has to be rewritten.
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

  // Layout moved onto the GPU packing path.
  '@jbrowse/core/util/layouts#PileupLayout': 'replaced by GPU instance packing',
  '@jbrowse/core/util/layouts#SceneGraph': 'replaced by GPU instance packing',
  '@jbrowse/core/util#calculateLayoutBounds':
    'replaced by GPU instance packing',
  '@jbrowse/core/util#getLayoutId': 'replaced by GPU instance packing',

  // AbortSignal-based cancellation became stop tokens; `checkStopToken` in
  // util/stopToken.ts is the surviving form of the pair.
  '@jbrowse/core/util#abortBreakPoint':
    'AbortSignal cancellation -> stop tokens',
  '@jbrowse/core/util#checkAbortSignal':
    'AbortSignal cancellation -> stop tokens',
  '@jbrowse/core/util#observeAbortSignal':
    'AbortSignal cancellation -> stop tokens',
  '@jbrowse/core/util#makeAbortableReaction':
    'AbortSignal cancellation -> stop tokens',
  '@jbrowse/core/util#checkStopToken2': 'renamed to checkStopToken',
  '@jbrowse/core/util#forEachWithStopTokenCheck':
    'folded into the callers that walked features',
  '@jbrowse/core/util#RetryError': 'RPC retry handling reworked',
  '@jbrowse/core/util#isRetryException': 'RPC retry handling reworked',

  // The renderer-era status/progress reporting.
  '@jbrowse/core/util#updateStatus2': 'status reporting reworked',
  '@jbrowse/core/util#getProgressDisplayStr': 'status reporting reworked',
  '@jbrowse/core/util#getStatsId': 'feature-density stats reworked',

  // Desktop file handles moved behind the contextIsolation preload bridge.
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

  // Names with a surviving equivalent under a different name.
  '@jbrowse/core/util#assembleLocStringFast':
    'assembleLocString is the only form now',
  '@jbrowse/core/util/color#contrastingTextColor': 'renamed to makeContrasting',
  '@jbrowse/core/util#findLast': 'Array.prototype.findLast',
  '@jbrowse/core/util#findLastIndex': 'Array.prototype.findLastIndex',

  // BaseTooltip is still shipped, just not through this barrel: re-exporting it
  // pulled @floating-ui (~266KB) onto the startup path. In-tree code deep-imports
  // '@jbrowse/core/ui/BaseTooltip', but that path is not in ReExports/list.ts, so
  // an external plugin bundles its own copy rather than externalizing it.
  '@jbrowse/core/ui#BaseTooltip':
    'dropped from the barrel for startup weight; deep-import path is not in the ABI',

  // Dropped with no replacement; the remaining callers inlined them.
  '@jbrowse/core/util#TextSearchManager':
    'still in TextSearch/TextSearchManager.ts, no longer re-exported from util',
  '@jbrowse/core/util#isContainedWithin': 'unused after the rewrite',
  '@jbrowse/core/util#iterMap': 'unused after the rewrite',
  '@jbrowse/core/util#when': 'unused after the rewrite',
  '@jbrowse/core/util#blobToDataURL': 'unused after the rewrite',
  '@jbrowse/core/util#cartesianToPolar': 'unused after the rewrite',
  '@jbrowse/core/util#degToRad': 'unused after the rewrite',
  '@jbrowse/core/util#getUriLink': 'unused after the rewrite',
  '@jbrowse/core/util#defaultStops': 'unused after the rewrite',
  '@jbrowse/core/util#useDebouncedCallback': 'unused after the rewrite',
  '@jbrowse/core/configuration#isConfigurationSlotType':
    'config models were flattened; slots are no longer their own MST instances',
}

describe('ABI against the previously published release', () => {
  it(`serves every module @jbrowse/core@${previous.version} served`, () => {
    const missing = Object.keys(previous.modules).filter(m => !(m in libs))
    expect(missing).toEqual([])
  })

  it.each(Object.entries(previous.modules))(
    '%s keeps the names it published, or declares the removal',
    (name, names) => {
      const mod = libs[name as keyof typeof libs] as Record<string, unknown>
      const undeclared = names.filter(
        n => !(n in mod) && !(`${name}#${n}` in KNOWN_REMOVALS),
      )
      expect(undeclared).toEqual([])
    },
  )

  it('has no stale KNOWN_REMOVALS entries', () => {
    const modules = previous.modules as Record<string, string[]>
    const stale = Object.keys(KNOWN_REMOVALS).filter(key => {
      const [name, exportName] = key.split('#')
      const mod = libs[name as keyof typeof libs] as
        | Record<string, unknown>
        | undefined
      // stale two ways: the name came back, or the previous release never had it
      return (
        (mod && exportName! in mod) || !modules[name!]?.includes(exportName!)
      )
    })
    expect(stale).toEqual([])
  })
})
