import { Button } from '@mui/material'

import { applyColorPalette } from './applyColorPalette.ts'

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
  if (!currLayout.length || !currLayout[0]) {
    return null
  }

  const fields = Object.keys(currLayout[0]).filter(
    f => !ALWAYS_EXCLUDED.has(f) && !excludedFields?.has(f),
  )

  return (
    <div>
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
