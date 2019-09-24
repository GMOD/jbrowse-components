export default pluginManager => {
  const { jbrequire } = pluginManager

  const { types, getRoot } = jbrequire('mobx-state-tree')

  const { makeAbortableReaction } = jbrequire(require('./util'))

  const { getTrackAssemblyName } = jbrequire('@gmod/jbrowse-core/util/tracks')
  const { getConf } = jbrequire('@gmod/jbrowse-core/configuration')

  const model = types
    .model('RefNameMap', {})
    .volatile((/* self */) => ({
      refNameMap: undefined,
    }))
    .actions(self => ({
      afterAttach() {
        makeAbortableReaction(
          self,
          'loadAssemblyRefNameMap',
          () => ({
            assemblyName: getTrackAssemblyName(self),
          }),
          ({ assemblyName }, signal) => {
            return getRoot(self).jbrowse.getRefNameMapForAdapter(
              getConf(self, 'adapter'),
              assemblyName,
              { signal },
            )
          },
          {
            fireImmediately: true,
            delay: 300,
          },
        )
      },

      loadAssemblyRefNameMapSuccess(result) {
        // console.log('loaded refname map', result)
        self.refNameMap = result
      },
      loadAssemblyRefNameMapError(error) {
        console.error(error)
      },
    }))

  return model
}
