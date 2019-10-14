export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types, getParent, getRoot } = jbrequire('mobx-state-tree')

  return types
    .model('SpreadsheetImportWizard', {
      fileSource: types.frozen(),
    })
    .actions(self => ({
      setFileSource(newSource) {
        self.fileSource = newSource
      },
    }))
}
