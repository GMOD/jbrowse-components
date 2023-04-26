/* eslint-disable @typescript-eslint/no-explicit-any */
import { lazy } from 'react'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import {
  readConfObject,
  isConfigurationModel,
} from '@jbrowse/core/configuration'
import { Region } from '@jbrowse/core/util/types'
import addSnackbarToModel from '@jbrowse/core/ui/SnackbarModel'
import { localStorageSetItem } from '@jbrowse/core/util'
import { supportedIndexingAdapters } from '@jbrowse/text-indexing'
import { autorun } from 'mobx'
import {
  addDisposer,
  getParent,
  getSnapshot,
  isAlive,
  types,
  IAnyStateTreeNode,
  SnapshotIn,
} from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'

import { Session as CoreSession } from '@jbrowse/product-core'

// icons
import SettingsIcon from '@mui/icons-material/Settings'
import CopyIcon from '@mui/icons-material/FileCopy'
import DeleteIcon from '@mui/icons-material/Delete'
import InfoIcon from '@mui/icons-material/Info'
import { Indexing } from '@jbrowse/core/ui/Icons'
import Base from './Base'
import Assemblies from './Assemblies'

const AboutDialog = lazy(() => import('@jbrowse/core/ui/AboutDialog'))

export declare interface ReferringNode {
  node: IAnyStateTreeNode
  key: string
}

/**
 * #stateModel JBrowseDesktopSessionModel
 * inherits SnackbarModel
 */
export default function sessionModelFactory(
  pluginManager: PluginManager,
  assemblyConfigSchemasType = types.frozen(),
) {
  const sessionModel = types
    .compose(
      'JBrowseDesktopSessionModel',
      Base(pluginManager),
      CoreSession.ReferenceManagement(pluginManager),
      CoreSession.Connections(pluginManager),
      CoreSession.DrawerWidgets(pluginManager),
      CoreSession.DialogQueue(pluginManager),
      Assemblies(pluginManager, assemblyConfigSchemasType),
    )
    .views(self => ({
      /**
       * #getter
       */
      get rpcManager() {
        return getParent<any>(self).jbrowse.rpcManager
      },
      /**
       * #getter
       */
      get configuration(): AnyConfigurationModel {
        return getParent<any>(self).jbrowse.configuration
      },
      /**
       * #getter
       */
      get tracks(): AnyConfigurationModel[] {
        return getParent<any>(self).jbrowse.tracks
      },
      /**
       * #getter
       */
      get textSearchManager(): TextSearchManager {
        return getParent<any>(self).textSearchManager
      },
      /**
       * #getter
       */
      get connections() {
        return getParent<any>(self).jbrowse.connections
      },
      /**
       * #getter
       */
      get savedSessions() {
        return getParent<any>(self).jbrowse.savedSessions
      },
      /**
       * #getter
       */
      get savedSessionNames() {
        return getParent<any>(self).jbrowse.savedSessionNames
      },
      /**
       * #getter
       */
      get history() {
        return getParent<any>(self).history
      },
      /**
       * #getter
       */
      get menus() {
        return getParent<any>(self).menus
      },

      /**
       * #getter
       */
      get assemblyManager() {
        return getParent<any>(self).assemblyManager
      },
      /**
       * #getter
       */
      get version() {
        return getParent<any>(self).version
      },
      /**
       * #method
       */
      renderProps() {
        return { theme: readConfObject(this.configuration, 'theme') }
      },
      /**
       * #getter
       */
      get visibleWidget() {
        if (isAlive(self)) {
          // returns most recently added item in active widgets
          return [...self.activeWidgets.values()][self.activeWidgets.size - 1]
        }
        return undefined
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      moveViewUp(id: string) {
        const idx = self.views.findIndex(v => v.id === id)

        if (idx === -1) {
          return
        }
        if (idx > 0) {
          self.views.splice(idx - 1, 2, self.views[idx], self.views[idx - 1])
        }
      },
      /**
       * #action
       */
      moveViewDown(id: string) {
        const idx = self.views.findIndex(v => v.id === id)

        if (idx === -1) {
          return
        }

        if (idx < self.views.length - 1) {
          self.views.splice(idx, 2, self.views[idx + 1], self.views[idx])
        }
      },

      /**
       * #action
       */
      setDrawerPosition(arg: string) {
        self.drawerPosition = arg
        localStorage.setItem('drawerPosition', arg)
      },

      /**
       * #action
       */
      addView(typeName: string, initialState = {}) {
        const typeDefinition = pluginManager.getElementType('view', typeName)
        if (!typeDefinition) {
          throw new Error(`unknown view type ${typeName}`)
        }

        const length = self.views.push({
          ...initialState,
          type: typeName,
        })
        return self.views[length - 1]
      },

      /**
       * #action
       */
      removeView(view: any) {
        for (const [, widget] of self.activeWidgets) {
          if (widget.view && widget.view.id === view.id) {
            self.hideWidget(widget)
          }
        }
        self.views.remove(view)
      },

      /**
       * #action
       */
      addTrackConf(trackConf: any) {
        return getParent<any>(self).jbrowse.addTrackConf(trackConf)
      },

      /**
       * #action
       */
      deleteTrackConf(trackConf: AnyConfigurationModel) {
        const callbacksToDereferenceTrack: Function[] = []
        const dereferenceTypeCount: Record<string, number> = {}
        const referring = self.getReferring(trackConf)
        self.removeReferring(
          referring,
          trackConf,
          callbacksToDereferenceTrack,
          dereferenceTypeCount,
        )
        callbacksToDereferenceTrack.forEach(cb => cb())
        return getParent<any>(self).jbrowse.deleteTrackConf(trackConf)
      },

      /**
       * #action
       */
      addLinearGenomeViewOfAssembly(assemblyName: string, initialState = {}) {
        return this.addViewOfAssembly(
          'LinearGenomeView',
          assemblyName,
          initialState,
        )
      },

      /**
       * #action
       */
      addViewOfAssembly(
        viewType: any,
        assemblyName: string,
        initialState: any = {},
      ) {
        const asm = self.assemblies.find(
          s => readConfObject(s, 'name') === assemblyName,
        )
        if (!asm) {
          throw new Error(
            `Could not add view of assembly "${assemblyName}", assembly name not found`,
          )
        }
        return this.addView(viewType, {
          ...initialState,
          displayRegionsFromAssemblyName: readConfObject(asm, 'name'),
        })
      },

      /**
       * #action
       */
      addViewFromAnotherView(
        viewType: string,
        otherView: any,
        initialState: { displayedRegions?: Region[] } = {},
      ) {
        const state = { ...initialState }
        state.displayedRegions = getSnapshot(otherView.displayedRegions)
        return this.addView(viewType, state)
      },

      /**
       * #action
       * opens a configuration editor to configure the given thing,
       * and sets the current task to be configuring it
       * @param configuration -
       */
      editConfiguration(configuration: AnyConfigurationModel) {
        if (!isConfigurationModel(configuration)) {
          throw new Error(
            'must pass a configuration model to editConfiguration',
          )
        }
        const editor = self.addWidget(
          'ConfigurationEditorWidget',
          'configEditor',
          { target: configuration },
        )
        self.showWidget(editor)
      },

      /**
       * #action
       */
      editTrackConfiguration(configuration: AnyConfigurationModel) {
        this.editConfiguration(configuration)
      },

      /**
       * #action
       */
      addSavedSession(sessionSnapshot: SnapshotIn<typeof self>) {
        return getParent<any>(self).jbrowse.addSavedSession(sessionSnapshot)
      },

      /**
       * #action
       */
      removeSavedSession(sessionSnapshot: any) {
        return getParent<any>(self).jbrowse.removeSavedSession(sessionSnapshot)
      },

      /**
       * #action
       */
      renameCurrentSession(sessionName: string) {
        return getParent<any>(self).renameCurrentSession(sessionName)
      },

      /**
       * #action
       */
      duplicateCurrentSession() {
        return getParent<any>(self).duplicateCurrentSession()
      },

      /**
       * #action
       */
      activateSession(sessionName: any) {
        return getParent<any>(self).activateSession(sessionName)
      },

      /**
       * #action
       */
      setDefaultSession() {
        return getParent<any>(self).setDefaultSession()
      },

      /**
       * #action
       */
      setSession(sessionSnapshot: SnapshotIn<typeof self>) {
        return getParent<any>(self).setSession(sessionSnapshot)
      },
    }))

    .views(self => ({
      /**
       * #method
       */
      getTrackActionMenuItems(config: any) {
        const session = self
        const trackSnapshot = JSON.parse(JSON.stringify(getSnapshot(config)))
        return [
          {
            label: 'About track',
            onClick: () => {
              session.queueDialog(doneCallback => [
                AboutDialog,
                { config, handleClose: doneCallback },
              ])
            },
            icon: InfoIcon,
          },
          {
            label: 'Settings',
            onClick: () => session.editConfiguration(config),
            icon: SettingsIcon,
          },
          {
            label: 'Delete track',
            onClick: () => {
              session.deleteTrackConf(config)
            },
            icon: DeleteIcon,
          },
          {
            label: 'Copy track',
            onClick: () => {
              const now = Date.now()
              trackSnapshot.trackId += `-${now}`
              trackSnapshot.displays.forEach((d: { displayId: string }) => {
                d.displayId += `-${now}`
              })
              trackSnapshot.name += ' (copy)'
              trackSnapshot.category = undefined
              session.addTrackConf(trackSnapshot)
            },
            icon: CopyIcon,
          },
          {
            label: trackSnapshot.textSearching
              ? 'Re-index track'
              : 'Index track',
            disabled: !supportedIndexingAdapters(trackSnapshot.adapter.type),
            onClick: () => {
              const rootModel = getParent<any>(self)
              const { jobsManager } = rootModel
              const { trackId, assemblyNames, textSearching, name } =
                trackSnapshot
              const indexName = `${name}-index`
              // TODO: open jobs list widget
              jobsManager.queueJob({
                indexingParams: {
                  attributes: textSearching?.indexingAttributes || [
                    'Name',
                    'ID',
                  ],
                  exclude: textSearching?.indexingFeatureTypesToExclude || [
                    'CDS',
                    'exon',
                  ],
                  assemblies: assemblyNames,
                  tracks: [trackId],
                  indexType: 'perTrack',
                  timestamp: new Date().toISOString(),
                  name: indexName,
                },
                name: indexName,
                cancelCallback: () => jobsManager.abortJob(),
              })
            },
            icon: Indexing,
          },
        ]
      },
    }))

  const extendedSessionModel = pluginManager.evaluateExtensionPoint(
    'Core-extendSession',
    sessionModel,
  ) as typeof sessionModel

  return types.snapshotProcessor(addSnackbarToModel(extendedSessionModel), {
    // @ts-expect-error
    preProcessor(snapshot) {
      if (snapshot) {
        // @ts-expect-error
        const { connectionInstances, ...rest } = snapshot || {}
        // connectionInstances schema changed from object to an array, so any
        // old connectionInstances as object is in snapshot, filter it out
        // https://github.com/GMOD/jbrowse-components/issues/1903
        if (!Array.isArray(connectionInstances)) {
          return rest
        }
      }
      return snapshot
    },
  })
}

export type SessionStateModel = ReturnType<typeof sessionModelFactory>
