import { ErrorBanner, LoadingEllipses } from '@jbrowse/core/ui'
import { statusProgressLabel } from '@jbrowse/core/util'
import { useFetch } from '@jbrowse/core/util/useFetch'
import { Autocomplete, TextField, Typography } from '@mui/material'

import { attributeVerdict, candidateCountHint } from './attributeVerdict.ts'

import type { GroupByScanOptions } from '../scanGroupByCandidates.ts'
import type { AttributeScan, AttributeUse } from './attributeVerdict.ts'

export interface AttributeScanModel {
  id: string
  scanGroupByCandidates: (opts: GroupByScanOptions) => Promise<AttributeScan>
}

/**
 * A free-text attribute name, offering the attributes the features in view
 * carry. The scan is the render fetch's download again, so it runs only while
 * this is mounted. Keyed by the display's id: an MST node stringifies to its
 * whole snapshot.
 */
export default function AttributeFieldInput({
  model,
  value,
  onChange,
  use,
  testid,
  placeholder,
}: {
  model: AttributeScanModel
  value: string
  onChange: (value: string) => void
  use: AttributeUse
  testid: string
  placeholder: string
}) {
  const {
    data: scan,
    error,
    isLoading,
    status,
  } = useFetch(
    ['canvasGroupByCandidates', model.id] as const,
    (_name, _id, signal, statusCallback) =>
      model.scanGroupByCandidates({ signal, statusCallback }),
  )
  const candidates = scan === undefined || !Array.isArray(scan) ? [] : scan
  const verdict = attributeVerdict(value.trim(), scan, use)
  return (
    <>
      <Autocomplete
        freeSolo
        options={candidates.map(c => c.field)}
        inputValue={value}
        onInputChange={(_event, next) => {
          onChange(next)
        }}
        loading={isLoading}
        renderOption={({ key, ...props }, option) => {
          const candidate = candidates.find(c => c.field === option)
          return (
            <li key={key} {...props}>
              <span style={{ flex: 1 }}>{option}</span>
              {candidate ? (
                <Typography variant="caption" color="text.secondary">
                  {candidateCountHint(candidate, use)}
                </Typography>
              ) : null}
            </li>
          )
        }}
        renderInput={({ slotProps, ...params }) => (
          <TextField
            {...params}
            label="Attribute name"
            placeholder={placeholder}
            autoFocus
            fullWidth
            slotProps={{
              ...slotProps,
              htmlInput: { ...slotProps.htmlInput, 'data-testid': testid },
            }}
          />
        )}
      />
      {isLoading ? (
        <LoadingEllipses
          message={
            statusProgressLabel(status) || 'Scanning features for attributes'
          }
        />
      ) : error ? (
        <ErrorBanner error={error} />
      ) : verdict ? (
        <Typography variant="caption" color={verdict.color}>
          {verdict.text}
        </Typography>
      ) : null}
    </>
  )
}
