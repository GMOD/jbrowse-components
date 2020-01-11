export default ({ jbrequire }) => {
  const MakeSpreadsheetColumnType = jbrequire(
    require('./MakeSpreadsheetColumnType'),
  )

  const LocRef = MakeSpreadsheetColumnType('LocRef', {
    categoryName: 'Location',
    displayName: 'Reference seq',
    compare(cellA, cellB) {
      return cellA.text.localeCompare(cellB.text)
    },
  })

  return LocRef
}
