export default pluginManager => {
  const { jbrequire } = pluginManager

  const { types, getRoot } = jbrequire('mobx-state-tree')

  const { makeAbortableReaction } = jbrequire(require('./util'))

  const { readConfObject } = jbrequire('@gmod/jbrowse-core/configuration')

  const { getContainingAssembly } = jbrequire('@gmod/jbrowse-core/util/tracks')
  const { getConf } = jbrequire('@gmod/jbrowse-core/configuration')

  const model = types
    .model('RefNameMap', {})
    .volatile(self => ({
      refNameMap: undefined,
    }))
    .actions(self => ({
      afterAttach() {
        makeAbortableReaction(
          self,
          'loadAssemblyRefNameMap',
          () => ({
            root: getRoot(self),
            assemblyName: readConfObject(
              getContainingAssembly(self.configuration),
              'assemblyName',
            ),
          }),
          ({ root, assemblyName }, signal) => {
            return root.assemblyManager.getRefNameMapForAdapter(
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

      loadAssemblyRefNameMapStarted() {},
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
