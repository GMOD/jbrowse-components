import csv from 'csvtojson'
import { TextDecoder } from 'text-encoding-polyfill'

function parseWith(buffer, options = {}) {
  return csv({ noheader: true, output: 'csv', ...options }).fromString(
    new TextDecoder('utf-8', { fatal: true }).decode(buffer),
  )
}

export function parseCsvBuffer(buffer) {
  return parseWith(buffer)
}

export function parseTsvBuffer(buffer) {
  return parseWith(buffer, { delimiter: '\t' })
}

export async function dataToSpreadsheetSnapshot(rows) {
  // rows is an array of row objects and columnNames
  // is an array of column names (in import order)
  let maxCols = 0
  const rowSet = {
    isLoaded: true,
    rows: rows.map((row, rowNumber) => {
      if (row.length > maxCols) maxCols = row.length
      return {
        id: String(rowNumber),
        cells: row.map((text, columnNumber) => {
          return { columnNumber, text, dataType: 'text' }
        }),
      }
    }),
  }

  const columnDisplayOrder = []
  for (let i = 0; i < maxCols; i += 1) columnDisplayOrder.push(i)

  return { rowSet, columnDisplayOrder }
}
