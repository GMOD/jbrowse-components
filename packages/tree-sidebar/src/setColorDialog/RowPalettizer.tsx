import { Button } from '@mui/material'

import { applyColorPalette } from './applyColorPalette.ts'
import { extraColumns } from '../sourcesGridUtils.ts'

// Reserved fields whose values aren't meaningful as palette keys. Plugins
// can extend this via the `excludedFields` prop.
const ALWAYS_EXCLUDED = new Set([
  'name',
  'source',
  'color',
  'labelColor',
  'label',
  'baseUri',
  'id',
])

export default function RowPalettizer<
  S extends { name: string; color?: string },
>({
  setCurrLayout,
  currLayout,
  excludedFields,
}: {
  currLayout: S[]
  setCurrLayout: (arg: S[]) => void
  excludedFields?: ReadonlySet<string>
}) {
  const excluded = new Set([...ALWAYS_EXCLUDED, ...(excludedFields ?? [])])
  const fields = extraColumns(currLayout, excluded)

  if (!currLayout.length) {
    return null
  }

  return (
    <div>
      {fields.length > 0 ? (
        <>
          Create color palette based on...
          {fields.map(field => (
            <Button
              key={field}
              variant="contained"
              color="inherit"
              onClick={() => {
                setCurrLayout(applyColorPalette(currLayout, field))
              }}
            >
              {field}
            </Button>
          ))}
        </>
      ) : null}
      <Button
        onClick={() => {
          setCurrLayout(currLayout.map(row => ({ ...row, color: undefined })))
        }}
      >
        Clear track colors
      </Button>
    </div>
  )
}
