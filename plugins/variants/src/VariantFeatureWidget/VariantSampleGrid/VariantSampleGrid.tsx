import { useMemo, useState } from 'react'

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

const columnDisplayModes: ReadonlySet<ColumnDisplayMode> = new Set([
  'all',
  'gtOnly',
  'gtAndGenotype',
])

const gtOnlyFields = new Set(['sample', 'GT'])
const gtAndGenotypeFields = new Set(['sample', 'GT', 'genotype'])

// Stable empty defaults so the row/frequency/column memos below don't churn on
// every render when a field is absent.
const EMPTY_SAMPLES = {}
const EMPTY_ALT: string[] = []
const EMPTY_DESCRIPTIONS: VariantFieldDescriptions = {}

export default function VariantSampleGrid({
  feature,
  descriptions = EMPTY_DESCRIPTIONS,
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
  const columnDisplayMode = columnDisplayModes.has(storedColumnDisplayMode)
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

  // These tally over every sample, so memoize — the grid re-renders on each
  // filter keystroke / toggle, and a big VCF can carry thousands of samples.
  const samples = feature.samples ?? EMPTY_SAMPLES
  const REF = feature.REF ?? ''
  const ALT = feature.ALT ?? EMPTY_ALT
  const rows = useMemo(
    () => getSampleGridRows(samples, REF, ALT, useCounts),
    [samples, REF, ALT, useCounts],
  )
  const alleleFrequencies = useMemo(
    () => getAlleleFrequencies(samples, REF, ALT),
    [samples, REF, ALT],
  )

  // Recompiles regexes and rescans every row, so memoize on the same footing as
  // the row build above.
  const { rows: textFilteredRows, error } = useMemo(
    () => filterSampleRows(rows, filter),
    [rows, filter],
  )

  const filteredRows = useMemo(
    () =>
      selectedGenotypes === null
        ? textFilteredRows
        : textFilteredRows.filter(row => selectedGenotypes.has(row.GT)),
    [textFilteredRows, selectedGenotypes],
  )

  // Columns are the union of FORMAT fields across every sample, not just
  // rows[0]: VCF lets a sample drop trailing fields (a bare "0/1" call yields
  // only GT), so keying off the first row alone would hide columns other
  // samples populate. measureGridWidth also scans every row per column, so
  // memoize alongside the row build rather than re-measuring on each keystroke.
  const columns = useMemo(() => {
    const fields = new Set<string>()
    for (const row of rows) {
      for (const key in row) {
        if (key !== 'id' && key !== 'sample') {
          fields.add(key)
        }
      }
    }
    return ['sample', ...fields].map(
      field =>
        ({
          field,
          description: descriptions?.FORMAT?.[field]?.Description,
          width: measureGridWidth(rows.map(r => r[field])),
        }) satisfies GridColDef<(typeof rows)[0]>,
    )
  }, [rows, descriptions])

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
