export default ({ jbrequire }) => {
  const MakeSpreadsheetColumnType = jbrequire(
    require('./MakeSpreadsheetColumnType'),
  )

  const LocStart = MakeSpreadsheetColumnType('LocStart', {
    categoryName: 'Location',
    displayName: 'Start',
    compare(cellA, cellB) {
      return parseFloat(cellA.text) - parseFloat(cellB.text)
    },
  })

  return LocStart
}
