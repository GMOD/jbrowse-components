export default ({ jbrequire }) => {
  const MakeSpreadsheetColumnType = jbrequire(
    require('./MakeSpreadsheetColumnType'),
  )

  const NumberColumn = MakeSpreadsheetColumnType('Number', {
    compare(cellA, cellB) {
      return parseFloat(cellA.text, 10) - parseFloat(cellB.text, 10)
    },
  })

  return NumberColumn
}
