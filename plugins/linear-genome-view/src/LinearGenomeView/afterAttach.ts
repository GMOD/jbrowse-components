import {
  getSession,
  localStorageSetItem,
  parseLocString,
} from '@jbrowse/core/util'
import { addDisposer } from '@jbrowse/mobx-state-tree'
import { autorun, when } from 'mobx'

import type { LinearGenomeViewModel } from './model.ts'

// keep in sync with the InitState interface (types.ts) — a missing entry here
// makes a valid init key warn as "unknown" below
const knownInitKeys = new Set([
  'loc',
  'assembly',
  'tracks',
  'tracklist',
  'nav',
  'highlight',
])

function tryParseJson(s: string): Record<string, unknown> | undefined {
  try {
    const v: unknown = JSON.parse(s)
    return v && typeof v === 'object'
      ? (v as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Autorun that handles the init state - navigating to initial location,
 * showing tracks, etc.
 */
export function setupInitAutorun(self: LinearGenomeViewModel) {
  // This autorun is async and only clears `init` at the end, yet it reads
  // volatileWidth (directly for the tracklist-width settle, and via the
  // `initialized` getter) — so a width change mid-apply re-triggers it while
  // `init` is still set, and the second pass re-applies init.highlight as a
  // duplicate (most visible under React StrictMode's double mount, which
  // churns volatileWidth). This plain closure flag (intentionally NOT an
  // observable, so it stays out of the dependency graph) makes re-entrant runs
  // no-op until the in-flight apply finishes and clears init.
  let applyingInit = false
  addDisposer(
    self,
    autorun(
      async function initAutorun() {
        const { init, initialized } = self
        if (!initialized || !init || applyingInit) {
          return
        }
        applyingInit = true
        try {
          const session = getSession(self)
          const { assemblyManager } = session

          // a declarative init is easy to typo (e.g. `tracksList`,
          // `highlights`); MST stores it as a frozen blob so a mistyped key
          // would otherwise be silently dropped with no diagnostic
          const unknownKeys = Object.keys(init).filter(
            k => !knownInitKeys.has(k),
          )
          if (unknownKeys.length) {
            console.warn(
              `LinearGenomeView init ignored unknown key(s): ${unknownKeys.join(', ')}`,
            )
          }

          // Workaround: activate tracklist first so the drawer opens before we
          // navigate. This ensures volatileWidth accounts for the drawer width.
          // Without this, the navigation calculates the region based on full
          // width, then the drawer opens and obscures part of the region.
          if (init.tracklist) {
            self.activateTrackSelector()
            const currentWidth = self.volatileWidth
            await when(() => self.volatileWidth !== currentWidth, {
              timeout: 500,
            }).catch(() => {
              // Timeout is ok - width may not change if drawer was already open
            })
          }

          try {
            if (init.loc) {
              const asm = await assemblyManager.waitForAssembly(init.assembly)
              if (!asm) {
                throw new Error('Assembly not found')
              }
              await self.navToLocString(init.loc, init.assembly)
            } else {
              self.showAllRegionsInAssembly(init.assembly)
            }
          } catch (e) {
            console.error(init, e)
            session.notifyError(`${e}`, e)
          }

          if (init.tracks) {
            // showTrack funnels through showTrackGeneric, which surfaces any
            // failure (unresolved id, bad config, etc) as its own snackbar
            for (const t of init.tracks) {
              if (typeof t === 'string') {
                self.showTrack(t)
              } else {
                self.showTrack(
                  t.trackId,
                  t.trackSnapshot ?? {},
                  t.displaySnapshot ?? {},
                )
              }
            }
          }

          if (init.nav !== undefined) {
            self.setHideHeader(!init.nav)
          }

          // backfill assemblyName on any session-authored highlights that
          // omitted it so downstream code (bookmark widget grid, addBookmark,
          // etc) doesn't have to keep falling back
          if (self.highlight.length) {
            const fallback = self.assemblyNames[0]
            if (fallback) {
              const normalized = self.highlight.map(h =>
                h.assemblyName ? h : { ...h, assemblyName: fallback },
              )
              if (normalized.some((h, i) => h !== self.highlight[i])) {
                self.setHighlight(normalized)
              }
            }
          }

          if (init.highlight) {
            for (const h of init.highlight) {
              // accept either a loc string ("chr1:100-200") or a JSON object
              // ({refName, start, end, assemblyName?, color?, label?}) to carry
              // color/label like session-authored highlights. note: the
              // jbrowse-web &highlight= URL param is space-split, so the JSON
              // form is only reliable for programmatic init.highlight entries
              // (createViewState/session JSON) or space-free JSON; a JSON value
              // containing a space (e.g. a label) is shattered by the split
              const json = h.trim().startsWith('{') && tryParseJson(h)
              if (
                json &&
                typeof json.refName === 'string' &&
                typeof json.start === 'number' &&
                typeof json.end === 'number'
              ) {
                self.addToHighlights({
                  refName: json.refName,
                  start: json.start,
                  end: json.end,
                  assemblyName:
                    typeof json.assemblyName === 'string'
                      ? json.assemblyName
                      : init.assembly,
                  color:
                    typeof json.color === 'string' ? json.color : undefined,
                  label:
                    typeof json.label === 'string' ? json.label : undefined,
                })
              } else {
                const p = parseLocString(h, refName =>
                  assemblyManager.isValidRefName(refName, init.assembly),
                )
                const { start, end } = p
                if (start !== undefined && end !== undefined) {
                  self.addToHighlights({
                    ...p,
                    start,
                    end,
                    assemblyName: init.assembly,
                  })
                }
              }
            }
          }
        } finally {
          // always clear init (even on a thrown apply) so a re-entrant run
          // early-returns, and release the guard for any future setInit
          self.setInit(undefined)
          applyingInit = false
        }
      },
      { name: 'LGVInit' },
    ),
  )
}

/**
 * Autorun that updates coarse dynamic blocks with a delay
 */
export function setupCoarseDynamicBlocksAutorun(self: LinearGenomeViewModel) {
  addDisposer(
    self,
    autorun(
      function coarseDynamicBlocksAutorun() {
        if (self.initialized) {
          self.setCoarseDynamicBlocks(self.dynamicBlocks, self.bpPerPx)
        }
      },
      { delay: 500, name: 'LGVCoarseDynamicBlocks' },
    ),
  )
}

/**
 * Autorun that syncs view settings to localStorage
 */
export function setupLocalStorageAutorun(self: LinearGenomeViewModel) {
  addDisposer(
    self,
    autorun(
      function localStorageAutorun() {
        const s = (s: unknown) => JSON.stringify(s)
        const {
          showCytobandsSetting,
          showCenterLine,
          colorByCDS,
          showTrackOutlines,
          trackLabels,
          scrollZoom,
        } = self
        localStorageSetItem('lgv-showCytobands', s(showCytobandsSetting))
        localStorageSetItem('lgv-showCenterLine', s(showCenterLine))
        localStorageSetItem('lgv-colorByCDS', s(colorByCDS))
        localStorageSetItem('lgv-showTrackOutlines', s(showTrackOutlines))
        // skip writing the empty default — otherwise reads later round-trip to
        // '' instead of null, hiding the config-fallback path
        if (trackLabels) {
          localStorageSetItem('lgv-trackLabels', trackLabels)
        }
        localStorageSetItem('lgv-scrollZoom', s(scrollZoom))
      },
      { name: 'LGVLocalStorage' },
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
