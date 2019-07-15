import { autorun } from 'mobx'
import {
  types,
  flow,
  getParent,
  getRoot,
  addDisposer,
  isAlive,
} from 'mobx-state-tree'

import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { isConfigurationModel } from '@gmod/jbrowse-core/configuration/configurationSchema'

export default pluginManager => {
  const minWidth = 384
  const minDrawerWidth = 128
  return types
    .model('JBrowseWebSessionModel', {
      name: types.identifier,
      width: types.optional(
        types.refinement(types.integer, width => width >= minWidth),
        512,
      ),
      drawerWidth: types.optional(
        types.refinement(types.integer, width => width >= minDrawerWidth),
        384,
      ),
      views: types.array(pluginManager.pluggableMstType('view', 'stateModel')),
      drawerWidgets: types.map(
        pluginManager.pluggableMstType('drawer widget', 'stateModel'),
      ),
      activeDrawerWidgets: types.map(
        types.safeReference(
          pluginManager.pluggableMstType('drawer widget', 'stateModel'),
        ),
      ),
      menuBars: types.array(
        pluginManager.pluggableMstType('menu bar', 'stateModel'),
      ),
      connections: types.map(
        types.array(pluginManager.pluggableMstType('connection', 'stateModel')),
      ),
    })
    .volatile(self => {
      const { rpcManager, assemblyData, configuration, species } = getRoot(self)
      /**
       * this is the globally "selected" object. can be anything.
       * code that wants to deal with this should examine it to see what
       * kind of thing it is.
       */
      const selection = undefined
      /**
       * this is the current "task" that is being performed in the UI.
       * this is usually an object of the form
       * { taskName: "configure", target: thing_being_configured }
       */
      const task = undefined
      return {
        pluginManager,
        rpcManager,
        assemblyData,
        configuration,
        species,
        selection,
        task,
      }
    })
    .views(self => ({
      get viewsWidth() {
        // TODO: when drawer is permanent, subtract its width
        return self.width - (self.visibleDrawerWidget ? self.drawerWidth : 0)
      },
      get maxDrawerWidth() {
        return self.width - 256
      },

      get visibleDrawerWidget() {
        if (isAlive(self)) return self.activeDrawerWidgets.values().next().value
        return undefined
      },
    }))
    .actions(self => ({
      afterCreate() {
        const disposer = autorun(() => {
          self.views.forEach(view => {
            view.setWidth(self.viewsWidth)
          })
        })
        addDisposer(self, disposer)

        const displayedRegionsDisposer = autorun(async () => {
          for (const view of self.views) {
            const assemblyName = view.displayRegionsFromAssemblyName
            if (assemblyName && self.assemblyData.get(assemblyName).sequence) {
              // eslint-disable-next-line no-await-in-loop
              const displayedRegions = await self.getRegionsForAssembly(
                assemblyName,
                self.assemblyData,
              )
              view.setDisplayedRegions(displayedRegions, true)
            }
          }
        })
        addDisposer(self, displayedRegionsDisposer)
      },

      getRegionsForAssembly: flow(function* getRegionsForAssembly(
        assemblyName,
        assemblyData,
        opts = {},
      ) {
        const assembly = assemblyData.get(assemblyName)
        if (assembly) {
          const adapterConfig = readConfObject(assembly.sequence, 'adapter')
          // eslint-disable-next-line no-await-in-loop
          const adapterRegions = yield self.rpcManager.call(
            assembly.configId,
            'getRegions',
            {
              sessionId: assemblyName,
              adapterType: adapterConfig.type,
              adapterConfig,
              signal: opts.signal,
            },
            { timeout: 1000000 },
          )
          const adapterRegionsWithAssembly = adapterRegions.map(
            adapterRegion => ({
              ...adapterRegion,
              assemblyName,
            }),
          )
          return adapterRegionsWithAssembly
        }
        return undefined
      }),

      makeConnection(configuration, initialSnapshot = {}) {
        const { type } = configuration
        if (!type) throw new Error('track configuration has no `type` listed')
        const name = readConfObject(configuration, 'name')
        const connectionType = pluginManager.getConnectionType(type)
        if (!connectionType) throw new Error(`unknown connection type ${type}`)
        let confParent = configuration
        do {
          confParent = getParent(confParent)
        } while (!confParent.assembly)
        const assemblyName = readConfObject(confParent.assembly, 'name')
        const connectionData = { ...initialSnapshot, name, type, configuration }
        if (!self.connections.has(assemblyName))
          self.connections.set(assemblyName, [])
        const assemblyConnections = self.connections.get(assemblyName)
        const length = assemblyConnections.push(connectionData)
        return assemblyConnections[length - 1]
      },

      breakConnection(configuration) {
        const name = readConfObject(configuration, 'name')
        let confParent = configuration
        do {
          confParent = getParent(confParent)
        } while (!confParent.assembly)
        const assemblyName = readConfObject(confParent.assembly, 'name')
        const connection = self.connections
          .get(assemblyName)
          .find(c => c.name === name)
        self.connections.get(assemblyName).remove(connection)
      },

      updateWidth(width) {
        let newWidth = Math.floor(width)
        if (newWidth === self.width) return
        if (newWidth < minWidth) newWidth = minWidth
        self.width = newWidth
        if (self.drawerWidth > self.maxDrawerWidth)
          self.drawerWidth = self.maxDrawerWidth
      },

      updateDrawerWidth(drawerWidth) {
        if (drawerWidth === self.drawerWidth) return self.drawerWidth
        let newDrawerWidth = drawerWidth
        if (newDrawerWidth < minDrawerWidth) newDrawerWidth = minDrawerWidth
        if (newDrawerWidth > self.maxDrawerWidth)
          newDrawerWidth = self.maxDrawerWidth
        self.drawerWidth = newDrawerWidth
        return newDrawerWidth
      },

      resizeDrawer(distance) {
        const oldDrawerWidth = self.drawerWidth
        const newDrawerWidth = self.updateDrawerWidth(oldDrawerWidth - distance)
        const actualDistance = oldDrawerWidth - newDrawerWidth
        return actualDistance
      },

      addView(typeName, configuration, initialState = {}) {
        const typeDefinition = pluginManager.getElementType('view', typeName)
        if (!typeDefinition) throw new Error(`unknown view type ${typeName}`)

        const newView = typeDefinition.stateModel.create({
          ...initialState,
          type: typeName,
          configuration,
        })
        self.views.push(newView)
        self.updateAssemblies()
        return newView
      },

      removeView(view) {
        for (const [id, drawerWidget] of self.activeDrawerWidgets) {
          if (
            id === 'configEditor' &&
            drawerWidget.target.configId === view.configuration.configId
          )
            self.hideDrawerWidget(drawerWidget)
          else if (
            id === 'hierarchicalTrackSelector' &&
            drawerWidget.view.id === view.id
          )
            self.hideDrawerWidget(drawerWidget)
        }
        self.views.remove(view)
      },

      addLinearGenomeViewOfAssembly(
        assemblyName,
        configuration,
        initialState = {},
      ) {
        configuration.displayRegionsFromAssemblyName = assemblyName
        return self.addView('LinearGenomeView', configuration, initialState)
      },

      addDrawerWidget(
        typeName,
        id,
        initialState = {},
        configuration = { type: typeName },
      ) {
        const typeDefinition = pluginManager.getElementType(
          'drawer widget',
          typeName,
        )
        if (!typeDefinition)
          throw new Error(`unknown drawer widget type ${typeName}`)
        const drawerWidgetSessionId = `${id}-${self.name}`
        const data = {
          ...initialState,
          id: drawerWidgetSessionId,
          type: typeName,
          configuration,
        }
        self.drawerWidgets.set(drawerWidgetSessionId, data)
        return self.drawerWidgets.get(drawerWidgetSessionId)
      },

      showDrawerWidget(drawerWidget) {
        if (self.activeDrawerWidgets.has(drawerWidget.id))
          self.activeDrawerWidgets.delete(drawerWidget.id)
        self.activeDrawerWidgets.set(drawerWidget.id, drawerWidget)
      },

      hideDrawerWidget(drawerWidget) {
        self.activeDrawerWidgets.delete(drawerWidget.id)
      },

      hideAllDrawerWidgets() {
        self.activeDrawerWidgets.clear()
      },

      addMenuBar(
        typeName,
        initialState = {},
        configuration = { type: typeName },
      ) {
        const typeDefinition = pluginManager.getElementType(
          'menu bar',
          typeName,
        )
        if (!typeDefinition)
          throw new Error(`unknown menu bar type ${typeName}`)
        const data = Object.assign({}, initialState, {
          type: typeName,
          configuration,
        })
        const model = typeDefinition.stateModel.create(data)
        self.menuBars.push(model)
      },

      /**
       * set the global selection, i.e. the globally-selected object.
       * can be a feature, a view, just about anything
       * @param {object} thing
       */
      setSelection(thing) {
        self.selection = thing
        // console.log('selected', thing)
      },

      /**
       * clears the global selection
       */
      clearSelection() {
        self.selection = undefined
        // console.log('selection cleared')
      },

      /**
       * opens a configuration editor to configure the given thing,
       * and sets the current task to be configuring it
       * @param {*} configuration
       */
      editConfiguration(configuration) {
        if (!isConfigurationModel(configuration)) {
          throw new Error(
            'must pass a configuration model to editConfiguration',
          )
        }
        const editor = self.addDrawerWidget(
          'ConfigurationEditorDrawerWidget',
          'configEditor',
          { target: configuration },
        )
        self.showDrawerWidget(editor)
      },

      clearConnections() {
        self.connections.clear()
        self.updateAssemblies()
      },
    }))
}

// a track is a combination of a dataset and a renderer, along with some conditions
// specifying in which contexts it is available (which assemblies, which views, etc)
