// @ts-nocheck
// this file contains the rather verbose functions for
// creating features from CSV/TSV lines
import { parseLocString } from '@jbrowse/core/util'

export function makeAdHocFeature(
  columns,
  columnsAlreadyUsedInLocations,
  row,
  loc1,
  loc2,
  rowNumber,
) {
  // load all the other data in the row into an `otherData` object
  const otherData = {}
  columns.forEach((column, columnNumber) => {
    if (columnsAlreadyUsedInLocations.includes(columnNumber)) {
      return
    }
    let { text } = row.cells[columnNumber]
    if (column.dataType.type === 'Number') {
      text = Number.parseFloat(text)
    }
    otherData[column.name] = text
  })

  // make the final feature data out of otherData + the parsed locations
  return {
    ...otherData,
    uniqueId: `sv-inspector-adhoc-${rowNumber}`,
    refName: loc1.refName,
    start: loc1.start,
    end: loc1.end,
    mate: {
      refName: loc2.refName,
      start: loc2.start,
      end: loc2.end,
    },
  }
}

export function makeAdHocSvFeatureFromTwoLocations(
  columns,
  locationColumnNumbers,
  row,
  rowNumber,
  isValidRefName,
) {
  // use the first two locations we found (first according to *displayed* order)
  const loc1 = parseLocString(
    row.cells[locationColumnNumbers[0]].text,
    isValidRefName,
  )
  const loc2 = parseLocString(
    row.cells[locationColumnNumbers[1]].text,
    isValidRefName,
  )

  const columnsAlreadyUsedInLocations = [
    locationColumnNumbers[0],
    locationColumnNumbers[1],
  ]

  return makeAdHocFeature(
    columns,
    columnsAlreadyUsedInLocations,
    row,
    loc1,
    loc2,
    rowNumber,
  )
}

export function makeAdHocSvFeatureFromTwoRefStartEndSets(
  columns,
  locRefColumnNumbers,
  locStartColumnNumbers,
  locEndColumnNumbers,
  row,
  rowNumber,
) {
  const textOf = colno => row.cells[colno].text
  const loc1 = {
    refName: textOf(locRefColumnNumbers[0]),
    start: Number.parseInt(textOf(locStartColumnNumbers[0]), 10) - 1,
    end: Number.parseInt(textOf(locEndColumnNumbers[0]), 10),
  }
  const loc2 = {
    refName: textOf(locRefColumnNumbers[1]),
    start: Number.parseInt(textOf(locStartColumnNumbers[1]), 10) - 1,
    end: Number.parseInt(textOf(locEndColumnNumbers[1]), 10),
  }
  const columnsAlreadyUsedInLocations = [
    locRefColumnNumbers[0],
    locStartColumnNumbers[0],
    locEndColumnNumbers[0],
    locRefColumnNumbers[1],
    locStartColumnNumbers[1],
    locEndColumnNumbers[1],
  ]
  return makeAdHocFeature(
    columns,
    columnsAlreadyUsedInLocations,
    row,
    loc1,
    loc2,
    rowNumber,
  )
}

// makes a feature data object (passed as `data` to a SimpleFeature constructor)
// out of table row if the row has 2 location columns. undefined if not
export function makeAdHocSvFeature(sheet, rowNumber, row, isValidRefName) {
  const { columns, columnDisplayOrder } = sheet
  const columnTypes = {}
  columnDisplayOrder.forEach(columnNumber => {
    const columnDefinition = columns[columnNumber]
    if (!columnTypes[columnDefinition.dataType.type]) {
      columnTypes[columnDefinition.dataType.type] = []
    }
    columnTypes[columnDefinition.dataType.type].push(columnNumber)
  })
  const locationColumnNumbers = columnTypes.LocString || []
  const locStartColumnNumbers = columnTypes.LocStart || []
  const locEndColumnNumbers = columnTypes.LocEnd || []
  const locRefColumnNumbers = columnTypes.LocRef || []

  // if we have 2 or more columns of type location, make a feature from them
  if (locationColumnNumbers.length >= 2) {
    return makeAdHocSvFeatureFromTwoLocations(
      columns,
      locationColumnNumbers,
      row,
      rowNumber,
      isValidRefName,
    )
  }
  if (
    locRefColumnNumbers.length >= 2 &&
    locStartColumnNumbers.length >= 2 &&
    locEndColumnNumbers.length >= 2
  ) {
    return makeAdHocSvFeatureFromTwoRefStartEndSets(
      columns,
      locRefColumnNumbers,
      locStartColumnNumbers,
      locEndColumnNumbers,
      row,
      rowNumber,
    )
  }
  return undefined
}
