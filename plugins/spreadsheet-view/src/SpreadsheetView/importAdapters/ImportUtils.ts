import { parseLocString } from '@jbrowse/core/util'
import type { ParsedLocString } from '@jbrowse/core/util'
import type { Buffer } from 'buffer'

export function bufferToString(buffer: Buffer) {
  return new TextDecoder('utf8', { fatal: true }).decode(buffer)
}

async function parseWith(buffer: Buffer, options = {}) {
  const csv = await import('csvtojson').then(module => module.default)
  return csv({ noheader: true, output: 'csv', ...options }).fromString(
    bufferToString(buffer),
  )
}

export interface Row {
  id: string

  extendedData?: any
  cells: {
    text: string

    extendedData?: any
  }[]
}

export interface RowSet {
  isLoaded: boolean
  rows: Row[]
}

export interface ParseOptions {
  hasColumnNameLine?: boolean
  columnNameLineNumber?: number
  selectedAssemblyName?: string
  isValidRefName?: (refName: string, assemblyName?: string) => boolean
}

export interface Column {
  name: string
  dataType: { type: string }
  isDerived?: boolean
  derivationFunctionText?: string
}

function guessColumnType(
  rowSet: RowSet,
  columnNumber: number,
  isValidRefName: (refName: string, assemblyName?: string) => boolean,
) {
  const text = rowSet.rows[0]!.cells[columnNumber]!.text || ''

  let guessedType = 'Text'

  let parsedLoc: ParsedLocString | undefined
  try {
    parsedLoc = parseLocString(text, isValidRefName)
  } catch (error) {
    //
  }
  if (parsedLoc?.refName && typeof parsedLoc.start === 'number') {
    guessedType = 'LocString'
  } else if (/^\d+(\.\d+)?$/.test(text)) {
    guessedType = 'Number'
  }

  // MAYBE TODO: iterate over the rest of the rows to confirm
  // the type for all the rows

  return guessedType
}

function dataToSpreadsheetSnapshot(
  rows: string[][],
  options: ParseOptions = {},
) {
  const {
    hasColumnNameLine = false,
    columnNameLineNumber = 1,
    isValidRefName = () => false,
    selectedAssemblyName,
  } = options
  // rows is an array of row objects and columnNames
  // is an array of column names (in import order)
  let maxCols = 0
  const rowSet: RowSet = {
    isLoaded: true,
    rows: rows.map((row, rowNumber) => {
      const id = rowNumber + (hasColumnNameLine ? 0 : 1)
      if (row.length > maxCols) {
        maxCols = row.length
      }
      return {
        id: String(id),
        cells: row.map((text, columnNumber) => {
          return { columnNumber, text }
        }),
      }
    }),
  }

  // process the column names row if present
  const columnNames: Record<string, string> = {}
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (hasColumnNameLine && columnNameLineNumber !== undefined) {
    const [colNamesRow] = rowSet.rows.splice(columnNameLineNumber - 1, 1)

    if (colNamesRow) {
      colNamesRow.cells.forEach((cell, columnNumber) => {
        columnNames[columnNumber] = cell.text || ''
      })
    }
  }

  // make our column definitions
  const columns: Column[] = []
  const columnDisplayOrder = []
  for (let columnNumber = 0; columnNumber < maxCols; columnNumber += 1) {
    columnDisplayOrder.push(columnNumber)
    const guessedType = guessColumnType(rowSet, columnNumber, isValidRefName)

    // store extendeddata for LocString column
    if (guessedType === 'LocString') {
      for (const row of rowSet.rows) {
        const cell = row.cells[columnNumber]!
        cell.extendedData = parseLocString(cell.text, isValidRefName)
      }
    }

    columns[columnNumber] = {
      name: columnNames[columnNumber]!,
      dataType: {
        type: guessedType,
      },
    }
  }

  return {
    rowSet,
    columnDisplayOrder,
    hasColumnNames: !!hasColumnNameLine,
    columns,
    assemblyName: selectedAssemblyName,
  }
}

export async function parseCsvBuffer(buffer: Buffer, options?: ParseOptions) {
  const rows = await parseWith(buffer)
  return dataToSpreadsheetSnapshot(rows, options)
}

export async function parseTsvBuffer(buffer: Buffer, options?: ParseOptions) {
  const rows = await parseWith(buffer, { delimiter: '\t' })
  return dataToSpreadsheetSnapshot(rows, options)
}
