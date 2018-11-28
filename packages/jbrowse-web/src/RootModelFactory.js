import { types, getRoot } from 'mobx-state-tree'
import { ConfigurationSchema } from './configuration'

const isPresent = thing => !!thing

function extractAll(fieldName, typesList) {
  return typesList.map(definition => definition[fieldName]).filter(isPresent)
}

export default function(pluginManager) {
  // const viewConfigTypes = Object.fromEntries(
  //   Object.entries(viewTypes).map(([typeName,typeObject]) => [typeName, typeObject.]
  //   })
  // Object.entries(viewTypes).forEach(([typeName,typeObject]) => {
  //   viewConfigTypes
  // })
  // TODO: get all config schemas from the view types and make an object of them
  const viewConfigTypes = {}

  const minViewsWidth = 150
  const minDrawerWidth = 100
  const RootModel = types
    .model('JBrowseWebRootModel', {
      browser: types.frozen(this),
      drawerWidth: types.optional(
        types.integer,
        Math.round(window.innerWidth * 0.25),
      ),
      views: types.array(
        types.union(
          ...extractAll(
            'stateModel',
            pluginManager.getElementTypesInGroup('view'),
          ),
        ),
      ),
      drawerWidgets: types.map(
        types.union(
          ...extractAll(
            'stateModel',
            pluginManager.getElementTypesInGroup('drawer widget'),
          ),
        ),
      ),
      selectedDrawerWidget: types.maybe(
        types.reference(
          types.union(
            ...extractAll(
              'stateModel',
              pluginManager.getElementTypesInGroup('drawer widget'),
            ),
          ),
        ),
      ),
      configuration: ConfigurationSchema(
        'JBrowseWebRoot',
        {
          views: types.array(
            types.union(
              ...extractAll(
                'configSchema',
                pluginManager.getElementTypesInGroup('view'),
              ),
            ),
          ),
          tracks: types.array(
            types.union(
              ...extractAll(
                'configSchema',
                pluginManager.getElementTypesInGroup('track'),
              ),
            ),
          ),
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
      pluginManager,
    }))
    .views(self => ({
      get viewsWidth() {
        return window.innerWidth - (self.drawerWidth + 7)
      },
    }))
    .actions(self => {
      let windowWidth = window.innerWidth

      function afterCreate() {
        if (self.drawerWidth < minDrawerWidth) self.drawerWidth = minDrawerWidth
        if (self.drawerWidth > windowWidth - (minViewsWidth + 7))
          self.drawerWidth = windowWidth - (minViewsWidth + 7)
      }

      function updateWindowWidth() {
        const drawerRelativeWidth = self.drawerWidth / windowWidth
        windowWidth = window.innerWidth
        self.drawerWidth = Math.min(
          Math.max(
            Math.round(drawerRelativeWidth * windowWidth),
            minDrawerWidth,
          ),
          windowWidth - (minViewsWidth + 7),
        )
      }

      function setDrawerWidth(drawerWidth) {
        if (drawerWidth >= minDrawerWidth) {
          if (windowWidth - drawerWidth - 7 >= minViewsWidth)
            self.drawerWidth = drawerWidth
        }
        return self.drawerWidth
      }

      function resizeDrawer(distance) {
        const drawerWidthBefore = self.drawerWidth
        this.setDrawerWidth(self.drawerWidth - distance)
        return drawerWidthBefore - self.drawerWidth
      }

      function addView(
        typeName,
        initialState = {},
        configuration = { type: typeName },
      ) {
        const typeDefinition = pluginManager.getElementType('view', typeName)
        if (!typeDefinition) throw new Error(`unknown view type ${typeName}`)
        const data = Object.assign({}, initialState, {
          type: typeName,
          configuration,
        })
        self.views.push(typeDefinition.stateModel.create(data))
      }

      function addDrawerWidget(
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
        self.drawerWidgets.set(id, typeDefinition.stateModel.create(data))
      }

      function showDrawerWidget(id) {
        self.selectedDrawerWidget = id
      }

      function hideAllDrawerWidgets() {
        self.selectedDrawerWidget = undefined
      }

      return {
        afterCreate,
        updateWindowWidth,
        setDrawerWidth,
        resizeDrawer,
        addView,
        addDrawerWidget,
        showDrawerWidget,
        hideAllDrawerWidgets,
      }
    })
  return RootModel
}

// a track is a combination of a dataset and a renderer, along with some conditions
// specifying in which contexts it is available (which assemblies, which views, etc)
