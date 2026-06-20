import { useState } from 'react'

import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { ErrorBanner } from '@jbrowse/core/ui'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { measureGridWidth, useLocalStorage } from '@jbrowse/core/util'
import SettingsIcon from '@mui/icons-material/Settings'
import { ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'

import VariantAlleleFrequencyTable from './VariantAlleleFrequencyTable.tsx'
import VariantGenotypeFrequencyTable from './VariantGenotypeFrequencyTable.tsx'
import SampleFilters from './VariantSampleFilters.tsx'
import {
  filterSampleRows,
  getAlleleFrequencies,
  getSampleGridRows,
} from './getSampleGridRows.ts'

import type { Filters, VariantFieldDescriptions } from './types.ts'
import type { VCFFeatureSerialized } from '../types.ts'
import type { GridColDef } from '@mui/x-data-grid'

type ColumnDisplayMode = 'all' | 'gtOnly' | 'gtAndGenotype'

const columnDisplayModes: readonly ColumnDisplayMode[] = [
  'all',
  'gtOnly',
  'gtAndGenotype',
]

const gtOnlyFields = new Set(['sample', 'GT'])
const gtAndGenotypeFields = new Set(['sample', 'GT', 'genotype'])

export default function VariantSampleGrid({
  feature,
  descriptions = {},
}: {
  feature: VCFFeatureSerialized
  descriptions?: VariantFieldDescriptions | null
}) {
  const [filter, setFilter] = useState<Filters>({})
  const [storedColumnDisplayMode, setColumnDisplayMode] =
    useLocalStorage<ColumnDisplayMode>(
      'variantSampleGrid-columnDisplayMode',
      'all',
    )
  // guard against a stale/corrupt stored value
  const columnDisplayMode = columnDisplayModes.includes(storedColumnDisplayMode)
    ? storedColumnDisplayMode
    : 'all'
  const [showFilters, setShowFilters] = useLocalStorage(
    'variantSampleGrid-showFilters',
    false,
  )
  const [showFrequencyTable, setShowFrequencyTable] = useLocalStorage(
    'variantSampleGrid-showFrequencyTable',
    true,
  )
  const [showAlleleFrequencies, setShowAlleleFrequencies] = useLocalStorage(
    'variantSampleGrid-showAlleleFrequencies',
    true,
  )
  const [showToolbar, setShowToolbar] = useLocalStorage(
    'variantSampleGrid-showToolbar',
    false,
  )
  const [useCounts, setUseCounts] = useLocalStorage(
    'variantSampleGrid-useCounts',
    false,
  )
  const [selectedGenotypes, setSelectedGenotypes] =
    useState<Set<string> | null>(null)

  const rows = getSampleGridRows(
    feature.samples ?? {},
    feature.REF ?? '',
    feature.ALT ?? [],
    useCounts,
  )

  const alleleFrequencies = getAlleleFrequencies(
    feature.samples ?? {},
    feature.REF ?? '',
    feature.ALT ?? [],
  )

  const { rows: textFilteredRows, error } = filterSampleRows(rows, filter)

  const filteredRows =
    selectedGenotypes === null
      ? textFilteredRows
      : textFilteredRows.filter(row => selectedGenotypes.has(row.GT))

  const keys = [
    'sample',
    ...Object.keys(rows[0] ?? {}).filter(k => k !== 'id' && k !== 'sample'),
  ]
  const columns = keys.map(
    field =>
      ({
        field,
        description: descriptions?.FORMAT?.[field]?.Description,
        width: measureGridWidth(rows.map(r => r[field])),
      }) satisfies GridColDef<(typeof rows)[0]>,
  )

  return !rows.length ? null : (
    <BaseCard title="Samples">
      {error ? <ErrorBanner error={error} /> : null}
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
              label: 'Show genotype frequency table',
              type: 'checkbox',
              checked: showFrequencyTable,
              onClick: () => {
                setShowFrequencyTable(!showFrequencyTable)
              },
            },
            {
              label: 'Show allele frequency table',
              type: 'checkbox',
              checked: showAlleleFrequencies,
              onClick: () => {
                setShowAlleleFrequencies(!showAlleleFrequencies)
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
          onChange={(_, newValue: ColumnDisplayMode | null) => {
            if (newValue !== null) {
              setColumnDisplayMode(newValue)
            }
          }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="gtOnly">GT only</ToggleButton>
          <ToggleButton value="gtAndGenotype">
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

      {showFrequencyTable ? (
        <>
          <Typography variant="subtitle2" style={{ marginTop: 8 }}>
            Genotype frequencies (click to filter)
          </Typography>
          <ErrorBoundary FallbackComponent={ErrorBanner}>
            <VariantGenotypeFrequencyTable
              rows={textFilteredRows}
              selectedGenotypes={selectedGenotypes}
              setSelectedGenotypes={setSelectedGenotypes}
              showToolbar={showToolbar}
            />
          </ErrorBoundary>
        </>
      ) : null}

      {showAlleleFrequencies && alleleFrequencies.length ? (
        <>
          <Typography variant="subtitle2" style={{ marginTop: 8 }}>
            Allele frequencies
          </Typography>
          <ErrorBoundary FallbackComponent={ErrorBanner}>
            <VariantAlleleFrequencyTable frequencies={alleleFrequencies} />
          </ErrorBoundary>
        </>
      ) : null}

      <Typography variant="subtitle2" style={{ marginTop: 16 }}>
        Samples{' '}
        {selectedGenotypes !== null
          ? `(${filteredRows.length} of ${textFilteredRows.length})`
          : `(${textFilteredRows.length})`}
      </Typography>
      <DataGridFlexContainer>
        <DataGrid
          rows={filteredRows}
          hideFooter={filteredRows.length < 100}
          columns={
            columnDisplayMode === 'gtOnly'
              ? columns.filter(f => gtOnlyFields.has(f.field))
              : columnDisplayMode === 'gtAndGenotype'
                ? columns.filter(f => gtAndGenotypeFields.has(f.field))
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
