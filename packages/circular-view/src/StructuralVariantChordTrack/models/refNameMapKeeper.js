export default pluginManager => {
  const { jbrequire } = pluginManager

  const { types } = jbrequire('mobx-state-tree')

  const { makeAbortableReaction } = jbrequire(require('./util'))

  const { getSession } = jbrequire('@gmod/jbrowse-core/util')
  const { getTrackAssemblyName } = jbrequire('@gmod/jbrowse-core/util/tracks')
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
            session: getSession(self),
            assemblyName: getTrackAssemblyName(self),
          }),
          ({ session, assemblyName }, signal) => {
            return session.rpcManager.getRefNameMapForAdapter(
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
