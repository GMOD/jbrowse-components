import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import { paletteColorsByRow } from './applyColorPalette.ts'
import { IDENTITY_FIELDS, extraColumns } from '../sourcesGridUtils.ts'

import type { ColorColumn } from './SourceGrid.tsx'
import type { ButtonProps } from '@mui/material'

// Reserved fields whose values aren't meaningful as palette keys: the identity
// fields plus the color/label fields the palette itself writes. `label` and
// `id` are near-unique per row, so coloring by them just recolors every row
// individually. Plugins can extend this via the `excludedFields` prop.
const ALWAYS_EXCLUDED = new Set<string>([
  ...IDENTITY_FIELDS,
  'color',
  'labelColor',
  'label',
  'id',
])

const ColorByButton = observer(function ColorByButton(props: ButtonProps) {
  return (
    <Button variant="outlined" endIcon={<ArrowDropDownIcon />} {...props} />
  )
})

// "Color by" dropdown: assign a categorical palette keyed on a metadata field
// (e.g. tissue/group), plus a reset. Both write the color column the grid is
// currently editing (`colorColumn`) rather than always `color`, so that in
// multi-wiggle density mode — where the grid edits `labelColor`, the score ramp
// owning `color` — palettizing tints the row labels the user is looking at.
export default observer(function RowPalettizer<
  S extends { name: string; color?: string },
>({
  setCurrLayout,
  currLayout,
  colorColumn,
  excludedFields,
}: {
  currLayout: S[]
  setCurrLayout: (arg: S[]) => void
  colorColumn: ColorColumn<S> | undefined
  excludedFields?: ReadonlySet<string>
}) {
  const excluded = new Set([...ALWAYS_EXCLUDED, ...(excludedFields ?? [])])
  const fields = extraColumns(currLayout, excluded)

  // Row-aligned `values`; undefined unsets, letting the consumer's own color
  // synthesis take back over.
  const paint = (target: keyof S & string, values: (string | undefined)[]) => {
    setCurrLayout(currLayout.map((row, i) => ({ ...row, [target]: values[i] })))
  }

  return currLayout.length && colorColumn ? (
    <CascadingMenuButton
      ButtonComponent={ColorByButton}
      menuItems={[
        ...fields.map(field => ({
          label: field,
          onClick: () => {
            paint(colorColumn.field, paletteColorsByRow(currLayout, field))
          },
        })),
        ...(fields.length > 0 ? [{ type: 'divider' as const }] : []),
        {
          label: `Clear ${colorColumn.headerName.toLowerCase()}s`,
          onClick: () => {
            paint(
              colorColumn.field,
              currLayout.map(() => undefined),
            )
          },
        },
      ]}
    >
      Color by
    </CascadingMenuButton>
  ) : null
})
