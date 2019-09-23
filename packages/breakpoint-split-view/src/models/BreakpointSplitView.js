export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types, getParent, getRoot, addDisposer, onAction } = jbrequire(
    'mobx-state-tree',
  )
  const { ElementId } = jbrequire('@gmod/jbrowse-core/mst-types')
  const { ConfigurationSchema } = jbrequire('@gmod/jbrowse-core/configuration')
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
      headerHeight: 0,
      width: 800,
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
      get viewingRegionWidth() {
        return self.width - this.controlsWidth
      },
      get controlsWidth() {
        return self.topLGV.controlsWidth
      },

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

      get matchedTracks() {
        const t1 = self.topLGV.tracks.map(t => t.configuration.configId)
        const t2 = self.bottomLGV.tracks.map(t => t.configuration.configId)
        return t1.filter(t => t2.indexOf(t) !== -1)
      },

      getMatchedFeatures(trackConfigId) {
        const candidates = {}
        const matches = []
        if (!self.topLGV.tracks.length || !self.bottomLGV.tracks.length) {
          return {}
        }
        const t1 = self.topLGV.tracks.find(
          t => t.configuration.configId === trackConfigId,
        )
        const t2 = self.bottomLGV.tracks.find(
          t => t.configuration.configId === trackConfigId,
        )
        for (const f of t1.features.values()) {
          const n = f.get('name')
          if (!candidates[n]) {
            candidates[n] = []
          }
          candidates[n].push(f)
        }
        const alreadySeen = {}
        for (const f of t2.features.values()) {
          const name = f.get('name')
          const id = f.id()
          const c = candidates[name] || []
          for (let i = 0; i < c.length; i += 1) {
            const candidateId = c[i].id()
            if (candidateId !== id && !alreadySeen[`${id}-${candidateId}`]) {
              alreadySeen[`${id}-${candidateId}`] = true
              matches.push([name, c[i], f])
            }
          }
        }
        return matches
      },

      getLayoutMatches(trackConfigId) {
        const layoutMatches = []
        const t1 = self.topLGV.tracks.find(
          t => t.configuration.configId === trackConfigId,
        )
        const t2 = self.bottomLGV.tracks.find(
          t => t.configuration.configId === trackConfigId,
        )
        for (const [name, f1, f2] of self.getMatchedFeatures(trackConfigId)) {
          layoutMatches.push([
            name,
            t1.layoutFeatures.get(f1.id()),
            t2.layoutFeatures.get(f2.id()),
          ])
        }
        return layoutMatches
      },
    }))
    .actions(self => ({
      afterAttach() {
        // add an onAction listener to listen to actions being taken on the sub-views
        // and dispatch our own actions to keep the views in sync
        addDisposer(
          self,
          onAction(self, ({ name, path, args }) => {
            // if (name === 'horizontalScroll') {
            //   // console.log(path, args)
            //   self.onSubviewHorizontalScroll(path, args)
            // } else if (name === 'zoomTo') {
            //   // console.log(path, args)
            //   self.onSubviewZoom(path, args)
            // }
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

      setHeight(newHeight) {
        if (newHeight > minHeight) self.height = newHeight
        else self.height = minHeight
        return self.height
      },

      setWidth(newWidth) {
        self.width = newWidth
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
