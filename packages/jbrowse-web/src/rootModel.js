import { types, getRoot, getType } from 'mobx-state-tree'
import { ConfigurationSchema } from './configuration'
import { isConfigurationModel } from './configuration/configurationSchema'

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

      /**
       * this is the globally "selected" object. can be anything.
       * code that wants to deal with this should examine it to see what
       * kind of thing it is.
       */
      selection: undefined,

      /**
       * this is the current "task" that is being performed in the UI.
       * this is usually an object of the form
       * { taskName: "configure", target: thing_being_configured }
       */
      task: undefined,
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

      addView(typeName, configuration, initialState = {}) {
        const typeDefinition = pluginManager.getElementType('view', typeName)
        if (!typeDefinition) throw new Error(`unknown view type ${typeName}`)

        const newView = typeDefinition.stateModel.create({
          ...initialState,
          type: typeName,
          configuration,
        })
        self.views.push(newView)
        return newView
      },

      removeView(view) {
        if (self.task && self.task.data === view) self.clearTask()
        self.views.remove(view)
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
        const data = { ...initialState, id, type: typeName, configuration }
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

      /**
       * set the global selection, i.e. the globally-selected object.
       * can be a feature, a view, just about anything
       * @param {object} thing
       */
      setSelection(thing) {
        self.selection = thing
        console.log('selected', thing)
      },

      /**
       * clears the global selection
       */
      clearSelection() {
        self.selection = undefined
        console.log('selection cleared')
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
        if (!self.drawerWidgets.get('configEditor'))
          self.addDrawerWidget(
            'ConfigurationEditorDrawerWidget',
            'configEditor',
            { target: configuration },
          )
        const editor = self.drawerWidgets.get('configEditor')
        editor.setTarget(configuration)
        self.setTask('configure', configuration)
        self.showDrawerWidget(editor)
      },

      /**
       * set the global "task" that is considered to be in progress.
       */
      setTask(taskName, data) {
        self.task = { taskName, data }
      },

      /**
       * clear the global task
       */
      clearTask() {
        self.task = undefined
        self.hideAllDrawerWidgets()
      },
    }))
  return RootModel
}

// a track is a combination of a dataset and a renderer, along with some conditions
// specifying in which contexts it is available (which assemblies, which views, etc)
