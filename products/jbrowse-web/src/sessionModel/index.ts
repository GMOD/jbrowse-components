/* eslint-disable @typescript-eslint/no-explicit-any */
import { lazy } from 'react'
import clone from 'clone'
import { createJBrowseTheme, defaultThemes } from '@jbrowse/core/ui/theme'
import { PluginDefinition } from '@jbrowse/core/PluginLoader'
import {
  readConfObject,
  getConf,
  isConfigurationModel,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import {
  Region,
  AbstractSessionModel,
  JBrowsePlugin,
  DialogComponentType,
} from '@jbrowse/core/util/types'
import addSnackbarToModel from '@jbrowse/core/ui/SnackbarModel'
import { ThemeOptions } from '@mui/material'
import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import { autorun, observable } from 'mobx'
import {
  addDisposer,
  cast,
  getParent,
  getRoot,
  getSnapshot,
  types,
  Instance,
  SnapshotIn,
  SnapshotOut,
} from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'

import { Session as CoreSession } from '@jbrowse/product-core'

// icons
import SettingsIcon from '@mui/icons-material/Settings'
import CopyIcon from '@mui/icons-material/FileCopy'
import DeleteIcon from '@mui/icons-material/Delete'
import InfoIcon from '@mui/icons-material/Info'

import { BaseSession } from './Base'
import Assemblies from './Assemblies'
import SessionConnections from './SessionConnections'

const AboutDialog = lazy(() => import('@jbrowse/core/ui/AboutDialog'))

export declare interface ReactProps {
  [key: string]: any
}

type AnyConfiguration =
  | AnyConfigurationModel
  | SnapshotOut<AnyConfigurationModel>

type ThemeMap = { [key: string]: ThemeOptions }

/**
 * #stateModel JBrowseWebSessionModel
 * inherits SnackbarModel
 */
export default function sessionModelFactory(
  pluginManager: PluginManager,
  assemblyConfigSchemasType = types.frozen(),
) {
  const sessionModel = types
    .compose(
      BaseSession(pluginManager),
      CoreSession.ReferenceManagement(pluginManager),
      CoreSession.DrawerWidgets(pluginManager),
      Assemblies(pluginManager, assemblyConfigSchemasType),
      SessionConnections(pluginManager),
    )
    .named('JBrowseWebSessionModel')
    .volatile((/* self */) => ({
      /**
       * #volatile
       */
      sessionThemeName: localStorageGetItem('themeName') || 'default',
      /**
       * #volatile
       * this is the globally "selected" object. can be anything.
       * code that wants to deal with this should examine it to see what
       * kind of thing it is.
       */
      selection: undefined,
      /**
       * #volatile
       * this is the current "task" that is being performed in the UI.
       * this is usually an object of the form
       * `{ taskName: "configure", target: thing_being_configured }`
       */
      task: undefined,
      /**
       * #volatile
       */
      queueOfDialogs: observable.array(
        [] as [DialogComponentType, ReactProps][],
      ),
    }))
    .views(self => ({
      /**
       * #getter
       */
      get jbrowse() {
        return getParent<any>(self).jbrowse
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      allThemes(): ThemeMap {
        const extraThemes = getConf(self.jbrowse, 'extraThemes')
        return { ...defaultThemes, ...extraThemes }
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get themeName() {
        const { sessionThemeName } = self
        const all = self.allThemes()
        return all[sessionThemeName] ? sessionThemeName : 'default'
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get theme() {
        const configTheme = getConf(self.jbrowse, 'theme')
        const all = self.allThemes()
        return createJBrowseTheme(configTheme, all, self.themeName)
      },

      /**
       * #getter
       */
      get DialogComponent() {
        if (self.queueOfDialogs.length) {
          const firstInQueue = self.queueOfDialogs[0]
          return firstInQueue && firstInQueue[0]
        }
        return undefined
      },
      /**
       * #getter
       */
      get DialogProps() {
        if (self.queueOfDialogs.length) {
          const firstInQueue = self.queueOfDialogs[0]
          return firstInQueue && firstInQueue[1]
        }
        return undefined
      },
      /**
       * #getter
       */
      get shareURL() {
        return getConf(self.jbrowse, 'shareURL')
      },
      /**
       * #getter
       */
      get rpcManager() {
        return self.jbrowse.rpcManager as RpcManager
      },

      /**
       * #getter
       */
      get configuration(): AnyConfigurationModel {
        return self.jbrowse.configuration
      },
      /**
       * #getter
       */
      get assemblies(): AnyConfigurationModel[] {
        return self.jbrowse.assemblies
      },
      /**
       * #getter
       */
      get assemblyNames(): string[] {
        const { assemblyNames } = getParent<any>(self).jbrowse
        const sessionAssemblyNames = self.sessionAssemblies.map(assembly =>
          readConfObject(assembly, 'name'),
        )
        return [...assemblyNames, ...sessionAssemblyNames]
      },
      /**
       * #getter
       */
      get tracks(): AnyConfigurationModel[] {
        return [...self.sessionTracks, ...getParent<any>(self).jbrowse.tracks]
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
      get savedSessions() {
        return getParent<any>(self).savedSessions
      },
      /**
       * #getter
       */
      get previousAutosaveId() {
        return getParent<any>(self).previousAutosaveId
      },
      /**
       * #getter
       */
      get savedSessionNames() {
        return getParent<any>(self).savedSessionNames
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
        return {
          theme: this.theme,
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setThemeName(name: string) {
        self.sessionThemeName = name
      },
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
      queueDialog(
        callback: (
          doneCallback: () => void,
        ) => [DialogComponentType, ReactProps],
      ) {
        const [component, props] = callback(() => self.queueOfDialogs.shift())
        self.queueOfDialogs.push([component, props])
      },
      /**
       * #action
       */
      setName(str: string) {
        self.name = str
      },

      /**
       * #action
       */
      addAssembly(conf: AnyConfiguration) {
        const asm = self.sessionAssemblies.find(f => f.name === conf.name)
        if (asm) {
          console.warn(`Assembly ${conf.name} was already existing`)
          return asm
        }
        const length = self.sessionAssemblies.push(conf)
        return self.sessionAssemblies[length - 1]
      },

      /**
       * #action
       * used for read vs ref type assemblies.
       */
      addTemporaryAssembly(conf: AnyConfiguration) {
        const asm = self.sessionAssemblies.find(f => f.name === conf.name)
        if (asm) {
          console.warn(`Assembly ${conf.name} was already existing`)
          return asm
        }
        const length = self.temporaryAssemblies.push(conf)
        return self.temporaryAssemblies[length - 1]
      },
      /**
       * #action
       */
      addSessionPlugin(plugin: JBrowsePlugin) {
        if (self.sessionPlugins.some(p => p.name === plugin.name)) {
          throw new Error('session plugin cannot be installed twice')
        }
        self.sessionPlugins.push(plugin)
        getRoot<any>(self).setPluginsUpdated(true)
      },
      /**
       * #action
       */
      removeAssembly(assemblyName: string) {
        const index = self.sessionAssemblies.findIndex(
          asm => asm.name === assemblyName,
        )
        if (index !== -1) {
          self.sessionAssemblies.splice(index, 1)
        }
      },
      /**
       * #action
       */
      removeTemporaryAssembly(assemblyName: string) {
        const index = self.temporaryAssemblies.findIndex(
          asm => asm.name === assemblyName,
        )
        if (index !== -1) {
          self.temporaryAssemblies.splice(index, 1)
        }
      },
      /**
       * #action
       */
      removeSessionPlugin(pluginDefinition: PluginDefinition) {
        self.sessionPlugins = cast(
          self.sessionPlugins.filter(
            plugin =>
              plugin.url !== pluginDefinition.url ||
              plugin.umdUrl !== pluginDefinition.umdUrl ||
              plugin.cjsUrl !== pluginDefinition.cjsUrl ||
              plugin.esmUrl !== pluginDefinition.esmUrl,
          ),
        )
        const rootModel = getParent<any>(self)
        rootModel.setPluginsUpdated(true)
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
      addAssemblyConf(assemblyConf: AnyConfiguration) {
        return getParent<any>(self).jbrowse.addAssemblyConf(assemblyConf)
      },

      /**
       * #action
       */
      addTrackConf(trackConf: AnyConfiguration) {
        if (self.adminMode) {
          return getParent<any>(self).jbrowse.addTrackConf(trackConf)
        }
        const { trackId, type } = trackConf as { type: string; trackId: string }
        if (!type) {
          throw new Error(`unknown track type ${type}`)
        }
        const track = self.sessionTracks.find((t: any) => t.trackId === trackId)
        if (track) {
          return track
        }
        const length = self.sessionTracks.push(trackConf)
        return self.sessionTracks[length - 1]
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
        if (self.adminMode) {
          return getParent<any>(self).jbrowse.deleteTrackConf(trackConf)
        }
        const { trackId } = trackConf
        const idx = self.sessionTracks.findIndex(t => t.trackId === trackId)
        if (idx === -1) {
          return undefined
        }
        return self.sessionTracks.splice(idx, 1)
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
        const assembly = self.assemblies.find(
          s => readConfObject(s, 'name') === assemblyName,
        )
        if (!assembly) {
          throw new Error(
            `Could not add view of assembly "${assemblyName}", assembly name not found`,
          )
        }
        initialState.displayRegionsFromAssemblyName = readConfObject(
          assembly,
          'name',
        )
        return this.addView(viewType, initialState)
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
       * set the global selection, i.e. the globally-selected object.
       * can be a feature, a view, just about anything
       * @param thing -
       */
      setSelection(thing: any) {
        self.selection = thing
      },

      /**
       * #action
       * clears the global selection
       */
      clearSelection() {
        self.selection = undefined
      },

      /**
       * #action
       */
      addSavedSession(sessionSnapshot: SnapshotIn<typeof self>) {
        return getParent<any>(self).addSavedSession(sessionSnapshot)
      },

      /**
       * #action
       */
      removeSavedSession(sessionSnapshot: any) {
        return getParent<any>(self).removeSavedSession(sessionSnapshot)
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
      saveSessionToLocalStorage() {
        return getParent<any>(self).saveSessionToLocalStorage()
      },

      /**
       * #action
       */
      loadAutosaveSession() {
        return getParent<any>(self).loadAutosaveSession()
      },

      /**
       * #action
       */
      setSession(sessionSnapshot: SnapshotIn<typeof self>) {
        return getParent<any>(self).setSession(sessionSnapshot)
      },
    }))

    .actions(self => ({
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
        const editableConfigSession = self
        const editor = editableConfigSession.addWidget(
          'ConfigurationEditorWidget',
          'configEditor',
          { target: configuration },
        )
        editableConfigSession.showWidget(editor)
      },

      /**
       * #action
       */
      editTrackConfiguration(configuration: AnyConfigurationModel) {
        const { adminMode, sessionTracks } = self
        if (!adminMode && !sessionTracks.includes(configuration)) {
          throw new Error("Can't edit the configuration of a non-session track")
        }
        this.editConfiguration(configuration)
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      getTrackActionMenuItems(config: AnyConfigurationModel) {
        const { adminMode, sessionTracks } = self
        const canEdit =
          adminMode || sessionTracks.find(t => t.trackId === config.trackId)

        // disable if it is a reference sequence track
        const isRefSeq =
          readConfObject(config, 'type') === 'ReferenceSequenceTrack'
        return [
          {
            label: 'About track',
            onClick: () => {
              self.queueDialog(handleClose => [
                AboutDialog,
                { config, handleClose },
              ])
            },
            icon: InfoIcon,
          },
          {
            label: 'Settings',
            disabled: !canEdit,
            onClick: () => self.editTrackConfiguration(config),
            icon: SettingsIcon,
          },
          {
            label: 'Delete track',
            disabled: !canEdit || isRefSeq,
            onClick: () => self.deleteTrackConf(config),
            icon: DeleteIcon,
          },
          {
            label: 'Copy track',
            disabled: isRefSeq,
            onClick: () => {
              const snap = clone(getSnapshot(config)) as any
              const now = Date.now()
              snap.trackId += `-${now}`
              snap.displays.forEach((display: { displayId: string }) => {
                display.displayId += `-${now}`
              })
              // the -sessionTrack suffix to trackId is used as metadata for
              // the track selector to store the track in a special category,
              // and default category is also cleared
              if (!self.adminMode) {
                snap.trackId += '-sessionTrack'
                snap.category = undefined
              }
              snap.name += ' (copy)'
              self.addTrackConf(snap)
            },
            icon: CopyIcon,
          },
        ]
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            localStorageSetItem('drawerPosition', self.drawerPosition)
            localStorageSetItem('themeName', self.themeName)
          }),
        )
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
export type SessionModel = Instance<SessionStateModel>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function z(x: Instance<SessionStateModel>): AbstractSessionModel {
  // this function's sole purpose is to get typescript to check
  // that the session model implements all of AbstractSessionModel
  return x
}
