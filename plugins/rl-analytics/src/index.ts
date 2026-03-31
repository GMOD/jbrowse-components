import { lazy } from 'react'

import Plugin from '@jbrowse/core/Plugin'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import SaveAltIcon from '@mui/icons-material/SaveAlt'

import ActionListener from './ActionLogger/ActionListener.ts'
import ExportManager from './Export/ExportManager.ts'
import EpisodeManager from './RLPipeline/EpisodeManager.ts'
import observerViewModelFactory from './ObserverView/viewModel.ts'
import configSchema from './config.ts'

import type { RLObserverViewModel } from './ObserverView/viewModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

export default class RLAnalyticsPlugin extends Plugin {
  name = 'RLAnalyticsPlugin'
  configurationSchema = configSchema

  private actionListener: ActionListener | null = null
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
    this.actionListener?.dispose()
    this.episodeManager?.dispose()
    this.exportManager?.dispose()

    // Initialize
    this.actionListener = new ActionListener(10000, 500, false)
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
    this.actionListener.buffer.onDebouncedAction(action => {
      queueMicrotask(() => {
        const result = this.episodeManager!.recordAction(action)
        if (this.observerModel) {
          if (result) {
            this.logToObserver(result.step, result.nextState, action.sourceAction)
          } else {
            this.observerModel.addLogEntry(
              `${action.type} (${action.sourceAction}) — no view for state extraction`,
            )
          }
        }
      })
    })

    // Attach to rootModel — addMiddleware on the root intercepts ALL actions
    // in the entire MST tree, including views, tracks, and session
    this.actionListener.attach(rootModel)

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
            try { view.setDisplayName('Action Monitor') } catch { /* */ }
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
  private logToObserver(step: any, state: any, sourceAction: string) {
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

    let detail = ''
    if (meta.distance !== undefined) {
      detail = ` Δ${Math.round(meta.distance as number)}px`
    } else if (meta.offsetPx !== undefined) {
      detail = ` @${Math.round(meta.offsetPx as number)}px`
    }
    if (meta.startOffset !== undefined) {
      // BpOffset objects from moveTo
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = meta.startOffset as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = meta.endOffset as any
      if (s?.refName) {
        detail = ` ${s.refName}`
      }
    }
    if (meta.bpPerPx !== undefined) {
      detail += ` → ${(meta.bpPerPx as number).toFixed(2)}bp/px`
    }
    if (meta.trackId !== undefined) {
      detail = ` ${meta.trackId}`
      if (meta.direction) {
        detail += ` ${meta.direction}`
      }
    }
    if (meta.movingId !== undefined) {
      detail = ` ${meta.movingId} → ${meta.targetId}`
    }
    if (meta.viewType !== undefined) {
      detail = ` ${meta.viewType}`
    }
    if (meta.widgetType !== undefined) {
      detail = ` ${meta.widgetType}`
    }
    if (meta.target !== undefined) {
      detail = ` ${JSON.stringify(meta.target).slice(0, 40)}`
    }
    if (meta.operation !== undefined) {
      detail = ` ${meta.operation}`
    }
    if (meta.highlight !== undefined) {
      detail = ` bookmark`
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
      `${ts} ${sourceAction.padEnd(20)} [${zl.padEnd(8)}]` +
      `${detail.padEnd(25)} ` +
      `${ref}:${bp}bp/px  trk=${tracks}[${trackFlags}]  ` +
      `r=${reward}  #${eps}`

    this.observerModel.addLogEntry(line)
  }

  /** Public accessors for testing */
  getExportManager() {
    return this.exportManager
  }

  getEpisodeManager() {
    return this.episodeManager
  }

  getActionListener() {
    return this.actionListener
  }
}

export { configSchema }
export { ActionType } from './ActionLogger/ActionTypes.ts'
export type { ClassifiedAction } from './ActionLogger/ActionTypes.ts'
export type { BrowserState, Episode, Step } from './RLPipeline/types.ts'
