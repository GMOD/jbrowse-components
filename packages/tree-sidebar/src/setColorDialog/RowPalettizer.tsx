import { Button } from '@mui/material'

import { applyColorPalette } from './applyColorPalette.ts'
import { IDENTITY_FIELDS, extraColumns } from '../sourcesGridUtils.ts'

// Reserved fields whose values aren't meaningful as palette keys: the identity
// fields plus the color/label fields the palette itself writes. Plugins can
// extend this via the `excludedFields` prop.
const ALWAYS_EXCLUDED = new Set<string>([
  ...IDENTITY_FIELDS,
  'color',
  'labelColor',
  'label',
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
  if (!currLayout.length) {
    return null
  }

  const excluded = new Set([...ALWAYS_EXCLUDED, ...(excludedFields ?? [])])
  const fields = extraColumns(currLayout, excluded)

  return (
    <div>
      {fields.length > 0 ? (
        <>
          Create color palette based on...
          {fields.map(field => (
            <Button
              key={field}
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
