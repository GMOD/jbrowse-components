import { useState } from 'react'

import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { ErrorMessage } from '@jbrowse/core/ui'
import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { measureGridWidth } from '@jbrowse/core/util'
import { ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'

import Checkbox2 from '../Checkbox2'
import VariantGenotypeFrequencyTable from './VariantGenotypeFrequencyTable'
import SampleFilters from './VariantSampleFilters'
import { makeSimpleAltString } from '../../VcfFeature/util'

import type {
  Filters,
  InfoFields,
  VariantFieldDescriptions,
  VariantSampleGridRow,
} from './types'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { GridColDef } from '@mui/x-data-grid'

/**
 * Process sample data and apply filters to generate rows for the sample grid
 */
function getSampleGridRows(
  samples: Record<string, InfoFields>,
  REF: string,
  ALT: string[],
  filter: Filters,
): {
  rows: VariantSampleGridRow[]
  error: unknown
  preFilteredRows: readonly (readonly [string, Record<string, any>])[]
} {
  const preFilteredRows = Object.entries(samples).map(
    ([key, val]) =>
      [
        key,
        {
          ...val,
          GT: `${val.GT?.[0]}`,
          genotype: makeSimpleAltString(`${val.GT?.[0]}`, REF, ALT),
        },
      ] as const,
  )

  let error: unknown
  let rows = [] as VariantSampleGridRow[]
  const filters = Object.keys(filter)

  // catch some error thrown from regex
  // note: maps all values into a string, if this is not done rows are not
  // sortable by the data-grid
  try {
    rows = preFilteredRows
      .map(([key, val]) => {
        return {
          ...Object.fromEntries(
            Object.entries(val).map(([formatField, formatValue]) => [
              formatField,
              formatValue,
            ]),
          ),
          sample: key,
          id: key,
        } as VariantSampleGridRow
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
    console.error(e)
    error = e
  }

  return { rows, error, preFilteredRows }
}

// Define a type for the column display mode
type ColumnDisplayMode = 'all' | 'gtOnly' | 'genotypeOnly'

export default function VariantSampleGrid(props: {
  feature: SimpleFeatureSerialized
  descriptions?: VariantFieldDescriptions | null
}) {
  const { feature, descriptions = {} } = props
  const [filter, setFilter] = useState<Filters>({})
  const [columnDisplayMode, setColumnDisplayMode] =
    useState<ColumnDisplayMode>('all')
  const [showFilters, setShowFilters] = useState(false)
  const samples = (feature.samples || {}) as Record<string, InfoFields>
  const ALT = feature.ALT as string[]
  const REF = feature.REF as string

  // Use the getSampleGridRows function to process the data
  const { rows, error } = getSampleGridRows(samples, REF, ALT, filter)

  const colKeySet = new Set(['sample', ...Object.keys(rows[0] || {})])
  colKeySet.delete('id')
  const keys = [...colKeySet]
  const widths = keys.map(e => measureGridWidth(rows.map(r => r[e])))
  const columns = keys.map(
    (field, index) =>
      ({
        field,
        description: descriptions?.FORMAT?.[field]?.Description,
        width: widths[index],
      }) satisfies GridColDef<(typeof rows)[0]>,
  )

  const s1 = new Set(['sample', 'GT'])
  const s2 = new Set(['sample', 'GT', 'genotype'])

  return !rows.length ? null : (
    <>
      <BaseCard {...props} title="Genotype frequencies">
        <ErrorBoundary FallbackComponent={ErrorMessage}>
          <VariantGenotypeFrequencyTable rows={rows} />
        </ErrorBoundary>
      </BaseCard>
      <BaseCard {...props} title="Samples">
        {error ? <Typography color="error">{`${error}`}</Typography> : null}
        <div>
          <Checkbox2
            label="Show filters"
            checked={showFilters}
            onChange={event => {
              setShowFilters(event.target.checked)
            }}
          />
          <ToggleButtonGroup
            value={columnDisplayMode}
            exclusive
            size="small"
            onChange={(_, newValue) => {
              if (newValue !== null) {
                setColumnDisplayMode(newValue as ColumnDisplayMode)
              }
            }}
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="gtOnly">GT only</ToggleButton>
            <ToggleButton value="genotypeOnly">
              GT+resolved genotype
            </ToggleButton>
          </ToggleButtonGroup>
        </div>

        {showFilters ? (
          <SampleFilters
            setFilter={setFilter}
            columns={columns}
            filter={filter}
          />
        ) : null}

        <DataGridFlexContainer>
          <DataGrid
            rows={rows}
            hideFooter={rows.length < 100}
            columns={
              columnDisplayMode === 'gtOnly'
                ? columns.filter(f => s1.has(f.field))
                : columnDisplayMode === 'genotypeOnly'
                  ? columns.filter(f => s2.has(f.field))
                  : columns
            }
            rowHeight={25}
            columnHeaderHeight={35}
            showToolbar
          />
        </DataGridFlexContainer>
      </BaseCard>
    </>
  )
}
