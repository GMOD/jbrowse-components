import csv from 'csvtojson'
import { TextDecoder } from 'text-encoding-polyfill'

export function bufferToString(buffer: Buffer) {
  return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
}

function parseWith(buffer: Buffer, options = {}) {
  return csv({ noheader: true, output: 'csv', ...options }).fromString(
    bufferToString(buffer),
  )
}

export interface Row {
  id: string
  cells: {
    columnNumber: number
    text: string
    dataType: string
  }[]
}

export interface RowSet {
  isLoaded: boolean
  rows: Row[]
}

async function dataToSpreadsheetSnapshot(rows: string[][]) {
  // rows is an array of row objects and columnNames
  // is an array of column names (in import order)
  let maxCols = 0
  const rowSet: RowSet = {
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

export function parseCsvBuffer(buffer: Buffer) {
  return parseWith(buffer).then(dataToSpreadsheetSnapshot)
}

export function parseTsvBuffer(buffer: Buffer) {
  return parseWith(buffer, { delimiter: '\t' }).then(dataToSpreadsheetSnapshot)
}

export function parseBedBuffer(buffer: Buffer) {}
