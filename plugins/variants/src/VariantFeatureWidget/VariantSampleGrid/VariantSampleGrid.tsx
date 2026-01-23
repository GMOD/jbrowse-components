import { useMemo, useState } from 'react'

import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { ErrorMessage } from '@jbrowse/core/ui'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { measureGridWidth } from '@jbrowse/core/util'
import SettingsIcon from '@mui/icons-material/Settings'
import { ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'

import VariantGenotypeFrequencyTable from './VariantGenotypeFrequencyTable.tsx'
import SampleFilters from './VariantSampleFilters.tsx'
import { getSampleGridRows } from './getSampleGridRows.ts'

import type { Filters, InfoFields, VariantFieldDescriptions } from './types.ts'
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
  const [showFrequencyTable, setShowFrequencyTable] = useState(true)
  const [showToolbar, setShowToolbar] = useState(false)
  const [useCounts, setUseCounts] = useState(false)
  const [selectedGenotypes, setSelectedGenotypes] =
    useState<Set<string> | null>(null)
  const samples = (feature.samples || {}) as Record<string, InfoFields>
  const ALT = feature.ALT as string[]
  const REF = feature.REF as string

  const { rows, error } = getSampleGridRows(
    samples,
    REF,
    ALT,
    filter,
    useCounts,
  )

  const filteredRows = useMemo(
    () =>
      selectedGenotypes === null
        ? rows
        : rows.filter(row => selectedGenotypes.has(row.GT)),
    [rows, selectedGenotypes],
  )

  const columns = useMemo(() => {
    const keys = [
      'sample',
      ...Object.keys(rows[0] || {}).filter(k => k !== 'id' && k !== 'sample'),
    ]
    return keys.map(
      field =>
        ({
          field,
          description: descriptions?.FORMAT?.[field]?.Description,
          width: measureGridWidth(filteredRows.map(r => r[field])),
        }) satisfies GridColDef<(typeof rows)[0]>,
    )
  }, [rows, filteredRows, descriptions])

  return !rows.length ? null : (
    <BaseCard {...props} title="Samples">
      {error ? <Typography color="error">{`${error}`}</Typography> : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <CascadingMenuButton
          menuItems={[
            {
              label: 'Show allele counts ("dosage")',
              helpText:
                'This converts a genotype like 1/1 into 1:2 which says there were two occurrences of the ALT allele 1 in the genotype',
              type: 'checkbox',
              checked: useCounts,
              onClick: () => {
                setUseCounts(!useCounts)
                setSelectedGenotypes(null)
              },
            },
            {
              label: 'Show frequency table',
              type: 'checkbox',
              checked: showFrequencyTable,
              onClick: () => {
                setShowFrequencyTable(!showFrequencyTable)
              },
            },
            {
              label: 'Show filters',
              type: 'checkbox',
              checked: showFilters,
              onClick: () => {
                setShowFilters(!showFilters)
              },
            },
            {
              label: 'Show toolbar',
              type: 'checkbox',
              checked: showToolbar,
              onClick: () => {
                setShowToolbar(!showToolbar)
              },
            },
          ]}
        >
          <SettingsIcon />
        </CascadingMenuButton>
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
          <ToggleButton value="genotypeOnly">GT+resolved genotype</ToggleButton>
        </ToggleButtonGroup>
      </div>

      {showFilters ? (
        <SampleFilters
          setFilter={setFilter}
          columns={columns}
          filter={filter}
        />
      ) : null}

      {showFrequencyTable ? (
        <>
          <Typography variant="subtitle2" style={{ marginTop: 8 }}>
            Genotype frequencies (click to filter)
          </Typography>
          <ErrorBoundary FallbackComponent={ErrorMessage}>
            <VariantGenotypeFrequencyTable
              rows={rows}
              selectedGenotypes={selectedGenotypes}
              setSelectedGenotypes={setSelectedGenotypes}
              showToolbar={showToolbar}
            />
          </ErrorBoundary>
        </>
      ) : null}

      <Typography variant="subtitle2" style={{ marginTop: 16 }}>
        Samples{' '}
        {selectedGenotypes !== null
          ? `(${filteredRows.length} of ${rows.length})`
          : `(${rows.length})`}
      </Typography>
      <DataGridFlexContainer>
        <DataGrid
          rows={filteredRows}
          hideFooter={filteredRows.length < 100}
          columns={
            columnDisplayMode === 'gtOnly'
              ? columns.filter(f => gtOnlyFields.has(f.field))
              : columnDisplayMode === 'genotypeOnly'
                ? columns.filter(f => genotypeFields.has(f.field))
                : columns
          }
          rowHeight={25}
          columnHeaderHeight={25}
          showToolbar={showToolbar}
        />
      </DataGridFlexContainer>
    </BaseCard>
  )
}
