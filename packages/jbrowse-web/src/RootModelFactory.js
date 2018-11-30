import { types, getRoot } from 'mobx-state-tree'
import { ConfigurationSchema } from './configuration'

export default app => {
  const { pluginManager } = app
  const minViewsWidth = 150
  const minDrawerWidth = 100
  const RootModel = types
    .model('JBrowseWebRootModel', {
      browser: types.frozen(this),
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
      configuration: ConfigurationSchema(
        'JBrowseWebRoot',
        {
          views: types.array(pluginManager.pluggableConfigSchemaType('view')),
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
    .volatile(self => ({
      app,
      pluginManager,
    }))
    .views(self => ({
      get viewsWidth() {
        return window.innerWidth - (self.drawerWidth + 7)
      },
    }))
    .volatile(() => ({
      windowWidth: window.innerWidth,
    }))
    .actions(self => ({
      afterCreate() {
        if (self.drawerWidth < minDrawerWidth) self.drawerWidth = minDrawerWidth
        if (self.drawerWidth > self.windowWidth - (minViewsWidth + 7))
          self.drawerWidth = self.windowWidth - (minViewsWidth + 7)
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
        this.setDrawerWidth(self.drawerWidth - distance)
        return drawerWidthBefore - self.drawerWidth
      },

      addView(typeName, initialState = {}, configuration = { type: typeName }) {
        const typeDefinition = pluginManager.getElementType('view', typeName)
        if (!typeDefinition) throw new Error(`unknown view type ${typeName}`)
        const data = Object.assign({}, initialState, {
          type: typeName,
          configuration,
        })
        self.views.push(typeDefinition.stateModel.create(data))
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
    }))
  return RootModel
}

// a track is a combination of a dataset and a renderer, along with some conditions
// specifying in which contexts it is available (which assemblies, which views, etc)
