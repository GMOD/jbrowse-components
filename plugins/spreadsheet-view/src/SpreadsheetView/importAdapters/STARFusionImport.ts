import { parseTsvBuffer } from './ImportUtils'
import type { ParseOptions } from './ImportUtils'
import type { Buffer } from 'buffer'

function parseSTARFusionBreakpointString(str: string) {
  const fields = str.split(':')
  const refName = fields[0]!
  const pos = Number.parseInt(fields[1]!, 10)
  const strand = fields[2] === '-' ? -1 : 1
  return { refName, pos, strand }
}

const numericColumns: Record<string, boolean> = {
  SpanningFragCount: true,
  FFPM: true,
  LeftBreakEntropy: true,
  RightBreakEntropy: true,
  JunctionReadCount: true,
}

export async function parseSTARFusionBuffer(
  buffer: Buffer,
  options: ParseOptions,
) {
  const data = await parseTsvBuffer(buffer, {
    hasColumnNameLine: true,
    columnNameLineNumber: 1,
    selectedAssemblyName: options.selectedAssemblyName,
    isValidRefName: () => false,
  })

  // remove the # in #FusionName
  data.columns[0]!.name = data.columns[0]!.name.replace('#', '')
  // set some columns to be numeric
  data.columns.forEach(col => {
    if (numericColumns[col.name]) {
      col.dataType = { type: 'Number' }
    }
  })

  // decorate each row with a feature object in its extendedData
  data.rowSet.rows.forEach((row, rowNumber) => {
    const featureData: Record<string, any> = {}
    row.cells.forEach(({ text }, columnNumber) => {
      const column = data.columns[columnNumber]!
      if (column.name === 'LeftBreakpoint' && text) {
        const { refName, pos, strand } = parseSTARFusionBreakpointString(text)
        featureData.refName = refName
        featureData.start = pos
        featureData.end = pos
        featureData.strand = strand
      } else if (column.name === 'RightBreakpoint' && text) {
        const { refName, pos, strand } = parseSTARFusionBreakpointString(text)
        featureData.mate = {
          refName,
          start: pos,
          end: pos,
          strand,
        }
      } else if (text && numericColumns[column.name]) {
        // some other column, numeric
        featureData[column.name] = Number.parseFloat(text)
      } else {
        // some other column, text
        featureData[column.name] = text
      }
    })
    featureData.uniqueId = `sf-${rowNumber + 1}`
    row.extendedData = {
      feature: featureData,
    }
  })

  return data
}
