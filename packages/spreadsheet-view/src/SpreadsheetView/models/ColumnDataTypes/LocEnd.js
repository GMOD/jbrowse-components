export default ({ jbrequire }) => {
  const MakeSpreadsheetColumnType = jbrequire(
    require('./MakeSpreadsheetColumnType'),
  )

  const LocEnd = MakeSpreadsheetColumnType('LocEnd', {
    categoryName: 'Location',
    displayName: 'End',
    compare(cellA, cellB) {
      return parseFloat(cellA.text) - parseFloat(cellB.text)
    },
  })

  return LocEnd
}
