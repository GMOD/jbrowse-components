import { lazy } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import Plugin from '@jbrowse/core/Plugin'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'
import SaveAltIcon from '@mui/icons-material/SaveAlt'

import ActionListener from './ActionLogger/ActionListener.ts'
import ExportManager from './Export/ExportManager.ts'
import EpisodeManager from './RLPipeline/EpisodeManager.ts'
import observerViewModelFactory from './ObserverView/viewModel.ts'
import configSchema from './config.ts'

import type { RLObserverViewModel } from './ObserverView/viewModel.ts'
import type { BrowserState, Step } from './RLPipeline/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

/** Module-level storage for test access — keyed by plugin instance */
const testRefs = new WeakMap<
  RLAnalyticsPlugin,
  {
    actionListener: ActionListener
    episodeManager: EpisodeManager
    exportManager: ExportManager
  }
>()

interface SessionLike {
  views?: { type: string }[]
  addView?: (typeName: string, initialState: object) => unknown
}

export default class RLAnalyticsPlugin extends Plugin {
  name = 'RLAnalyticsPlugin'
  configurationSchema = configSchema

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() => {
      return new ViewType({
        name: 'RLObserverView',
        displayName: 'Action Monitor',
        stateModel: observerViewModelFactory(pluginManager),
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

    // Read config (safe fallback for tests)
    let bufferSize = 10000
    let debounceMs = 500
    let inactivityMs = 300_000
    let maxEpisodes = 100
    let logOther = false
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conf = (rootModel as any).jbrowse?.configuration
        ?.RLAnalyticsPlugin
      if (conf) {
        bufferSize = getConf(conf, 'actionBufferSize') ?? bufferSize
        debounceMs = getConf(conf, 'debounceMs') ?? debounceMs
        inactivityMs = getConf(conf, 'inactivityTimeoutMs') ?? inactivityMs
        maxEpisodes = getConf(conf, 'maxEpisodes') ?? maxEpisodes
        logOther = getConf(conf, 'logOtherActions') ?? logOther
      }
    } catch {
      // config not available
    }

    // Session accessor
    const getSession = (): SessionLike | undefined =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (rootModel as any).session as SessionLike | undefined

    // View accessors
    const getLinearGenomeView = () => {
      try {
        return getSession()?.views?.find(v => v.type === 'LinearGenomeView')
      } catch {
        return undefined
      }
    }

    const getObserverView = (): RLObserverViewModel | undefined => {
      try {
        const view = getSession()?.views?.find(
          v => v.type === 'RLObserverView',
        )
        if (view && isAlive(view)) {
          return view as unknown as RLObserverViewModel
        }
      } catch {
        // destroyed
      }
      return undefined
    }

    // Create subsystems
    const actionListener = new ActionListener(bufferSize, debounceMs, logOther)
    const episodeManager = new EpisodeManager(inactivityMs, maxEpisodes)
    const exportManager = new ExportManager(episodeManager)

    episodeManager.setViewAccessor(getLinearGenomeView)

    // Wire webhook if configured
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conf = (rootModel as any).jbrowse?.configuration?.RLAnalyticsPlugin
      if (conf) {
        const webhookUrl = getConf(conf, 'webhookUrl')
        if (webhookUrl) {
          exportManager.configureWebhook(webhookUrl)
        }
      }
    } catch {
      // config not available
    }

    // Wire debounced actions → episode recording + observer
    actionListener.buffer.onDebouncedAction(action => {
      setTimeout(() => {
        const result = episodeManager.recordAction(action)
        const observer = getObserverView()
        if (observer) {
          if (result) {
            logToObserver(
              observer,
              result.step,
              result.nextState,
              action.sourceAction,
              episodeManager,
              getLinearGenomeView,
            )
          } else {
            observer.addLogEntry(
              `${action.type} (${action.sourceAction}) — no view`,
            )
          }
        }
      }, 0)
    })

    // Attach middleware to SESSION (not rootModel) to limit scope.
    // This intercepts actions on session and all its children (views, tracks,
    // widgets) without intercepting root-level config/assembly actions.
    const session = getSession()
    if (session) {
      actionListener.attach(session as Parameters<typeof actionListener.attach>[0])
    }

    // Menu items
    if (isAbstractMenuManager(rootModel)) {
      rootModel.appendToMenu('Add', {
        label: 'Action Monitor',
        onClick: () => {
          const s = getSession()
          if (s?.addView) {
            const view = s.addView('RLObserverView', {})
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(view as any).setDisplayName?.('Action Monitor')
          }
        },
      })

      rootModel.appendToMenu('Tools', {
        label: 'Export RL Data (JSONL)',
        icon: SaveAltIcon,
        onClick: () => {
          exportManager.downloadJSONL()
        },
      })
    }

    // Auto-open observer
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.has('rlObserver') && !getObserverView()) {
        const s = getSession()
        if (s?.addView) {
          const view = s.addView('RLObserverView', {})
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(view as any).setDisplayName?.('Action Monitor')
        }
      }
    }

    // Store for test access (WeakMap, not class field)
    testRefs.set(this, { actionListener, episodeManager, exportManager })
  }

  /** @internal test-only */
  getExportManager() {
    return testRefs.get(this)?.exportManager ?? null
  }
  /** @internal test-only */
  getEpisodeManager() {
    return testRefs.get(this)?.episodeManager ?? null
  }
  /** @internal test-only */
  getActionListener() {
    return testRefs.get(this)?.actionListener ?? null
  }
}

// ---- Helper functions (module-level, not on the class) ----

function logToObserver(
  observer: RLObserverViewModel,
  step: Step,
  state: BrowserState,
  sourceAction: string,
  episodeManager: EpisodeManager,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getView: () => any,
) {
  const ts = new Date(step.timestamp).toISOString().slice(11, 23)
  const meta = step.actionMetadata
  const zl = state.zoomLevel
  const bp = state.bpPerPx.toFixed(2)
  const ref = state.refName
  const tracks = state.numTracks
  const eps = episodeManager.currentEpisodeStepCount

  let detail = ''
  if (meta.distance !== undefined) {
    detail = ` Δ${Math.round(meta.distance as number)}px`
  } else if (meta.offsetPx !== undefined) {
    detail = ` @${Math.round(meta.offsetPx as number)}px`
  }
  if (meta.startOffset !== undefined) {
    const s = meta.startOffset as { refName?: string }
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
    const from = resolveInstanceId(meta.movingId as string, getView)
    const to = resolveInstanceId(meta.targetId as string, getView)
    detail = from === to ? ` ${from}` : ` ${from} → ${to}`
  }
  if (meta.viewType !== undefined) {
    detail = ` ${meta.viewType}`
  }
  if (meta.widgetType !== undefined) {
    detail = ` ${meta.widgetType}`
  }
  if (meta.searchText !== undefined) {
    detail = ` "${meta.searchText}"`
  }
  if (meta.target !== undefined && !meta.searchText) {
    detail = ` ${JSON.stringify(meta.target).slice(0, 40)}`
  }
  if (meta.colorBy !== undefined) {
    detail = ` color=${meta.colorBy}`
  }
  if (meta.sortBy !== undefined) {
    detail = ` sort=${meta.sortBy}`
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

  observer.addLogEntry(
    `${ts} ${sourceAction.padEnd(20)} [${zl.padEnd(8)}]` +
      `${detail.padEnd(25)} ` +
      `${ref}:${bp}bp/px  trk=${tracks}[${trackFlags}]  ` +
      `#${eps}`,
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveInstanceId(instanceId: string, getView: () => any): string {
  try {
    const view = getView()
    for (const t of view?.tracks ?? []) {
      if (t.id === instanceId) {
        try {
          const tid = t.configuration?.trackId
          if (tid) {
            return String(tid)
          }
        } catch {
          /* */
        }
        if (typeof t.configuration === 'string') {
          return t.configuration
        }
        return instanceId
      }
    }
  } catch {
    // fall through
  }
  return instanceId
}

export { configSchema }
export { ActionType } from './ActionLogger/ActionTypes.ts'
export type { ClassifiedAction } from './ActionLogger/ActionTypes.ts'
export type { BrowserState, Episode, Step } from './RLPipeline/types.ts'
