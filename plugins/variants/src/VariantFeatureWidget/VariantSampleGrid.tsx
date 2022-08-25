/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react'

import {
  FormControlLabel,
  Checkbox,
  TextField,
  Typography,
} from '@mui/material'

import { DataGrid } from '@mui/x-data-grid'
import { BaseCard } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'

export default function VariantSamples(props: any) {
  const [filter, setFilter] = useState<any>({})
  const [showFilters, setShowFilters] = useState(false)
  const { feature } = props

  const { samples = {} } = feature
  const preFilteredRows: any = Object.entries(samples)
  if (!preFilteredRows.length) {
    return null
  }
  const infoFields = ['sample', ...Object.keys(preFilteredRows[0][1])].map(
    field => ({
      field,
    }),
  )
  let error
  let rows = []
  const filters = Object.keys(filter)

  // catch some error thrown from regex
  // note: maps all values into a string, if this is not done rows are not
  // sortable by the data-grid
  try {
    rows = preFilteredRows
      .map((row: any) => ({
        ...Object.fromEntries(
          Object.entries(row[1]).map(entry => [entry[0], String(entry[1])]),
        ),
        sample: row[0],
        id: row[0],
      }))
      .filter((row: any) => {
        return filters.length
          ? filters.every(key => {
              const val = row[key]
              const currFilter = filter[key]
              return currFilter ? val.match(new RegExp(currFilter, 'i')) : true
            })
          : true
      })
  } catch (e) {
    error = e
  }
  // disableSelectionOnClick helps avoid
  // https://github.com/mui-org/material-ui-x/issues/1197
  return (
    <BaseCard {...props} title="Samples">
      {error ? <Typography color="error">{`${error}`}</Typography> : null}

      <FormControlLabel
        control={
          <Checkbox
            checked={showFilters}
            onChange={() => setShowFilters(f => !f)}
          />
        }
        label="Show sample filters"
      />
      {showFilters ? (
        <>
          <Typography>
            These filters can use a plain text search or regex style query, e.g.
            in the genotype field, entering 1 will query for all genotypes that
            include the first alternate allele e.g. 0|1 or 1|1, entering
            [1-9]\d* will find any non-zero allele e.g. 0|2 or 2/33
          </Typography>
          {infoFields.map(({ field }) => {
            return (
              <TextField
                key={`filter-${field}`}
                placeholder={`Filter ${field}`}
                value={filter[field] || ''}
                onChange={event =>
                  setFilter({ ...filter, [field]: event.target.value })
                }
              />
            )
          })}
        </>
      ) : null}
      <div style={{ height: 600, width: '100%', overflow: 'auto' }}>
        <DataGrid
          rows={rows}
          columns={infoFields}
          disableSelectionOnClick
          rowHeight={25}
          disableColumnMenu
        />
      </div>
    </BaseCard>
  )
}
