import { useEffect, useState, useTransition } from 'react'

import { TextField, Typography } from '@mui/material'

type Filters = Record<string, string>

export default function SampleFilters({
  columns,
  filter,
  setFilter,
}: {
  columns: { field: string }[]
  filter: Filters
  setFilter: (arg: Filters) => void
}) {
  const [localFilter, setLocalFilter] = useState(filter)
  const [, startTransition] = useTransition()

  // Sync local state when parent filter prop changes externally
  useEffect(() => {
    setLocalFilter(filter)
  }, [filter])

  return (
    <>
      <Typography>
        These filters can use a plain text search or regex style query, e.g. in
        the genotype field, entering 1 will query for all genotypes that include
        the first alternate allele e.g. 0|1 or 1|1, entering [1-9]\d* will find
        any non-zero allele e.g. 0|2 or 2/33
      </Typography>
      {columns.map(({ field }) => (
        <TextField
          key={`filter-${field}`}
          placeholder={`Filter ${field}`}
          value={localFilter[field] || ''}
          onChange={event => {
            const value = event.target.value
            const newFilter = { ...localFilter, [field]: value }
            setLocalFilter(newFilter)
            startTransition(() => {
              setFilter(newFilter)
            })
          }}
        />
      ))}
    </>
  )
}
