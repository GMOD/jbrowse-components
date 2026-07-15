import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { Button } from '@mui/material'

import { applyColorPalette } from './applyColorPalette.ts'
import { IDENTITY_FIELDS, extraColumns } from '../sourcesGridUtils.ts'

import type { ButtonProps } from '@mui/material'

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

function ColorByButton(props: ButtonProps) {
  return (
    <Button variant="outlined" endIcon={<ArrowDropDownIcon />} {...props} />
  )
}

// "Color by" dropdown: assign a categorical palette keyed on a metadata field
// (e.g. tissue/group), plus a "Clear track colors" reset. Replaces what used to
// be a row of one button per field.
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
    <CascadingMenuButton
      ButtonComponent={ColorByButton}
      menuItems={[
        ...fields.map(field => ({
          label: field,
          onClick: () => {
            setCurrLayout(applyColorPalette(currLayout, field))
          },
        })),
        ...(fields.length > 0 ? [{ type: 'divider' as const }] : []),
        {
          label: 'Clear track colors',
          onClick: () => {
            setCurrLayout(currLayout.map(row => ({ ...row, color: undefined })))
          },
        },
      ]}
    >
      Color by
    </CascadingMenuButton>
  )
}
