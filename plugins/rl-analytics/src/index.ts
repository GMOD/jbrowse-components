import { lazy } from 'react'

import Plugin from '@jbrowse/core/Plugin'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import {
  isAbstractMenuManager,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import AssessmentIcon from '@mui/icons-material/Assessment'
import ExploreIcon from '@mui/icons-material/Explore'
import SaveAltIcon from '@mui/icons-material/SaveAlt'

import PatchListener from './ActionLogger/PatchListener.ts'
import ExportManager from './Export/ExportManager.ts'
import EpisodeManager from './RLPipeline/EpisodeManager.ts'
import configSchema from './config.ts'
import {
  ScavengerHuntModel,
  configSchema as scavengerConfigSchema,
} from './ScavengerHunt/model.ts'

import type { TaskSet } from './ScavengerHunt/tasks/taskSchema.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

export default class RLAnalyticsPlugin extends Plugin {
  name = 'RLAnalyticsPlugin'
  configurationSchema = configSchema

  private patchListener: PatchListener | null = null
  private episodeManager: EpisodeManager | null = null
  private exportManager: ExportManager | null = null

  install(pluginManager: PluginManager) {
    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'ScavengerHuntWidget',
        heading: 'Scavenger Hunt',
        configSchema: scavengerConfigSchema,
        stateModel: ScavengerHuntModel,
        ReactComponent: lazy(
          () =>
            import('./ScavengerHunt/components/ScavengerHuntWidget.tsx'),
        ),
      })
    })
  }

  configure(pluginManager: PluginManager) {
    const rootModel = pluginManager.rootModel
    if (!rootModel) {
      return
    }

    // Clean up any previous subsystems (configure may be called multiple
    // times in test environments where the root model is recreated)
    this.patchListener?.dispose()
    this.episodeManager?.dispose()
    this.exportManager?.dispose()

    // Initialize subsystems
    this.patchListener = new PatchListener(10000, 500, false)
    this.episodeManager = new EpisodeManager(300_000)
    this.exportManager = new ExportManager(this.episodeManager)

    // Wire the view accessor for state extraction (LinearGenomeView only)
    this.episodeManager.setViewAccessor(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = (rootModel as any).session
      if (!session?.views) {
        return undefined
      }
      // Find the first LinearGenomeView
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return session.views.find((v: any) => v.type === 'LinearGenomeView')
    })

    // Connect debounced actions to episode manager.
    // Debounced actions fire after the buffer's debounce window closes,
    // so rapid pan/zoom events are merged into single actions.
    // Use queueMicrotask to avoid interfering with synchronous MST patch
    // processing — reading computed properties during onPatch can disrupt
    // model initialization.
    this.patchListener.buffer.onDebouncedAction(action => {
      queueMicrotask(() => {
        this.episodeManager!.recordAction(action)
      })
    })

    // Defer patch listener attachment to next tick to avoid interfering
    // with synchronous model initialization (e.g. view init processing)
    // Attach to session instead of rootModel to avoid interfering with
    // root-level model initialization (views, etc.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = (rootModel as any).session
    if (session) {
      this.patchListener.attach(session)
    }

    // Add menu items
    if (isAbstractMenuManager(rootModel)) {
      rootModel.appendToMenu('Tools', {
        label: 'Scavenger Hunt',
        icon: ExploreIcon,
        onClick: () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const session = (rootModel as any).session
          if (isSessionModelWithWidgets(session)) {
            let widget = session.widgets.get('ScavengerHunt')
            if (!widget) {
              widget = session.addWidget(
                'ScavengerHuntWidget',
                'ScavengerHunt',
              )
            }
            session.showWidget(widget)
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

      rootModel.appendToMenu('Tools', {
        label: 'RL Analytics Status',
        icon: AssessmentIcon,
        onClick: () => {
          const episodes = this.episodeManager?.getAllEpisodes() ?? []
          const totalSteps = episodes.reduce(
            (sum, ep) => sum + ep.steps.length,
            0,
          )
          const completed = episodes.filter(
            ep => ep.outcome === 'completed',
          ).length
          // eslint-disable-next-line no-alert
          alert(
            `RL Analytics Status\n\n` +
              `Episodes: ${episodes.length}\n` +
              `Completed: ${completed}\n` +
              `Total steps: ${totalSteps}\n` +
              `Buffer size: ${this.patchListener?.buffer.length ?? 0}`,
          )
        },
      })
    }

    // Auto-load scavenger tasks from URL parameter
    this.loadTasksFromUrl(pluginManager)
  }

  /** Public accessors for testing and external integration */
  getExportManager() {
    return this.exportManager
  }

  getEpisodeManager() {
    return this.episodeManager
  }

  getPatchListener() {
    return this.patchListener
  }

  private loadTasksFromUrl(pluginManager: PluginManager) {
    if (typeof window === 'undefined') {
      return
    }
    const urlParams = new URLSearchParams(window.location.search)
    const tasksUrl = urlParams.get('scavengerTasks')
    const workerId = urlParams.get('workerId') ?? ''
    const assignmentId = urlParams.get('assignmentId') ?? ''

    if (tasksUrl) {
      void fetch(tasksUrl)
        .then(r => r.json() as Promise<TaskSet>)
        .then(taskSet => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const session = (pluginManager.rootModel as any)?.session
          if (isSessionModelWithWidgets(session)) {
            const widget = session.addWidget(
              'ScavengerHuntWidget',
              'ScavengerHunt',
              {},
            )
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const model = widget as any
            model.loadTaskSet(taskSet)
            if (workerId) {
              model.setWorkerId(workerId)
            }
            if (assignmentId) {
              model.setAssignmentId(assignmentId)
            }
            session.showWidget(widget)
          }
        })
        .catch(err => {
          console.error('Failed to load scavenger hunt tasks:', err)
        })
    }
  }
}

export { configSchema }
export { ActionType } from './ActionLogger/ActionTypes.ts'
export type { ClassifiedAction } from './ActionLogger/ActionTypes.ts'
export type { BrowserState, Episode, Step, TaskConfig } from './RLPipeline/types.ts'
