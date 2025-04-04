import { useState } from 'react'

import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { measureGridWidth } from '@jbrowse/core/util'
import { Checkbox, FormControlLabel, Typography } from '@mui/material'
import { DataGrid, GridToolbar } from '@mui/x-data-grid'

import SampleFilters from './VariantSampleFilters'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

interface Entry {
  sample: string
  id: string
  [key: string]: string
}

type InfoFields = Record<string, unknown>
type Filters = Record<string, string>

interface FormatRecord {
  Description?: string
}
interface Descriptions {
  FORMAT?: Record<string, FormatRecord>
}

export default function VariantSamples(props: {
  feature: SimpleFeatureSerialized
  descriptions?: Descriptions | null
}) {
  const { feature, descriptions = {} } = props
  const [filter, setFilter] = useState<Filters>({})
  const samples = (feature.samples || {}) as Record<string, InfoFields>
  const preFilteredRows = Object.entries(samples)

  let error: unknown
  let rows = [] as Entry[]
  const filters = Object.keys(filter)

  // catch some error thrown from regex
  // note: maps all values into a string, if this is not done rows are not
  // sortable by the data-grid
  try {
    rows = preFilteredRows
      .map(row => {
        return {
          ...Object.fromEntries(
            Object.entries(row[1]).map(e => [e[0], `${e[1]}`]),
          ),
          sample: row[0],
          id: row[0],
        } as Entry
      })
      .filter(row =>
        filters.length
          ? filters.every(key => {
              const currFilter = filter[key]
              return currFilter
                ? new RegExp(currFilter, 'i').exec(row[key]!)
                : true
            })
          : true,
      )
  } catch (e) {
    error = e
  }

  const [checked, setChecked] = useState(false)
  const keys = ['sample', ...Object.keys(preFilteredRows[0]?.[1] || {})]
  const widths = keys.map(e => measureGridWidth(rows.map(r => r[e])))
  const columns = keys.map((field, index) => ({
    field,
    description: descriptions?.FORMAT?.[field]?.Description,
    width: widths[index],
  }))

  // disableRowSelectionOnClick helps avoid
  // https://github.com/mui-org/material-ui-x/issues/1197
  return !preFilteredRows.length ? null : (
    <BaseCard {...props} title="Samples">
      {error ? <Typography color="error">{`${error}`}</Typography> : null}
      <FormControlLabel
        control={
          <Checkbox
            checked={checked}
            onChange={event => {
              setChecked(event.target.checked)
            }}
          />
        }
        label={<Typography variant="body2">Show options</Typography>}
      />
      {checked ? (
        <SampleFilters
          setFilter={setFilter}
          columns={columns}
          filter={filter}
        />
      ) : null}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <DataGrid
          rows={rows}
          hideFooter={rows.length < 100}
          columns={columns}
          disableRowSelectionOnClick
          rowHeight={25}
          columnHeaderHeight={35}
          disableColumnMenu
          slots={{ toolbar: checked ? GridToolbar : undefined }}
          slotProps={{
            toolbar: {
              printOptions: {
                disableToolbarButton: true,
              },
            },
          }}
        />
      </div>
    </BaseCard>
  )
}
