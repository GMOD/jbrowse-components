import { TextField } from '@mui/material'
import { observer } from 'mobx-react'

import type { MouseEvent } from 'react'

// Read-only single-line field for a shareable URL; clicking selects the whole
// value so it's easy to copy. Shared by jbrowse-web's ShareDialog and
// jbrowse-desktop's ExportToWebDialog.
const ShareLinkField = observer(function ShareLinkField({
  value,
  label = 'URL',
}: {
  value: string
  label?: string
}) {
  return (
    <TextField
      label={label}
      value={value}
      variant="filled"
      fullWidth
      slotProps={{
        input: {
          readOnly: true,
        },
        htmlInput: {
          onClick: (event: MouseEvent<HTMLInputElement>) => {
            event.currentTarget.select()
          },
        },
      }}
    />
  )
})

export default ShareLinkField
