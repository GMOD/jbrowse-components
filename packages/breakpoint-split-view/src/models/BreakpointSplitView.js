export default pluginManager => {
  const { jbrequire } = pluginManager
  const { transaction } = jbrequire('mobx')
  const { types, getParent, getRoot, addDisposer, onAction } = jbrequire(
    'mobx-state-tree',
  )
  const { ElementId, Region } = jbrequire('@gmod/jbrowse-core/mst-types')
  const { ConfigurationSchema, readConfObject } = jbrequire(
    '@gmod/jbrowse-core/configuration',
  )
  const { clamp, getSession } = jbrequire('@gmod/jbrowse-core/util')

  const configSchema = ConfigurationSchema(
    'BreakpointSplitView',
    {},
    { explicitlyTyped: true },
  )

  const minHeight = 40
  const defaultHeight = 400
  const stateModel = types
    .model('BreakpointSplitView', {
      id: ElementId,
      type: types.literal('BreakpointSplitView'),
      offsetPx: 0,
      bpPerPx: 2000000,
      width: 800,
      headerHeight: 0,
      height: types.optional(
        types.refinement('viewHeight', types.number, n => n >= minHeight),
        defaultHeight,
      ),
      displayName: 'breakpoint detail',
      configuration: configSchema,
      trackSelectorType: 'hierarchical',

      topLGV: pluginManager.getViewType('LinearGenomeView').stateModel,
      bottomLGV: pluginManager.getViewType('LinearGenomeView').stateModel,
    })
    .views(self => ({
      get menuOptions() {
        return [
          // {
          //   title: 'Show track selector',
          //   key: 'track_selector',
          //   callback: self.activateTrackSelector,
          // },
          // {
          //   title: 'Horizontal flip',
          //   key: 'flip',
          //   callback: self.horizontallyFlip,
          // },
          // {
          //   title: 'Show all regions',
          //   key: 'showall',
          //   callback: self.showAllRegions,
          // },
          // {
          //   title: self.hideHeader ? 'Show header' : 'Hide header',
          //   key: 'hide_header',
          //   callback: self.toggleHeader,
          // },
        ]
      },
    }))
    .actions(self => ({
      afterAttach() {
        // add an onAction listener to listen to actions being taken on the sub-views
        // and dispatch our own actions to keep the views in sync
        addDisposer(
          self,
          onAction(self, ({ name, path, args }) => {
            if (name === 'horizontalScroll') {
              // console.log(path, args)
              self.onSubviewHorizontalScroll(path, args)
            } else if (name === 'zoomTo') {
              // console.log(path, args)
              self.onSubviewZoom(path, args)
            }
          }),
        )
      },

      // binds the horizontal scrolling of the two LGVs together
      onSubviewHorizontalScroll(path, args) {
        if (path === '/topLGV') {
          self.bottomLGV.horizontalScroll(args[0])
        } else if (path === '/bottomLGV') {
          self.topLGV.horizontalScroll(args[0])
        }
      },

      // binds the zooming of the two LGVs together
      onSubviewZoom(path, args) {
        if (path === '/topLGV') {
          self.bottomLGV.zoomTo(args[0])
        } else if (path === '/bottomLGV') {
          self.topLGV.zoomTo(args[0])
        }
      },

      setDisplayName(name) {
        self.displayName = name
        return self.displayName
      },

      setWidth(newWidth) {
        self.width = newWidth
        self.topLGV.setWidth(newWidth)
        self.bottomLGV.setWidth(newWidth)
        return self.width
      },
      setHeight(newHeight) {
        if (newHeight > minHeight) self.height = newHeight
        else self.height = minHeight
        return self.height
      },
      resizeHeight(distance) {
        const oldHeight = self.height
        const newHeight = self.setHeight(self.height + distance)
        return newHeight - oldHeight
      },

      //   setBpPerPx(newVal) {
      //     self.bpPerPx = clamp(newVal, self.minBpPerPx, self.maxBpPerPx)
      //   },

      closeView() {
        getParent(self, 2).removeView(self)
      },

      setHeaderHeight(height) {
        self.headerHeight = height
      },

      activateConfigurationUI() {
        getRoot(self).editConfiguration(self.configuration)
      },
    }))

  return { stateModel, configSchema }
}
