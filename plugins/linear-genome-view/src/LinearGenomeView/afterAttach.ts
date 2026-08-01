import {
  getSession,
  isSessionModelWithWidgets,
  localStorageSetItem,
  selectNamedRegions,
} from '@jbrowse/core/util'
import { coerceHighlight } from '@jbrowse/core/util/highlights'
import { installInitAutorun } from '@jbrowse/core/util/installInitAutorun'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun, when } from 'mobx'

import { SearchResultsNotFoundError } from '../searchUtils.ts'
import { partitionLaunchKeys } from './initKeys.ts'
import { normalizeTrackInit } from './normalizeTrackInit.ts'

import type { LinearGenomeViewModel } from './model.ts'
import type { InitState } from './types.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'

function warnInitKeyProblems(init: InitState) {
  const { viewProps, unknown } = partitionLaunchKeys(init)
  const unknownKeys = Object.keys(unknown)
  const viewPropKeys = Object.keys(viewProps)
  if (unknownKeys.length) {
    console.warn(
      `LinearGenomeView init ignored unknown key(s): ${unknownKeys.join(', ')}`,
    )
  }
  if (viewPropKeys.length) {
    console.warn(
      `LinearGenomeView init ignored view prop(s): ${viewPropKeys.join(', ')} — set these on the view alongside init, not inside it`,
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

/**
 * Autorun that handles the init state - navigating to initial location,
 * showing tracks, etc.
 */
export function setupInitAutorun(self: LinearGenomeViewModel) {
  installInitAutorun(self, {
    name: 'LGVInit',
    // `init` is what makes hasSomethingToShow / initPending report "loading"
    // until navigation populates displayedRegions, so the alternative gate
    // (clearing `init` up front, the way SpreadsheetView does) would flash the
    // import form mid-load.
    ready: () => self.initialized,
    // No pre-materialization phase to protect: the view is its own single row,
    // and `error` already derives a failed init assembly declaratively (via
    // initAssembly), so anything thrown out of applyInit is a failure of a
    // step, not of the view coming up.
    materialized: () => true,
    apply: init => applyInit(self, init),
  })
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
          showAminoAcids,
          showTrackOutlines,
          trackLabels,
        } = self
        localStorageSetItem('lgv-showCytobands', s(showCytobands))
        localStorageSetItem('lgv-showCenterLine', s(showCenterLine))
        localStorageSetItem('lgv-colorByCDS', s(colorByCDS))
        localStorageSetItem('lgv-showAminoAcids', s(showAminoAcids))
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
