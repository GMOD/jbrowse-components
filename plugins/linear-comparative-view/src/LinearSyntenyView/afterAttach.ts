import { getSession } from '@jbrowse/core/util'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { normalizeTrackInit } from '@jbrowse/plugin-linear-genome-view'
import { withDiagonalizeProgress } from '@jbrowse/synteny-core'
import { autorun, when } from 'mobx'

import { applyInitSettings, normalizeTrackLevels } from './util/initHelpers.ts'

import type { LinearSyntenyViewModel } from './model.ts'
import type { LinearSyntenyViewInit } from './types.ts'

// A level's heights stop being legible once this many are stacked, so the init
// path auto-scales them rather than leaving 100px rows overflowing the viewport.
const AUTO_SCALE_LEVEL_THRESHOLD = 4

// One genome row per init.views entry, each opened on its assembly's whole
// region set. Awaits every assembly first so a failure surfaces before any view
// is built (the catch in setupInitAutorun keeps `init` for a retry).
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
          await view.navToLocString(viewInit.loc, viewInit.assembly)
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
  // `when(() => view.initialized)` then throws on the dead node, the catch
  // clears init, and the import form appears.
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
          if (self.levels.length >= AUTO_SCALE_LEVEL_THRESHOLD) {
            self.autoScaleLevelHeights()
          }
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
          // setError is the whole report: it flips showImportForm, and the form
          // renders model.error in its own banner, so a notifyError snackbar
          // would state the same failure twice (and the banner persists).
          //
          // Keep init on failure: a transient error (assembly not yet
          // registered, a network blip) must stay recoverable. Clearing it here,
          // while views is still empty, permanently strands the view on the
          // import form with no retry. Leaving init set lets a reload re-run
          // this autorun (init is persisted while views is empty, see
          // postProcessSnapshot).
          //
          // The error itself is volatile, so it doesn't survive that reload —
          // in this session it flips the view off the loading spinner and onto
          // the import form, which is the only way out until then.
          if (isAlive(self)) {
            self.setError(e)
          }
        } finally {
          running = false
        }
      },
      { name: 'LinearSyntenyViewInit' },
    ),
  )
}
