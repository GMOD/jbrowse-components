export default pluginManager => {
  const { jbrequire } = pluginManager

  const { types } = jbrequire('mobx-state-tree')

  const { makeAbortableReaction } = jbrequire(require('./util'))

  const { getSession } = jbrequire('@gmod/jbrowse-core/util')
  const { getTrackAssemblyNames } = jbrequire('@gmod/jbrowse-core/util/tracks')
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
            // TODO: Figure this out for multiple assembly names
            assemblyName: getTrackAssemblyNames(self)[0],
            adapter: getConf(self, 'adapter'),
          }),
          ({ assemblyName, adapter }, signal) => {
            return getSession(self)
              .assemblyManager.get(assemblyName)
              .getRefNameMapForAdapter(adapter, { signal })
          },
          {
            fireImmediately: true,
            delay: 300,
            name: 'refNameMapKeeper ref name fetching',
          },
        )
      },

      loadAssemblyRefNameMapStarted() {},
      loadAssemblyRefNameMapSuccess(result) {
        // console.log('loaded refname map', result)
        self.refNameMap = result
      },
      loadAssemblyRefNameMapError(error) {
        self.error = error
        console.error(error)
      },
    }))

  return model
}
