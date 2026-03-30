import { lazy } from 'react'

import Plugin from '@jbrowse/core/Plugin'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import SaveAltIcon from '@mui/icons-material/SaveAlt'

import PatchListener from './ActionLogger/PatchListener.ts'
import ExportManager from './Export/ExportManager.ts'
import EpisodeManager from './RLPipeline/EpisodeManager.ts'
import observerViewModelFactory from './ObserverView/viewModel.ts'
import configSchema from './config.ts'

import type { RLObserverViewModel } from './ObserverView/viewModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

export default class RLAnalyticsPlugin extends Plugin {
  name = 'RLAnalyticsPlugin'
  configurationSchema = configSchema

  private patchListener: PatchListener | null = null
  private episodeManager: EpisodeManager | null = null
  private exportManager: ExportManager | null = null
  private observerModel: RLObserverViewModel | null = null

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() => {
      return new ViewType({
        name: 'RLObserverView',
        displayName: 'RL Observer',
        stateModel: observerViewModelFactory(),
        ReactComponent: lazy(
          () => import('./ObserverView/ObserverView.tsx'),
        ),
      })
    })
  }

  configure(pluginManager: PluginManager) {
    const rootModel = pluginManager.rootModel
    if (!rootModel) {
      return
    }

    // Clean up
    this.patchListener?.dispose()
    this.episodeManager?.dispose()
    this.exportManager?.dispose()

    // Initialize
    this.patchListener = new PatchListener(10000, 500, false)
    this.episodeManager = new EpisodeManager(300_000)
    this.exportManager = new ExportManager(this.episodeManager)

    const getView = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = (rootModel as any).session
      if (!session?.views) {
        return undefined
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return session.views.find((v: any) => v.type === 'LinearGenomeView')
    }

    this.episodeManager.setViewAccessor(getView)

    // Connect debounced actions → episode recording + observer logging
    this.patchListener.buffer.onDebouncedAction(action => {
      queueMicrotask(() => {
        const result = this.episodeManager!.recordAction(action)
        if (this.observerModel) {
          if (result) {
            this.logToObserver(result.step, result.nextState)
          } else {
            this.observerModel.addLogEntry(
              `${action.type} — no view for state extraction`,
            )
          }
        }
      })
    })

    // Attach to session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = (rootModel as any).session
    if (session) {
      this.patchListener.attach(session)
    }

    // Menu items
    if (isAbstractMenuManager(rootModel)) {
      rootModel.appendToMenu('Add', {
        label: 'RL Observer',
        onClick: () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const session = (rootModel as any).session
          if (session) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const view = session.addView('RLObserverView', {}) as any
            this.observerModel = view
          }
        },
      })

      rootModel.appendToMenu('Tools', {
        label: 'Export RL Data (JSONL)',
        icon: SaveAltIcon,
        onClick: () => {
          this.exportManager?.downloadJSONL()
        },
      })
    }

    // Auto-open observer if URL param set
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.has('rlObserver')) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = (rootModel as any).session
        if (session) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const view = session.addView('RLObserverView', {}) as any
          this.observerModel = view
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private logToObserver(step: any, state: any) {
    if (!this.observerModel) {
      return
    }
    const ts = new Date(step.timestamp).toISOString().slice(11, 23)
    const action = step.action
    const meta = step.actionMetadata
    const zl = state.zoomLevel
    const bp = state.bpPerPx.toFixed(2)
    const ref = state.refName
    const tracks = state.numTracks
    const reward = step.reward.toFixed(3)
    const eps = this.episodeManager?.currentEpisodeStepCount ?? 0

    // Action detail
    let detail = ''
    if (meta.deltaPixels !== undefined) {
      detail = ` Δ${Math.round(meta.deltaPixels as number)}px`
    }
    if (meta.zoomFactor !== undefined) {
      detail = ` ×${(meta.zoomFactor as number).toFixed(2)}`
    }
    if (meta.trackId !== undefined) {
      detail = ` ${meta.trackId}`
    }
    if (meta.widgetType !== undefined) {
      detail = ` ${meta.widgetType}`
    }

    const trackFlags = [
      state.hasReferenceSequence ? 'ref' : null,
      state.hasGeneTrack ? 'gene' : null,
      state.hasAlignmentTrack ? 'aln' : null,
      state.hasVariantTrack ? 'var' : null,
      state.hasQuantitativeTrack ? 'quant' : null,
    ]
      .filter(Boolean)
      .join(',')

    const line =
      `${ts} [${zl.padEnd(8)}] ${action.padEnd(14)}${detail.padEnd(20)} ` +
      `${ref}:${bp}bp/px  trk=${tracks}[${trackFlags}]  ` +
      `r=${reward}  step=${eps}`

    this.observerModel.addLogEntry(line)
  }

  /** Public accessors for testing */
  getExportManager() {
    return this.exportManager
  }

  getEpisodeManager() {
    return this.episodeManager
  }

  getPatchListener() {
    return this.patchListener
  }
}

export { configSchema }
export { ActionType } from './ActionLogger/ActionTypes.ts'
export type { ClassifiedAction } from './ActionLogger/ActionTypes.ts'
export type { BrowserState, Episode, Step } from './RLPipeline/types.ts'
