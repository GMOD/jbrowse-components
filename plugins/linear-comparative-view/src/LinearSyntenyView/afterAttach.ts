import { getSession } from '@jbrowse/core/util'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import {
  normalizeTrackInit,
  SearchResultsNotFoundError,
} from '@jbrowse/plugin-linear-genome-view'
import { withDiagonalizeProgress } from '@jbrowse/synteny-core'
import { autorun, when } from 'mobx'

import { applyInitSettings, normalizeTrackLevels } from './util/initHelpers.ts'

import type { LinearSyntenyViewModel } from './model.ts'
import type { LinearSyntenyViewInit } from './types.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// One genome row per init.views entry, each opened on its assembly's whole
// region set. Awaits every assembly first so a failure surfaces before any view
// is built — that ordering is what makes this the view's only fatal step, and
// what lets the catch below keep `init` for a retry.
async function buildViews(
  self: LinearSyntenyViewModel,
  init: LinearSyntenyViewInit,
) {
  const { assemblyManager } = getSession(self)
  const assemblies = await Promise.all(
    init.views.map(async v => {
      const asm = await assemblyManager.waitForAssembly(v.assembly)
      if (!asm) {
        throw new Error(`Assembly ${v.assembly} failed to load`)
      }
      return asm
    }),
  )
  self.setViews(
    assemblies.map((asm, idx) => ({
      type: 'LinearGenomeView' as const,
      bpPerPx: 1,
      offsetPx: 0,
      hideHeader: true,
      // A row init gives no tracks opens collapsed to its ruler when asked for
      // (the launch dialog's checkbox), never by default: an authored session
      // means what it wrote. Only the row's own emptiness is decided here — the
      // policy is the caller's.
      scalebarOnly:
        !!init.collapseEmptyRows && !init.views[idx]?.tracks?.length,
      displayedRegions: asm.regions,
      // trackLabels is a plain persisted prop — set it on the snapshot directly
      // rather than imperatively after attach
      ...(init.views[idx]?.trackLabels
        ? { trackLabels: init.views[idx].trackLabels }
        : {}),
    })),
  )
  await Promise.all(self.views.map(view => when(() => view.initialized)))
}

// Navigate one genome row, reporting a bad `loc` as that row's problem. Without
// this catch a single typo'd locstring rejects the whole Promise.all below, and
// the outer catch drops every row that loaded fine back to the import form —
// navToLocString throws both UnknownRefNameError (bad refName) and
// SearchResultsNotFoundError (a gene name that matched nothing).
async function navRowToLoc(
  self: LinearSyntenyViewModel,
  view: LinearGenomeViewModel,
  loc: string,
  assembly: string,
) {
  try {
    await view.navToLocString(loc, assembly)
  } catch (e) {
    console.error(e)
    const session = getSession(self)
    if (e instanceof SearchResultsNotFoundError) {
      // a gene name that matched nothing is a soft miss, not an app error
      session.notify(e.message, 'warning')
    } else {
      session.notifyError(`${e}`, e)
    }
  }
}

// Per-row location + track list. Rows are independent, so they navigate
// concurrently.
async function applyInitViewLocsAndTracks(
  self: LinearSyntenyViewModel,
  init: LinearSyntenyViewInit,
) {
  await Promise.all(
    init.views.map(async (viewInit, idx) => {
      const view = self.views[idx]
      if (view) {
        if (viewInit.loc) {
          await navRowToLoc(self, view, viewInit.loc, viewInit.assembly)
        } else {
          view.showAllRegionsInAssembly(viewInit.assembly)
        }
        if (viewInit.tracks) {
          for (const track of viewInit.tracks) {
            const { trackId, trackSnapshot, displaySnapshot } =
              normalizeTrackInit(track)
            view.showTrack(trackId, trackSnapshot, displaySnapshot)
          }
        }
      }
    }),
  )
}

// The synteny tracks themselves: `init.tracks` is per level (the gap between
// views[i] and views[i+1]), so a 3-way view has two entries.
function applyInitSyntenyTracks(
  self: LinearSyntenyViewModel,
  init: LinearSyntenyViewInit,
) {
  if (init.tracks) {
    for (const [i, ids] of normalizeTrackLevels(init.tracks).entries()) {
      for (const trackId of ids) {
        self.showTrack(trackId, i)
      }
    }
  }
}

// The views are initialized and their displayedRegions populated by the time
// this runs, and runDiagonalize fetches the whole-genome alignments it needs in
// its own RPC — so we diagonalize directly, no need to wait on the per-display
// render fetch first. withDiagonalizeProgress drives the reordering spinner +
// cancel and swallows the abort.
async function runAutoDiagonalize(self: LinearSyntenyViewModel) {
  await withDiagonalizeProgress(self, async opts => {
    const { runDiagonalize } = await import('./util/runDiagonalize.ts')
    await runDiagonalize(self, opts)
    // only now is the view truly diagonalized — release the `settled` gate. If
    // runDiagonalize threw, withDiagonalizeProgress catches it and this line is
    // skipped, so `settled` stays false and the capture times out loudly instead
    // of committing an undiagonalized view.
    if (isAlive(self)) {
      self.setAutoDiagonalizeComplete(true)
    }
  })
}

export function doAfterAttach(self: LinearSyntenyViewModel) {
  // Serialize concurrent firings: dockview mount + React Strict Mode
  // double-invoke cause width to settle in multiple steps. Each width change
  // re-fires this autorun, and without the guard a second run's setViews()
  // detaches the first run's view models — the first's
  // `when(() => view.initialized)` then throws on the dead node and the catch
  // reports a teardown as a view error.
  let running = false
  addDisposer(
    self,
    autorun(
      async function initAutorun() {
        const { init, width } = self
        if (!width || !init || running) {
          return
        }
        running = true
        try {
          // flag the pending reorder before any track render can paint, so
          // `settled` (→ synteny_canvas_done) can't fire on the pre-diagonalize
          // hairball during the view-building await window below (before
          // awaitingAutoDiagonalize flips the canvas off)
          if (init.autoDiagonalize) {
            self.setAutoDiagonalizeRequested(true)
          }
          await buildViews(self, init)
          await applyInitViewLocsAndTracks(self, init)
          applyInitSyntenyTracks(self, init)
          // split the band budget across however many levels this view has, so
          // a multi-way stack doesn't spend the whole viewport on ribbons. A no-op
          // at two levels (a pairwise view keeps the 100px default), and
          // applyInitSettings runs after, so an explicit init.levelHeights wins.
          self.autoScaleLevelHeights()
          applyInitSettings(self, init)
          if (init.autoDiagonalize) {
            await runAutoDiagonalize(self)
          }
          // the view may have been removed while the assemblies/tracks resolved,
          // and writing to a detached node throws, which would land in the
          // catch below and report a teardown as a view error
          if (isAlive(self)) {
            self.setInit(undefined)
          }
        } catch (e) {
          console.error(e)
          // Failure policy keys off whether the view has materialized, the same
          // line postProcessSnapshot already draws for persistence.
          //
          // Rows not built yet (buildViews threw: assembly missing, network
          // blip) — nothing is on screen and `init` is still persisted, so keep
          // it for a reload retry and record the error. setError is the whole
          // report: it flips showImportForm, and the form renders model.error in
          // its own banner, so a snackbar would state the same failure twice
          // (and the banner persists). The error is volatile and doesn't survive
          // the reload; in this session it flips the view off the loading
          // spinner onto the form, the only way out until then.
          //
          // Rows built — the view works, so a later failure is one sub-step's
          // problem and must not take the view down with it. setError would,
          // since showImportForm keys off `error` alone and would discard rows
          // that loaded fine. Clearing `init` is also what disarms the re-fire:
          // `width` is a dependency of this autorun, so leaving it set lets any
          // resize re-run buildViews, whose setViews rebuilds the rows and
          // throws away wherever the user had navigated.
          if (isAlive(self)) {
            if (self.views.length) {
              self.setInit(undefined)
              getSession(self).notifyError(`${e}`, e)
            } else {
              self.setError(e)
            }
          }
        } finally {
          running = false
        }
      },
      { name: 'LinearSyntenyViewInit' },
    ),
  )
}
