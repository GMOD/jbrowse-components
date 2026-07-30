import {
  getSession,
  isSessionModelWithWidgets,
  localStorageSetItem,
  selectNamedRegions,
} from '@jbrowse/core/util'
import { coerceHighlight } from '@jbrowse/core/util/highlights'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun, when } from 'mobx'

import { SearchResultsNotFoundError } from '../searchUtils.ts'
import { initKeyProblems } from './initKeys.ts'
import { normalizeTrackInit } from './normalizeTrackInit.ts'

import type { LinearGenomeViewModel } from './model.ts'
import type { InitState } from './types.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'

function warnInitKeyProblems(init: InitState) {
  const { unknown, viewProps } = initKeyProblems(init)
  if (unknown.length) {
    console.warn(
      `LinearGenomeView init ignored unknown key(s): ${unknown.join(', ')}`,
    )
  }
  if (viewProps.length) {
    console.warn(
      `LinearGenomeView init ignored view prop(s): ${viewProps.join(', ')} — set these on the view alongside init, not inside it`,
    )
  }
}

// `init` is a frozen blob that often comes from hand-authored JSON, where a
// lone entry gets written bare (`tracks: 'genes'`). A string is iterable, so
// looping over it directly walked its characters — one track opened per letter.
function asArray<T>(arg: T[] | T | undefined) {
  return arg === undefined ? [] : Array.isArray(arg) ? arg : [arg]
}

// Activate tracklist first so the drawer opens before we navigate, so
// volatileWidth accounts for the drawer; otherwise navigation computes the
// region at full width and the drawer then obscures part of it. Opening the
// drawer shrinks the view, which the ResizeObserver reports as a volatileWidth
// change — but only if the drawer wasn't already open. So wait for the change
// (no timeout) only when we actually opened it; if a widget was already
// visible, the width is already correct and no change is coming.
async function openTracklist(
  self: LinearGenomeViewModel,
  session: AbstractSessionModel,
) {
  // activateTrackSelector throws without widget support, which would abort the
  // rest of init (navigation included) over an optional extra
  if (isSessionModelWithWidgets(session)) {
    const drawerWasOpen = !!session.visibleWidget
    const widthBefore = self.volatileWidth
    self.activateTrackSelector()
    if (!drawerWasOpen) {
      // Bounded so init can't wedge here if the drawer doesn't shrink the view
      // (e.g. embedded or modal-drawer layouts, where no width change is coming)
      await when(() => self.volatileWidth !== widthBefore, {
        timeout: 1000,
      }).catch(() => {})
    }
  } else {
    session.notify(
      'init.tracklist was ignored: this application has no track selector drawer',
      'warning',
    )
  }
}

// Restrict a whole-genome view to a named subset of the assembly's regions, in
// the requested order. Entries may be globs (`*_hap1`) — see selectNamedRegions,
// shared with the dotplot's per-axis `displayedRegionNames` so both views read
// the same name list the same way.
function showNamedRegions(
  self: LinearGenomeViewModel,
  session: AbstractSessionModel,
  assemblyName: string,
  names: string[],
) {
  const assembly = session.assemblyManager.get(assemblyName)
  const all = assembly?.regions
  if (all) {
    const regions = selectNamedRegions(all, names, n =>
      assembly.getCanonicalRefName(n),
    )
    if (regions.length) {
      self.setDisplayedRegions(regions)
      self.showAllRegions()
    } else {
      // a list that matches nothing leaves the view alone rather than blanking
      // it, so say why. Otherwise a typo'd refName silently shows the whole
      // genome and reads as displayedRegionNames being ignored
      session.notify(
        `displayedRegionNames matched no regions in ${assemblyName}: ${names.join(', ')}`,
        'warning',
      )
      // nothing shown yet: fall back to the whole genome rather than an empty
      // view. Already navigated (URL params layered onto a defaultSession): keep
      // what's there — a typo shouldn't discard the session's own navigation
      if (!self.hasDisplayedRegions) {
        self.showAllRegionsInAssembly(assemblyName)
      }
    }
  }
}

async function navigateInit(
  self: LinearGenomeViewModel,
  session: AbstractSessionModel,
  init: InitState,
) {
  try {
    if (init.loc) {
      // navToLocString waits for the assembly itself, and this autorun only
      // runs once `initialized` confirms init.assembly has loaded regions, so
      // no explicit waitForAssembly is needed here
      await self.navToLocString(init.loc, init.assembly, init.grow)
    } else if (init.displayedRegionNames) {
      // an explicit region list is a navigation request just like `loc`, so it
      // applies even when regions already exist (URL params layered onto a
      // defaultSession that already navigated)
      showNamedRegions(self, session, init.assembly, init.displayedRegionNames)
    } else if (!self.hasDisplayedRegions) {
      // a highlight-only init (nothing to navigate to) must not clobber a
      // defaultSession's existing navigation, so only auto-navigate when
      // nothing is shown yet
      self.showAllRegionsInAssembly(init.assembly)
    }
  } catch (e) {
    console.error(init, e)
    if (e instanceof SearchResultsNotFoundError) {
      // a &loc= gene name that matched nothing is a soft miss, not an app error
      session.notify(e.message, 'warning')
    } else {
      session.notifyError(`${e}`, e)
    }
  }
}

// showTrack funnels through showTrackGeneric, which surfaces any failure
// (unresolved id, bad config, etc) as its own snackbar
function showInitTracks(self: LinearGenomeViewModel, init: InitState) {
  for (const t of asArray(init.tracks)) {
    const { trackId, trackSnapshot, displaySnapshot } = normalizeTrackInit(t)
    self.showTrack(trackId, trackSnapshot, displaySnapshot)
  }
}

// backfill assemblyName on any session-authored highlights that omitted it so
// downstream code (bookmark widget grid, addBookmark, etc) doesn't have to keep
// falling back
function backfillHighlightAssemblies(self: LinearGenomeViewModel) {
  const fallback = self.assemblyNames[0]
  if (self.highlight.length && fallback) {
    const normalized = self.highlight.map(h =>
      h.assemblyName ? h : { ...h, assemblyName: fallback },
    )
    if (normalized.some((h, i) => h !== self.highlight[i])) {
      self.setHighlight(normalized)
    }
  }
}

function applyInitHighlights(
  self: LinearGenomeViewModel,
  session: AbstractSessionModel,
  init: InitState,
) {
  for (const h of asArray(init.highlight)) {
    // parseLocString throws on an unknown refName or a malformed locstring, and
    // one bad entry must take out neither its siblings nor the rest of init
    try {
      const highlight = coerceHighlight(h, init.assembly, refName =>
        session.assemblyManager.isValidRefName(refName, init.assembly),
      )
      if (highlight) {
        self.addToHighlights(highlight)
      }
    } catch (e) {
      console.error(e)
      session.notifyError(
        `Invalid init highlight ${JSON.stringify(h)}: ${e}`,
        e,
      )
    }
  }
}

async function applyInit(self: LinearGenomeViewModel, init: InitState) {
  const session = getSession(self)
  warnInitKeyProblems(init)
  if (init.tracklist) {
    await openTracklist(self, session)
  }
  // the view may have been removed while the drawer or the navigation resolved;
  // reading or mutating it past that point (and setInit in the caller's finally)
  // would throw on a detached node
  if (isAlive(self)) {
    await navigateInit(self, session, init)
    if (isAlive(self)) {
      showInitTracks(self, init)
      if (init.nav !== undefined) {
        self.setHideHeader(!init.nav)
      }
      backfillHighlightAssemblies(self)
      applyInitHighlights(self, session, init)
    }
  }
}

// Apply one init blob, then clear it — but ONLY when self.init is still the
// exact object we just applied. A setInit that lands while applyInit is
// awaiting (React StrictMode remounts, a programmatic re-launch) swaps in a new
// object; clearing unconditionally would silently drop that pending init (a
// subtle clobber). Leaving it lets drainInit apply it on the next iteration.
// isAlive-guarded since the apply may have detached the view.
async function applyInitOnce(self: LinearGenomeViewModel, init: InitState) {
  try {
    await applyInit(self, init)
  } catch (e) {
    // the autorun body is async, so anything escaping here becomes an unhandled
    // rejection: no snackbar, and the drain stops with the view half-initialized.
    // Report it instead; the finally still clears init, so the loop below can't
    // spin on the same failure
    console.error(e)
    if (isAlive(self)) {
      getSession(self).notifyError(`${e}`, e)
    }
  } finally {
    if (isAlive(self) && self.init === init) {
      self.setInit(undefined)
    }
  }
}

// Apply pending inits one at a time until none remain. Serializing (rather than
// letting the autorun run applyInit concurrently) is what keeps re-entrant width
// churn safe: overlapping applies duplicated init.highlight — most visible under
// React StrictMode's double mount, which churns volatileWidth and re-triggers
// the autorun. Looping also guarantees an init set mid-apply is eventually
// applied instead of stranded.
async function drainInit(self: LinearGenomeViewModel) {
  while (isAlive(self) && self.initialized && self.init) {
    await applyInitOnce(self, self.init)
  }
}

/**
 * Autorun that handles the init state - navigating to initial location,
 * showing tracks, etc.
 */
export function setupInitAutorun(self: LinearGenomeViewModel) {
  // `draining` is a plain closure flag, intentionally NOT observable so it stays
  // out of the dependency graph, ensuring only one drain runs at a time. The
  // autorun observes init/initialized (read synchronously before any await) so
  // it re-fires when either changes, but a re-entrant pass while a drain is
  // in-flight is a no-op — drainInit already consumes whatever init is current.
  //
  // The flag is load-bearing, not incidental: `initialized` flips
  // true→false→true when volatileWidth resets (StrictMode remount, dockview
  // re-mount), which re-fires this whether it is an autorun or a reaction. The
  // other way out (clearing `init` up front, the way SpreadsheetView does) is
  // not available here, because `init` is what makes hasSomethingToShow /
  // initPending report "loading" until navigation populates displayedRegions, so
  // clearing it early flashes the import form mid-load.
  let draining = false
  addDisposer(
    self,
    autorun(
      async function initAutorun() {
        const { init, initialized } = self
        if (!initialized || !init || draining) {
          return
        }
        draining = true
        try {
          await drainInit(self)
        } finally {
          draining = false
        }
      },
      {
        name: 'LGVInit',
      },
    ),
  )
}

/**
 * Autorun that updates coarse dynamic blocks with a delay
 */
function setupCoarseDynamicBlocksAutorun(self: LinearGenomeViewModel) {
  addDisposer(
    self,
    autorun(
      function coarseDynamicBlocksAutorun() {
        if (self.initialized) {
          self.setCoarseDynamicBlocks(self.dynamicBlocks, self.bpPerPx)
        }
      },
      {
        delay: 500,
        name: 'LGVCoarseDynamicBlocks',
      },
    ),
  )
}

/**
 * Autorun that syncs view settings to localStorage
 */
function setupLocalStorageAutorun(self: LinearGenomeViewModel) {
  addDisposer(
    self,
    autorun(
      function localStorageAutorun() {
        const s = (s: unknown) => JSON.stringify(s)
        const {
          showCytobands,
          showCenterLine,
          colorByCDS,
          showTrackOutlines,
          trackLabels,
        } = self
        localStorageSetItem('lgv-showCytobands', s(showCytobands))
        localStorageSetItem('lgv-showCenterLine', s(showCenterLine))
        localStorageSetItem('lgv-colorByCDS', s(colorByCDS))
        localStorageSetItem('lgv-showTrackOutlines', s(showTrackOutlines))
        // skip writing the empty default — otherwise reads later round-trip to
        // '' instead of null, hiding the config-fallback path
        if (trackLabels) {
          localStorageSetItem('lgv-trackLabels', trackLabels)
        }
      },
      {
        name: 'LGVLocalStorage',
      },
    ),
  )
}

/**
 * Sets up all afterAttach autoruns for the LinearGenomeView
 */
export function doAfterAttach(self: LinearGenomeViewModel) {
  setupInitAutorun(self)
  setupCoarseDynamicBlocksAutorun(self)
  setupLocalStorageAutorun(self)
}
