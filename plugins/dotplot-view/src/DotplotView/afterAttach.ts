import {
  getNotificationSink,
  getSession,
  localStorageSetItem,
  minmax,
  parseLocString,
  resolveNamedRegions,
} from '@jbrowse/core/util'
import {
  applyInitSettings,
  warnInitSettings,
} from '@jbrowse/core/util/applyInitSettings'
import { coerceHighlight } from '@jbrowse/core/util/highlights'
import { installInitAutorun } from '@jbrowse/core/util/installInitAutorun'
import { leadingEdgeAutorun } from '@jbrowse/core/util/leadingEdgeAutorun'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import {
  installClearHoverOnSurfaceMove,
  withDiagonalizeProgress,
} from '@jbrowse/synteny-core'
import { autorun, when } from 'mobx'

import { LS_CURSOR_MODE } from './types.ts'

import type { DotplotViewModel } from './model.ts'
import type { DotplotViewInit } from './types.ts'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import type { HighlightType } from '@jbrowse/core/util/highlights'
import type { InitApplyContext } from '@jbrowse/core/util/installInitAutorun'

type AssemblyManager = ReturnType<typeof getSession>['assemblyManager']

// Resolve init.highlight entries to HighlightType objects. Each entry is a loc
// string ("ctgA:100-200") or a JSON object carrying color/label — the same
// three forms LinearGenomeView's init.highlight accepts, so both go through
// core's shared coerceHighlight. Pure — no view dependency — so it is unit
// testable on its own.
//
// Resolved per entry: coerceHighlight throws on an unknown refName or a
// malformed locstring, and one typo must take out neither its siblings nor the
// init steps that run after highlights. Bad entries come back as `errors` for
// the caller to report rather than being swallowed.
//
// `defaultAssembly` is the horizontal axis, and is only a DEFAULT: unlike every
// other view that takes highlights, this one has a second assembly, and an entry
// naming it — `{mm10}chr1:1-100`, or a JSON object with its own assemblyName —
// is validated and stamped against the one it named. Validating everything
// against the h axis rejected any refName unique to the v axis outright, and
// accepted a shared name like `chr1` only to band the wrong axis with it.
export function parseInitHighlights(
  entries: string[],
  assemblyManager: AssemblyManager,
  defaultAssembly: string,
): {
  highlights: HighlightType[]
  errors: { entry: string; error: unknown }[]
} {
  const highlights: HighlightType[] = []
  const errors: { entry: string; error: unknown }[] = []
  for (const entry of entries) {
    try {
      const highlight = coerceHighlight(
        entry,
        defaultAssembly,
        (refName, assemblyName) =>
          assemblyManager.isValidRefName(
            refName,
            assemblyName ?? defaultAssembly,
          ),
      )
      if (highlight) {
        highlights.push(highlight)
      }
    } catch (error) {
      errors.push({ entry, error })
    }
  }
  return { highlights, errors }
}

// Navigate one dotplot axis (hview/vview) to a loc string for region-based
// linking. Resolves the canonical refName, finds the matching displayed region,
// and moveTo's the bp offsets (handling reversed regions). Exported for tests.
//
// Whichever end the locstring leaves unsaid is the region's own: a bare refName
// ("ctgA") and an open-ended range ("ctgA:5000..") are both legal parses that
// carry no start/end pair, and requiring one meant the commonest form an axis
// `loc` takes — name a chromosome, show that chromosome — navigated nowhere and
// said nothing, which is indistinguishable from the whole-genome default it was
// written to override.
//
// Returns whether it navigated. False means the refName is in the assembly (an
// unknown one throws out of `parseLocString`) but not on this axis, which is
// reachable exactly one way: the same init restricted the axis with
// `displayedRegionNames` and then asked for a `loc` outside the restriction. The
// caller reports it — the whole-genome plot that comes back otherwise looks like
// the `loc` was ignored for no reason.
export function navAxisToLoc(
  view: Base1DViewModel,
  loc: string,
  assemblyName: string,
  assemblyManager: AssemblyManager,
) {
  const asm = assemblyManager.get(assemblyName)
  const parsed = parseLocString(loc, refName =>
    assemblyManager.isValidRefName(refName, assemblyName),
  )
  const refName = asm?.getCanonicalRefName2(parsed.refName) ?? parsed.refName
  const index = view.displayedRegions.findIndex(r => r.refName === refName)
  if (index === -1) {
    return false
  }
  const region = view.displayedRegions[index]!
  const start = parsed.start ?? region.start
  const end = parsed.end ?? region.end
  const offsetOf = (coord: number) =>
    region.reversed ? region.end - coord : coord - region.start
  const [lo, hi] = minmax(offsetOf(start), offsetOf(end))
  view.moveTo({ refName, index, offset: lo }, { refName, index, offset: hi })
  return true
}

// Wait for `cond`, giving up on the two things that mean it will never come:
// the view reached a terminal error, or a newer init superseded this one. Every
// exit is caused by something that reports itself — an error lands in the import
// form's banner, a supersede is the next init taking over — so the caller
// re-checks its own precondition and skips quietly.
//
// `self.error` rather than its terms spelled out again: that getter is the view's
// one definition of terminal, and re-spelling it here as
// `volatileError || assemblyErrors` is what left the newest term (a malformed
// pair of axes) out of the wait.
//
// This replaced a 30s ceiling. A fixed timeout can only guess: too short and it
// expires on a slow-but-healthy remote assembly, silently dropping the
// navigation the init asked for; long enough not to, and in the one case it
// uniquely covers (a fetch that hangs without ever erroring) it changes nothing
// the spinner doesn't already say. What it was really buying was liveness for
// the drain — which `superseded` now provides exactly rather than eventually.
async function waitForInit(
  self: DotplotViewModel,
  cond: () => boolean,
  superseded: () => boolean,
) {
  await when(() => superseded() || cond() || !!self.error)
}

function applyInitTracks(self: DotplotViewModel, init: DotplotViewInit) {
  // showTrack surfaces its own failures via showTrackGeneric's notifyError
  if (init.tracks) {
    for (const trackId of init.tracks) {
      self.showTrack(trackId)
    }
  }
}

// The init keys this view writes code for; everything else is matched against
// the view's own declared properties and applied verbatim. See
// `applyInitSettings` in core — and note what the hand-written switchboard this
// replaced actually covered: showColorLegend, colorBy and minAlignmentLength,
// out of a model that also declares alpha, drawCigar, lineWidth,
// lockAspectRatio, lodMode and height. Those six were never authorable at all.
const DOTPLOT_INIT_COMMANDS = [
  // the spec's `views` is a per-axis {assembly, loc, displayedRegionNames}
  // pair; the model has no such property, and `tracks` means trackIds here
  // rather than the built track models
  'views',
  'tracks',
  'highlight',
  'autoDiagonalize',
] as const

function applyInitDisplaySettings(
  self: DotplotViewModel,
  init: DotplotViewInit,
) {
  warnInitSettings(
    'DotplotView init',
    applyInitSettings(self, init, { commands: DOTPLOT_INIT_COMMANDS }),
  )
}

function applyInitHighlights(self: DotplotViewModel, init: DotplotViewInit) {
  if (init.highlight) {
    const session = getSession(self)
    const { highlights, errors } = parseInitHighlights(
      init.highlight,
      session.assemblyManager,
      self.assemblyNames[0]!,
    )
    for (const h of highlights) {
      self.addToHighlights(h)
    }
    for (const { entry, error } of errors) {
      console.error(error)
      session.notifyError(
        `Invalid init highlight ${JSON.stringify(entry)}: ${error}`,
        error,
      )
    }
  }
}

async function runAutoDiagonalize(
  self: DotplotViewModel,
  superseded: () => boolean,
) {
  // runDotplotDiagonalize reads the axes' displayedRegions and fetches the
  // alignments it needs in its own RPC, so the only precondition is that the
  // view's regions are populated (assemblies loaded) — not the display's render
  // fetch. Wait on `initialized` directly so a slow remote load can't expire a
  // fixed ceiling and skip the reorder, leaving an undiagonalized plot; bail if
  // the assemblies error out. withDiagonalizeProgress drives the reordering
  // spinner + cancel and swallows the abort.
  await withDiagonalizeProgress(self, async opts => {
    const { runDotplotDiagonalize } =
      await import('./util/runDotplotDiagonalize.ts')
    await waitForInit(self, () => self.initialized, superseded)
    // superseded first: it subsumes the isAlive check, and reading `initialized`
    // on a detached node throws
    if (!superseded() && self.initialized) {
      await runDotplotDiagonalize(self, opts)
      // only now is the plot truly diagonalized — release the `settled` gate.
      // if runDotplotDiagonalize threw, withDiagonalizeProgress catches it and
      // this line is skipped, so `settled` stays false and the capture times
      // out loudly instead of committing an undiagonalized plot.
      if (isAlive(self)) {
        self.finishAutoDiagonalize()
      }
    }
  })
}

// Restrict each axis to its requested subset of the assembly's regions. Assumes
// the view is already initialized (caller waits), so this REPLACES the regions
// initializeDisplayedRegions already populated rather than racing it. Runs
// before autoDiagonalize so the reorder only ever sees the restricted set.
function applyInitDisplayedRegions(
  self: DotplotViewModel,
  init: DotplotViewInit,
) {
  const session = getSession(self)
  const axes = [self.hview, self.vview]
  let changed = false
  for (const [i, v] of init.views.entries()) {
    const axis = axes[i]
    const names = v.displayedRegionNames
    const assemblyName = self.assemblyNames[i]!
    const all = session.assemblyManager.get(assemblyName)
    if (axis && names?.length && all?.regions) {
      // a list that matches nothing leaves the axis alone rather than blanking
      // it — an empty axis renders as a broken plot with no clue why — and
      // resolveNamedRegions says so, which this did not. That was tolerable
      // while the field was reachable only from a hand-authored spec; the
      // import form's chromosome box makes a typo the ordinary case, and the
      // whole plot coming back unrestricted is not a legible answer to one.
      const regions = resolveNamedRegions({
        regions: all.regions,
        names,
        assemblyName,
        getCanonicalRefName: all.getCanonicalRefName2,
        allRefNames: all.allRefNames,
        notify: message => {
          session.notify(message, 'warning')
        },
      })
      if (regions) {
        axis.setDisplayedRegions(regions)
        changed = true
      }
    }
  }
  if (changed) {
    self.showAllRegions()
  }
}

// What an axis shows, for a one-line report. Capped: the case this is written for
// is a handful of restricted regions, but an unrestricted axis on a fragmented
// assembly carries thousands of names and a snackbar has room for one line.
const NAMES_IN_SUMMARY = 6

function namedRegionSummary(regions: { refName: string }[]) {
  const names = [...new Set(regions.map(r => r.refName))]
  const shown = names.slice(0, NAMES_IN_SUMMARY).join(', ')
  return names.length > NAMES_IN_SUMMARY
    ? `${shown} and ${names.length - NAMES_IN_SUMMARY} more`
    : shown
}

// region-based linking: navigate each axis to its requested loc. Assumes the
// view is already initialized (caller waits) so displayed regions exist.
function navigateInitLocs(self: DotplotViewModel, init: DotplotViewInit) {
  const session = getSession(self)
  const axes = [self.hview, self.vview]
  for (const [i, v] of init.views.entries()) {
    const axis = axes[i]
    if (v.loc && axis) {
      // per axis: navAxisToLoc parses the locstring, which throws on an unknown
      // refName. One bad axis is a half-placed plot, not a broken view — it must
      // not cost the other axis its navigation
      try {
        if (
          !navAxisToLoc(
            axis,
            v.loc,
            self.assemblyNames[i]!,
            session.assemblyManager,
          )
        ) {
          // a warning rather than an error: the plot is up and usable, just not
          // where it was asked to be. The only way here is a `loc` outside the
          // same init's `displayedRegionNames` restriction, so name what the
          // axis does show — capped, since an unrestricted axis on a fragmented
          // assembly has thousands of names and a snackbar is one line.
          session.notify(
            `init loc "${v.loc}" is not on the ${i === 0 ? 'horizontal' : 'vertical'} axis, which shows ${namedRegionSummary(axis.displayedRegions)} — the axis was left where it was`,
            'warning',
          )
        }
      } catch (e) {
        console.error(e)
        session.notifyError(`Invalid init loc "${v.loc}": ${e}`, e)
      }
    }
  }
}

// The ordered init steps. Recoverable failures (unresolvable track, bad
// highlight, bad loc) are caught at their own step, so anything escaping here
// is unexpected — installInitAutorun's backstop reports it.
async function applyInit(
  self: DotplotViewModel,
  init: DotplotViewInit,
  { superseded }: InitApplyContext,
) {
  // A dotplot plots one assembly against another, so the only question an init
  // has to answer is whether it names both. Counting views answers a different
  // question, and answers it wrong: `views: [{}, {}]` is two views naming
  // nothing, which cleared a `views.length < 2` check and then pushed
  // [undefined, undefined] into `types.array(types.string)` behind two `!`
  // assertions — so both import-form figures published an MST type error across
  // the form they exist to show, until a full screenshot sweep caught it.
  //
  // Naming NEITHER is not an error: `{type: 'DotplotView'}` and those two empty
  // axes both mean "open a dotplot and let me choose", which is the only route
  // from a session spec to the import form. Naming ONE is malformed, and
  // LaunchDotplotView takes untrusted spec data, so say so rather than
  // half-launch. Both consume the init the way a successful apply does: neither
  // could succeed on a retry.
  const [target, query] = init.views.map(v => v.assembly)
  if (!target && !query) {
    // the import form, deliberately
  } else if (!target || !query) {
    getNotificationSink(self).notifyError(
      'DotplotView init needs an assembly on each of its two views',
    )
  } else {
    // declare the reorder gate up front, before any track render can paint: it
    // outlives this pass (only the reorder itself lowers it) where the
    // `initPending` term covers only the apply window below
    self.beginAutoDiagonalize(!!init.autoDiagonalize)
    self.setAssemblyNames(target, query)
    applyInitTracks(self, init)
    applyInitDisplaySettings(self, init)
    // must land before autoDiagonalize: the reorder is computed over whatever
    // the axes currently display, so restricting afterwards would diagonalize
    // the full assembly and then throw most of it away
    if (init.views.some(v => v.displayedRegionNames?.length)) {
      await waitForInit(self, () => self.initialized, superseded)
      // re-check rather than assume: the wait also returns on an assembly
      // failure, and restricting regions on an uninitialized view would write
      // over the empty axes initializeDisplayedRegions has yet to populate
      if (isAlive(self) && self.initialized) {
        applyInitDisplayedRegions(self, init)
      }
    }
    if (init.autoDiagonalize) {
      await runAutoDiagonalize(self, superseded)
    }
    // highlights call isValidRefName, which throws until the assembly loads, so
    // they need assembliesInitialized. loc-nav additionally needs displayed
    // regions (initialized). Wait for the stronger of the two that are actually
    // requested, then apply each once its own precondition holds.
    const hasHighlight = !!init.highlight?.length
    const hasLoc = init.views.some(v => v.loc)
    if (hasHighlight || hasLoc) {
      await waitForInit(
        self,
        () => (hasLoc ? self.initialized : self.assembliesInitialized),
        superseded,
      )
      if (isAlive(self)) {
        if (hasHighlight && self.assembliesInitialized) {
          applyInitHighlights(self, init)
        }
        if (hasLoc && self.initialized) {
          navigateInitLocs(self, init)
        }
      }
    }
  }
}

function setupInitAutorun(self: DotplotViewModel) {
  installInitAutorun(self, {
    name: 'DotplotInit',
    ready: () => !!self.volatileWidth,
    // setAssemblyNames is the first materializing step: before it lands there
    // are no axes, and postProcessSnapshot keys off the same thing to decide
    // whether `init` is still worth persisting
    materialized: () => self.assemblyNames.length > 0,
    apply: (init, ctx) => applyInit(self, init, ctx),
  })
}

function setupLocalStorageAutorun(self: DotplotViewModel) {
  addDisposer(
    self,
    autorun(
      function dotplotLocalStorageAutorun() {
        localStorageSetItem(LS_CURSOR_MODE, self.cursorMode)
      },
      { name: 'DotplotLocalStorage' },
    ),
  )
}

function setupRegionsAutorun(self: DotplotViewModel) {
  // Leading edge, so the axes populate as soon as the assemblies and the
  // measured width are both in — a plain `{ delay }` would defer even this
  // first run, stalling the whole view (and the display's fetch, which waits on
  // `initialized`) behind a timer with nothing to coalesce. The measured width
  // is trustworthy on the first run: useWidthSetter only ever reports a
  // laid-out, non-zero content-box width. Later runs (setAssemblyNames clears
  // the regions to force a re-init) still debounce.
  leadingEdgeAutorun(
    self,
    function dotplotRegionsAutorun() {
      // assemblyNames.length > 0 both tracks the array (so MobX re-runs when
      // names change) and guards against vacuous truth from every() on an
      // empty array after clearView().
      if (
        self.volatileWidth !== undefined &&
        self.assemblyNames.length > 0 &&
        self.assembliesInitialized
      ) {
        self.initializeDisplayedRegions()
        return true
      }
      return false
    },
    { name: 'DotplotRegions', delay: 1000 },
  )
}

function setupAspectLockAutorun(self: DotplotViewModel) {
  addDisposer(
    self,
    autorun(
      function dotplotAspectLockAutorun() {
        // The equality guard is load-bearing, not an optimization: squareView
        // re-centers each axis, and centerAt rounds offsetPx, so calling it
        // unconditionally would write offsetPx on every run and retrigger this
        // autorun. Wheel zoom already keeps the axes equal; only box-zoom and
        // other per-axis operations split them.
        if (self.lockAspectRatio && self.hview.bpPerPx !== self.vview.bpPerPx) {
          self.squareView()
        }
      },
      { name: 'DotplotAspectLock' },
    ),
  )
}

// Drop the plot's hover whenever the alignment it names moves out from under a
// stationary cursor — the shared `installClearHoverOnSurfaceMove` contract,
// with `plotTransform` as the watched value: the numbers that decide where a
// cumBp lands on screen, covering every way the plot can move at once — the
// wheel, a drag pan, the zoom buttons, `squareView` and the aspect lock, an
// axis locstring navigation, `showAllRegions`, and — through `viewHeight`,
// which is in there for this reason — a resize of the plot itself. Listing
// entry points instead is how this was wrong to begin with — the wheel was the
// one nobody had written a clear for. Minus the two axes a plot doesn't have
// against the LGV's installer: no per-display scroll, no too-large banner.
//
// Data invalidation is a separate question with a separate answer: the stored
// index addresses `instanceData`, so both of ITS writers clear it (see
// `DotplotDisplay.setRpcData` / `setInstanceData`). A zoom trips both, which is
// fine — the second clear writes -1 over -1.
function setupClearHoverOnPlotMove(self: DotplotViewModel) {
  installClearHoverOnSurfaceMove(self, {
    transform: () => self.plotTransform,
    name: 'DotplotClearHoverOnPlotMove',
  })
}

export function doAfterAttach(self: DotplotViewModel) {
  setupInitAutorun(self)
  setupLocalStorageAutorun(self)
  setupRegionsAutorun(self)
  setupAspectLockAutorun(self)
  setupClearHoverOnPlotMove(self)
}
