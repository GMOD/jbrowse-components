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
import StateEncoder from './RLPipeline/StateEncoder.ts'
import GameEngine from './ScavengerHunt/GameEngine.ts'
import { setGameEngine } from './ScavengerHunt/components/ScavengerHuntWidget.tsx'
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
  private gameEngine: GameEngine | null = null
  private stateEncoder = new StateEncoder()

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

    // Clean up previous subsystems
    this.patchListener?.dispose()
    this.episodeManager?.dispose()
    this.exportManager?.dispose()
    this.gameEngine?.dispose()

    // Initialize subsystems
    this.patchListener = new PatchListener(10000, 500, false)
    this.episodeManager = new EpisodeManager(300_000)
    this.exportManager = new ExportManager(this.episodeManager)
    this.gameEngine = new GameEngine()

    // View accessor — finds first LinearGenomeView in session
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
    this.gameEngine.setViewAccessor(getView)

    // Make game engine available to the widget
    setGameEngine(this.gameEngine)

    // Connect debounced actions to:
    // 1. Episode manager (RL data recording)
    // 2. Game engine (award checking + auto-validation)
    this.patchListener.buffer.onDebouncedAction(action => {
      queueMicrotask(() => {
        this.episodeManager!.recordAction(action)

        // Feed to game engine with current state for award checking
        const view = getView()
        if (view && this.gameEngine) {
          const state = this.stateEncoder.extractState(view, 0, 0)
          this.gameEngine.onAction(action, state)
        }
      })
    })

    // Attach to session
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

  getGameEngine() {
    return this.gameEngine
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

            // Wire game engine to model and task set
            if (this.gameEngine) {
              this.gameEngine.setModel(model)
              this.gameEngine.loadTaskSet(taskSet)
              // Start the first task
              const firstTask = model.currentTask
              if (firstTask) {
                model.startCurrentTask()
                this.gameEngine.startTask(firstTask)
              }
            }
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
