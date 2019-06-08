export default ({ jbrequire }) => {
  const { types } = jbrequire('mobx-state-tree')
  const { ElementId } = jbrequire('@gmod/jbrowse-core/mst-types')

  const model = types.model('CircularView', {
    id: ElementId,
    type: types.literal('CircularView'),
  })
  return model
}
