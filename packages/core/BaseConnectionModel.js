import { types } from 'mobx-state-tree'

export default pluginManager => {
  return types
    .model('Connection', {
      name: types.identifier,
      tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),
    })
    .actions(self => ({
      afterAttach() {
        self.connect(self.configuration)
      },
      addTrackConf(trackConf) {
        const length = self.tracks.push(trackConf)
        return self.tracks[length - 1]
      },
      setTrackConfs(trackConfs) {
        self.tracks = trackConfs
        return self.track
      },
      clear() {},
    }))
}
