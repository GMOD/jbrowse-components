// Polyfill for TextDecoder
import 'fast-text-encoding'
import { flow, getRoot, getType, types } from 'mobx-state-tree'
import { ConfigurationSchema } from './configuration'
import { isConfigurationModel } from './configuration/configurationSchema'
import { openLocation } from './util/io'
import DivSequenceRendererConfigurationSchema from './plugins/DivSequenceRenderer/configSchema'

function assemblyAdapterConfigSchemaFactory(pluginManager) {
  return ConfigurationSchema(
    'FromFile',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      rendering: DivSequenceRendererConfigurationSchema,
    },
    { explicitlyTyped: true },
  )
}

const SizesConfigSchema = ConfigurationSchema(
  'FromSizes',
  {
    sizes: {
      type: 'numberMap',
      defaultValue: {},
      description: 'Names and sizes of sequences',
    },
  },
  { explicitlyTyped: true },
)

export function assemblyFactory(pluginManager) {
  return ConfigurationSchema('Assembly', {
    sequence: types.union(
      assemblyAdapterConfigSchemaFactory(pluginManager),
      SizesConfigSchema,
    ),
    aliases: {
      type: 'stringArray',
      defaultValue: [],
      description: 'Other possible names for this assembly',
    },
    seqNameAliases: {
      type: 'stringArrayMap',
      defaultValue: {},
      description:
        'Any sequence names for this assembly which may have alternate names, such as ctgA/contigA or 1/chr1',
    },
  })
}

export default (pluginManager, workerManager) => {
  const minWidth = 384
  const minDrawerWidth = 128
  return types
    .model('JBrowseWebRootModel', {
      sessionName: types.optional(types.string, 'UnnamedSession'),
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

          // A map of assembly name -> assembly details
          assemblies: types.map(assemblyFactory(pluginManager)),
          defaultSession: {
            type: 'frozen',
            defaultValue: null,
            description: 'Snapshot representing a default session',
          },
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
            addAssembly(assemblyName, aliases = [], seqNameAliases = {}) {
              self.assemblies.set(
                assemblyName,
                assemblyFactory(pluginManager).create({
                  configId: assemblyName,
                  aliases,
                  seqNameAliases,
                }),
              )
            },
            removeAssembly(assemblyName) {
              self.assemblies.delete(assemblyName)
            },
          }),
        },
      ),
    })
    .volatile(() => ({
      pluginManager,
      workerManager,
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
        // TODO: when drawer is permanent, subtract its width
        return self.width
      },
      get maxDrawerWidth() {
        return self.width - 256
      },
    }))
    .actions(self => ({
      configure(configSnapshot) {
        self.configuration = getType(self.configuration).create(configSnapshot)
      },

      loadConfig: flow(function* loadConfig(configLocation) {
        let configSnapshot
        try {
          configSnapshot = JSON.parse(
            new TextDecoder('utf-8').decode(
              yield openLocation(configLocation).readFile(),
            ),
          )
          self.configure(configSnapshot)
        } catch (error) {
          console.error('Failed to load config ', error)
          throw error
        }
        return configSnapshot
      }),

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
        self.showDrawerWidget(editor)
      },
    }))
}

// a track is a combination of a dataset and a renderer, along with some conditions
// specifying in which contexts it is available (which assemblies, which views, etc)
