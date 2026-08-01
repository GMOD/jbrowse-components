import {
  getSession,
  localStorageSetItem,
  parseLocString,
  selectNamedRegions,
} from '@jbrowse/core/util'
import { coerceHighlight } from '@jbrowse/core/util/highlights'
import { installInitAutorun } from '@jbrowse/core/util/installInitAutorun'
import { leadingEdgeDebounce } from '@jbrowse/core/util/leadingEdgeDebounce'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { withDiagonalizeProgress } from '@jbrowse/synteny-core'
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
      const highlight = coerceHighlight(entry, defaultAssembly, refName =>
        assemblyManager.isValidRefName(refName, defaultAssembly),
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
export function navAxisToLoc(
  view: Base1DViewModel,
  loc: string,
  assemblyName: string,
  assemblyManager: AssemblyManager,
) {
  const asm = assemblyManager.get(assemblyName)
  const {
    refName: parsedRef,
    start,
    end,
  } = parseLocString(loc, refName =>
    assemblyManager.isValidRefName(refName, assemblyName),
  )
  if (start !== undefined && end !== undefined) {
    const refName = asm?.getCanonicalRefName(parsedRef) ?? parsedRef
    const index = view.displayedRegions.findIndex(r => r.refName === refName)
    if (index !== -1) {
      const region = view.displayedRegions[index]!
      const o1 = region.reversed ? region.end - start : start - region.start
      const o2 = region.reversed ? region.end - end : end - region.start
      const [lo, hi] = o1 < o2 ? [o1, o2] : [o2, o1]
      view.moveTo(
        { refName, index, offset: lo },
        { refName, index, offset: hi },
      )
    }
  }
}

// Wait for `cond`, giving up on the two things that mean it will never come:
// the assemblies errored, or a newer init superseded this one. Every exit is
// caused by something that reports itself — an assembly failure lands in
// `error` and the import form's banner, a supersede is the next init taking
// over — so the caller re-checks its own precondition and skips quietly.
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
  await when(
    () =>
      superseded() || cond() || !!self.volatileError || !!self.assemblyErrors,
  )
}

function applyInitTracks(self: DotplotViewModel, init: DotplotViewInit) {
  // showTrack surfaces its own failures via showTrackGeneric's notifyError
  if (init.tracks) {
    for (const trackId of init.tracks) {
      self.showTrack(trackId)
    }
  }
}

function applyInitDisplaySettings(
  self: DotplotViewModel,
  init: DotplotViewInit,
) {
  if (init.showColorLegend !== undefined) {
    self.setShowColorLegend(init.showColorLegend)
  }
  if (init.colorBy) {
    self.setColorBy(init.colorBy)
  }
  if (init.minAlignmentLength !== undefined) {
    self.setMinAlignmentLength(init.minAlignmentLength)
  }
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
  const { assemblyManager } = getSession(self)
  const axes = [self.hview, self.vview]
  let changed = false
  for (const [i, v] of init.views.entries()) {
    const axis = axes[i]
    const names = v.displayedRegionNames
    const all = assemblyManager.get(self.assemblyNames[i]!)
    if (axis && names?.length && all?.regions) {
      const regions = selectNamedRegions(all.regions, names, n =>
        all.getCanonicalRefName(n),
      )
      // a list that matches nothing leaves the axis alone rather than blanking
      // it — an empty axis renders as a broken plot with no clue why
      if (regions.length) {
        axis.setDisplayedRegions(regions)
        changed = true
      }
    }
  }
  if (changed) {
    self.showAllRegions()
  }
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
        navAxisToLoc(
          axis,
          v.loc,
          self.assemblyNames[i]!,
          session.assemblyManager,
        )
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
  // a dotplot needs two axes. LaunchDotplotView enforces this, but a
  // hand-authored init (set via addView, bypassing the launcher) could be
  // malformed — fail loudly instead of silently producing a
  // [assembly, undefined] axis pair. Notified rather than thrown: a
  // structurally bad init can never succeed on retry, so it should be consumed
  // the way a successful one is instead of being kept and re-notified on every
  // reload.
  if (init.views.length < 2) {
    getSession(self).notifyError(
      `DotplotView init requires 2 views, got ${init.views.length}`,
    )
  } else {
    const [target, query] = init.views.map(v => v.assembly)
    // declare the reorder gate up front, before any track render can paint: it
    // outlives this pass (only the reorder itself lowers it) where the
    // `initPending` term covers only the apply window below
    self.beginAutoDiagonalize(!!init.autoDiagonalize)
    self.setAssemblyNames(target!, query!)
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
  const debounce = leadingEdgeDebounce(1000)
  addDisposer(
    self,
    autorun(
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
          debounce.prime()
        }
      },
      { name: 'DotplotRegions', scheduler: debounce.scheduler },
    ),
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

export function doAfterAttach(self: DotplotViewModel) {
  setupInitAutorun(self)
  setupLocalStorageAutorun(self)
  setupRegionsAutorun(self)
  setupAspectLockAutorun(self)
}
