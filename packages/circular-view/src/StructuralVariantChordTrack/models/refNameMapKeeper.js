export default pluginManager => {
  const { jbrequire } = pluginManager

  const { types, getRoot } = jbrequire('mobx-state-tree')

  const { makeAbortableReaction } = jbrequire(require('./util'))

  const { getTrackAssemblyName, getContainingView } = jbrequire(
    '@gmod/jbrowse-core/util/tracks',
  )
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
            adapter: getConf(self, 'adapter'),
          }),
          ({ assemblyName, adapter }, signal) => {
            return getRoot(self).jbrowse.getRefNameMapForAdapter(
              adapter,
              assemblyName,
              {
                signal,
              },
            )
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
        console.error(error)
      },
    }))

  return model
}
