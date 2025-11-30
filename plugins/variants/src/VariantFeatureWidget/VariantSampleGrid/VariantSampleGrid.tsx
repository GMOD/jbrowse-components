import { useState } from 'react'

import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { ErrorMessage } from '@jbrowse/core/ui'
import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { measureGridWidth } from '@jbrowse/core/util'
import {
  Checkbox,
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'

import VariantGenotypeFrequencyTable from './VariantGenotypeFrequencyTable'
import SampleFilters from './VariantSampleFilters'
import { getSampleGridRows } from './getSampleGridRows'

import type { Filters, InfoFields, VariantFieldDescriptions } from './types'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { GridColDef } from '@mui/x-data-grid'

type ColumnDisplayMode = 'all' | 'gtOnly' | 'genotypeOnly'

const gtOnlyFields = new Set(['sample', 'GT'])
const genotypeFields = new Set(['sample', 'GT', 'genotype'])

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

  const { rows, error } = getSampleGridRows(samples, REF, ALT, filter)

  const keys = ['sample', ...Object.keys(rows[0] || {})].filter(k => k !== 'id')
  const columns = keys.map(
    field =>
      ({
        field,
        description: descriptions?.FORMAT?.[field]?.Description,
        width: measureGridWidth(rows.map(r => r[field])),
      }) satisfies GridColDef<(typeof rows)[0]>,
  )

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
          <FormControlLabel
            control={
              <Checkbox
                checked={showFilters}
                onChange={event => {
                  setShowFilters(event.target.checked)
                }}
              />
            }
            label={<Typography variant="body2">Show filters</Typography>}
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
                ? columns.filter(f => gtOnlyFields.has(f.field))
                : columnDisplayMode === 'genotypeOnly'
                  ? columns.filter(f => genotypeFields.has(f.field))
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
