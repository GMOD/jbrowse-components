import {
  types,
  getRoot,
  applySnapshot,
  getType,
  getSnapshot,
} from 'mobx-state-tree'
import { ConfigurationSchema } from './configuration'

export default app => {
  const { pluginManager } = app
  const minViewsWidth = 150
  const minDrawerWidth = 100
  const RootModel = types
    .model('JBrowseWebRootModel', {
      drawerWidth: types.optional(
        types.integer,
        Math.round((window.innerWidth || 0) * 0.25),
      ),
      views: types.array(pluginManager.pluggableMstType('view', 'stateModel')),
      drawerWidgets: types.map(
        pluginManager.pluggableMstType('drawer widget', 'stateModel'),
      ),
      selectedDrawerWidget: types.maybe(
        types.reference(
          pluginManager.pluggableMstType('drawer widget', 'stateModel'),
        ),
      ),
      menuBars: types.array(
        pluginManager.pluggableMstType('menu bar', 'stateModel'),
      ),
      configuration: ConfigurationSchema(
        'JBrowseWebRoot',
        {
          // the view configuration is a map of view type name -> shared config for all views
          views: types.map(pluginManager.pluggableConfigSchemaType('view')),

          // track configuration is an array of track config schemas. multiple instances of
          // a track can exist that use the same configuration
          tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),
        },
        {
          actions: self => ({
            addTrackConf(typeName, data) {
              const type = getRoot(self).pluginManager.getTrackType(typeName)
              if (!type) throw new Error(`unknown track type ${typeName}`)
              const schemaType = type.configSchema
              const conf = schemaType.create(
                Object.assign({ type: typeName }, data),
              )
              self.tracks.push(conf)
              return conf
            },
          }),
        },
      ),
    })
    .volatile(() => ({
      app,
      pluginManager,
      windowWidth: window.innerWidth,
    }))
    .views(self => ({
      get viewsWidth() {
        return window.innerWidth - (self.drawerWidth + 7)
      },
    }))
    .actions(self => ({
      afterCreate() {
        if (self.drawerWidth < minDrawerWidth) self.drawerWidth = minDrawerWidth
        if (self.drawerWidth > self.windowWidth - (minViewsWidth + 7))
          self.drawerWidth = self.windowWidth - (minViewsWidth + 7)
      },

      configure(configSnapshot) {
        self.configuration = getType(self.configuration).create(configSnapshot)
      },

      updateWindowWidth() {
        const drawerRelativeWidth = self.drawerWidth / self.windowWidth
        self.windowWidth = window.innerWidth
        self.drawerWidth = Math.min(
          Math.max(
            Math.round(drawerRelativeWidth * self.windowWidth),
            minDrawerWidth,
          ),
          self.windowWidth - (minViewsWidth + 7),
        )
      },

      setDrawerWidth(drawerWidth) {
        if (drawerWidth >= minDrawerWidth) {
          if (self.windowWidth - drawerWidth - 7 >= minViewsWidth)
            self.drawerWidth = drawerWidth
        }
        return self.drawerWidth
      },

      resizeDrawer(distance) {
        const drawerWidthBefore = self.drawerWidth
        self.setDrawerWidth(self.drawerWidth - distance)
        return drawerWidthBefore - self.drawerWidth
      },

      addView(typeName, initialState = {}) {
        const typeDefinition = pluginManager.getElementType('view', typeName)
        if (!typeDefinition) throw new Error(`unknown view type ${typeName}`)
        let configuration = self.configuration.views.get(typeName)
        if (!configuration) {
          // make a configuration for this view type if we don't have one
          configuration = typeDefinition.configSchema.create({
            _configId: typeName,
            type: typeName,
          })
          self.configuration.views.put(configuration)
        }

        const data = Object.assign({}, initialState, {
          type: typeName,
          configuration: getSnapshot(configuration), // : configuration._configId,
        })
        const newView = typeDefinition.stateModel.create(data)
        self.views.push(newView)
        return newView
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
        const data = Object.assign({}, initialState, {
          id,
          type: typeName,
          configuration,
        })
        const model = typeDefinition.stateModel.create(data)
        self.drawerWidgets.set(model.id, model)
      },

      showDrawerWidget(id) {
        self.selectedDrawerWidget = id
      },

      hideAllDrawerWidgets() {
        self.selectedDrawerWidget = undefined
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
    }))
  return RootModel
}

// a track is a combination of a dataset and a renderer, along with some conditions
// specifying in which contexts it is available (which assemblies, which views, etc)
