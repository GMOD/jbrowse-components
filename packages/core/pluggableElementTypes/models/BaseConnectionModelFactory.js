import { types } from 'mobx-state-tree'

export default pluginManager => {
  return types
    .model('Connection', {
      name: types.identifier,
      tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),
    })
    .actions(self => ({
      afterAttach() {
        if (!self.tracks.length) {
          self.connect(self.configuration)
        }
      },
      addTrackConf(trackConf) {
        const length = self.tracks.push(trackConf)
        return self.tracks[length - 1]
      },
      addTrackConfs(trackConfs) {
        const length = self.tracks.push(...trackConfs)
        return self.tracks.slice(length - 1 - trackConfs.length, length - 1)
      },
      setTrackConfs(trackConfs) {
        self.tracks = trackConfs
        return self.tracks
      },
      clear() {},
    }))
}
