export default ({ jbrequire }) => {
  const { types } = jbrequire('mobx-state-tree')
  const MakeSpreadsheetColumnType = jbrequire(
    require('./MakeSpreadsheetColumnType'),
  )

  const {
    FilterModelType: NumberFilterModel,
    DataCellReactComponent,
  } = jbrequire(require('./LocString'))

  const FilterModelType = types.compose(
    NumberFilterModel,
    types.model({
      type: types.literal('VcfLocString'),

      isDerived: true,
      derivationFunctionText: `function deriveLocationColumn(row, column) {
      return {text:row.extendedData.vcfFeature.refName+':'+row.extendedData.vcfFeature.start+'..'+row.extendedData.vcfFeature.end}
      }`,
    }),
  )

  const LocRef = MakeSpreadsheetColumnType('VcfLocString', {
    categoryName: 'Location',
    displayName: 'Location',
    compare(cellA, cellB) {
      return cellA.text.localeCompare(cellB.text)
    },
    DataCellReactComponent,
    FilterModelType,
  })

  return LocRef
}
