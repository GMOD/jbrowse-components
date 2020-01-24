import { ParseOptions, parseTsvBuffer } from './ImportUtils'

export function parseBedBuffer(buffer: Buffer, options: ParseOptions) {
  return parseTsvBuffer(buffer).then(data => {
    const bedColumns = [
      { name: 'chrom', dataType: { type: 'Text' } },
      { name: 'chromStart', dataType: { type: 'Number' } },
      { name: 'chromEnd', dataType: { type: 'Number' } },
      { name: 'name', dataType: { type: 'Text' } },
      { name: 'score', dataType: { type: 'Number' } },
      { name: 'strand', dataType: { type: 'Text' } },
    ]
    data.columns.forEach((col, colNumber) => {
      const bedColumn = bedColumns[colNumber]
      if (bedColumn) {
        col.name = bedColumn.name
        col.dataType = bedColumn.dataType
      }
    })
    data.hasColumnNames = true
    data.assemblyName = options.selectedAssemblyName

    return data
  })
}

export function parseBedPEBuffer(buffer: Buffer, options: ParseOptions) {
  return parseTsvBuffer(buffer).then(data => {
    interface BedColumn {
      name: string
      dataType: {
        type: string
      }
      featureField: string[]
    }
    const bedColumns: BedColumn[] = [
      { name: 'chrom1', dataType: { type: 'Text' }, featureField: ['refName'] },
      { name: 'start1', dataType: { type: 'Number' }, featureField: ['start'] },
      { name: 'end1', dataType: { type: 'Number' }, featureField: ['end'] },
      {
        name: 'chrom2',
        dataType: { type: 'Text' },
        featureField: ['mate', 'refName'],
      },
      {
        name: 'start2',
        dataType: { type: 'Number' },
        featureField: ['mate', 'start'],
      },
      {
        name: 'end2',
        dataType: { type: 'Number' },
        featureField: ['mate', 'end'],
      },
      { name: 'name', dataType: { type: 'Text' }, featureField: ['name'] },
      { name: 'score', dataType: { type: 'Number' }, featureField: ['score'] },
      { name: 'strand1', dataType: { type: 'Text' }, featureField: ['strand'] },
      {
        name: 'strand2',
        dataType: { type: 'Text' },
        featureField: ['mate', 'strand'],
      },
    ]
    data.columns.forEach((col, colNumber) => {
      const bedColumn = bedColumns[colNumber]
      if (bedColumn) {
        col.name = bedColumn.name
        col.dataType = bedColumn.dataType
      }
    })
    data.hasColumnNames = true

    // decorate each row with a feature object in its extendedData
    data.rowSet.rows.forEach((row, rowNumber) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const featureData: Record<string, any> = {}
      row.cells.forEach(({ text }, columnNumber) => {
        const bedColumn = bedColumns[columnNumber]
        const val =
          bedColumn && bedColumn.dataType.type === 'Number' && text
            ? parseFloat(text)
            : text
        if (bedColumn) {
          // a predefined column
          if (bedColumn.featureField.length === 2) {
            if (!featureData[bedColumn.featureField[0]])
              featureData[bedColumn.featureField[0]] = {}
            featureData[bedColumn.featureField[0]][
              bedColumn.featureField[1]
            ] = val
          } else {
            featureData[bedColumn.featureField[0]] = val
          }
        } else {
          // some other column
          featureData[`column${columnNumber + 1}`] = val
        }
      })
      featureData.uniqueId = `bedpe-${rowNumber}`
      row.extendedData = {
        feature: featureData,
      }
    })

    data.assemblyName = options.selectedAssemblyName

    return data
  })
}
