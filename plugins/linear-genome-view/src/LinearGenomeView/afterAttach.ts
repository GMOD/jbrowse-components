import {
  getSession,
  localStorageSetItem,
  parseLocString,
} from '@jbrowse/core/util'
import { addDisposer } from '@jbrowse/mobx-state-tree'
import { autorun, when } from 'mobx'

import type { LinearGenomeViewModel } from './model.ts'

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
  addDisposer(
    self,
    autorun(
      async function initAutorun() {
        const { init, initialized } = self
        if (!initialized) {
          return
        }
        if (init) {
          const session = getSession(self)
          const { assemblyManager } = session

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
            const idsNotFound: string[] = []
            for (const t of init.tracks) {
              try {
                if (typeof t === 'string') {
                  self.showTrack(t)
                } else {
                  self.showTrack(
                    t.trackId,
                    t.trackSnapshot ?? {},
                    t.displaySnapshot ?? {},
                  )
                }
              } catch (e) {
                const trackId = typeof t === 'string' ? t : t.trackId
                if (/Could not resolve identifier/.exec(`${e}`)) {
                  idsNotFound.push(trackId)
                } else {
                  throw e
                }
              }
            }
            if (idsNotFound.length) {
              session.notifyError(
                `Could not resolve identifiers: ${idsNotFound.join(',')}`,
                new Error(
                  `Could not resolve identifiers: ${idsNotFound.join(',')}`,
                ),
              )
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
              // ({refName, start, end, assemblyName?, color?, label?}) so URL
              // highlights can carry color/label like session-authored ones
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

          // clear init state
          self.setInit(undefined)
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
        localStorageSetItem('lgv-trackLabels', trackLabels)
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
