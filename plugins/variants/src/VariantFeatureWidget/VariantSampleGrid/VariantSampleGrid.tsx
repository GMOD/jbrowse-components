import { useMemo, useState } from 'react'

import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { ErrorBanner } from '@jbrowse/core/ui'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import ControlRow from '@jbrowse/core/ui/ControlRow'
import DetailTable from '@jbrowse/core/ui/DetailTable'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { useLocalStorage } from '@jbrowse/core/util/hooks'
import SettingsIcon from '@mui/icons-material/Settings'
import { ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import VariantAlleleFrequencyTable from './VariantAlleleFrequencyTable.tsx'
import VariantGenotypeFrequencyTable from './VariantGenotypeFrequencyTable.tsx'
import SampleFilters from './VariantSampleFilters.tsx'
import {
  carriesAllele,
  filterSampleRows,
  getAlleleFrequencies,
  getSampleGridRows,
} from './getSampleGridRows.ts'

import type { Descriptions, VCFFeatureSerialized } from '../types.ts'
import type { Filters, InfoFields, VariantSampleGridRow } from './types.ts'
import type { DetailTableColumn } from '@jbrowse/core/ui/DetailTable'

// One entry per mode: its toggle-button label and which columns it shows. Adding
// a mode here adds its button and its filter, with no third list to update.
const columnDisplayModes = {
  all: { label: 'All', shows: () => true },
  gtOnly: {
    label: 'GT only',
    shows: (field: string) => field === 'sample' || field === 'GT',
  },
  gtAndGenotype: {
    label: 'GT+resolved genotype',
    shows: (field: string) =>
      field === 'sample' || field === 'GT' || field === 'genotype',
  },
}

type ColumnDisplayMode = keyof typeof columnDisplayModes

// Stable empty defaults so the row/frequency/column memos below don't churn on
// every render when a field is absent.
const EMPTY_SAMPLES: Record<string, InfoFields> = {}
const EMPTY_ALT: string[] = []

const VariantSampleGrid = observer(function VariantSampleGrid({
  feature,
  descriptions,
  selectedAlt = null,
}: {
  feature: VCFFeatureSerialized
  descriptions?: Descriptions
  selectedAlt?: number | null
}) {
  const [filter, setFilter] = useState<Filters>({})
  const [storedColumnDisplayMode, setColumnDisplayMode] =
    useLocalStorage<ColumnDisplayMode>(
      'variantSampleGrid-columnDisplayMode',
      'all',
    )
  // guard against a stale/corrupt stored value
  const columnDisplayMode = Object.hasOwn(
    columnDisplayModes,
    storedColumnDisplayMode,
  )
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

  const allelePicked = useMemo(
    () =>
      selectedAlt === null
        ? textFilteredRows
        : textFilteredRows.filter(row =>
            carriesAllele(samples[row.id], selectedAlt),
          ),
    [textFilteredRows, samples, selectedAlt],
  )

  const filteredRows = useMemo(
    () =>
      selectedGenotypes === null
        ? allelePicked
        : allelePicked.filter(row => selectedGenotypes.has(row.GT)),
    [allelePicked, selectedGenotypes],
  )

  // Columns are the union of FORMAT fields across every sample, not just
  // rows[0]: VCF lets a sample drop trailing fields (a bare "0/1" call yields
  // only GT), so keying off the first row alone would hide columns other
  // samples populate.
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
          value: row => row[field],
        }) satisfies DetailTableColumn<VariantSampleGridRow>,
    )
  }, [rows, descriptions])
  const shownColumns = useMemo(
    () =>
      columns.filter(c => columnDisplayModes[columnDisplayMode].shows(c.field)),
    [columns, columnDisplayMode],
  )

  return !rows.length ? null : (
    <BaseCard title="Samples">
      {error ? <ErrorBanner error={error} /> : null}
      <ControlRow>
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
          {Object.entries(columnDisplayModes).map(([mode, { label }]) => (
            <ToggleButton key={mode} value={mode}>
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </ControlRow>

      {showFilters ? (
        <SampleFilters
          setFilter={setFilter}
          columns={columns}
          filter={filter}
        />
      ) : null}

      {showFrequencyTable ? (
        <ErrorBoundary FallbackComponent={ErrorBanner}>
          <VariantGenotypeFrequencyTable
            title={
              <Typography variant="subtitle2">
                Genotype frequencies (click to filter)
              </Typography>
            }
            rows={allelePicked}
            selectedGenotypes={selectedGenotypes}
            setSelectedGenotypes={setSelectedGenotypes}
          />
        </ErrorBoundary>
      ) : null}

      {showAlleleFrequencies && alleleFrequencies.length ? (
        <ErrorBoundary FallbackComponent={ErrorBanner}>
          <VariantAlleleFrequencyTable
            title={
              <Typography variant="subtitle2">Allele frequencies</Typography>
            }
            frequencies={alleleFrequencies}
          />
        </ErrorBoundary>
      ) : null}

      <DetailTable
        title={
          <Typography variant="subtitle2">
            Samples{' '}
            {filteredRows.length === textFilteredRows.length
              ? `(${textFilteredRows.length})`
              : `(${filteredRows.length} of ${textFilteredRows.length})`}
            {selectedAlt === null
              ? ''
              : ` carrying ${selectedAlt === 0 ? 'REF' : `ALT ${selectedAlt}`}`}
          </Typography>
        }
        exportName="samples"
        testId="variant-samples-table"
        rows={filteredRows}
        columns={shownColumns}
      />
    </BaseCard>
  )
})

export default VariantSampleGrid
