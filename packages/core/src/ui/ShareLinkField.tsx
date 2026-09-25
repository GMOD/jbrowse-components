import { useState } from 'react'

import { TextField } from '@mui/material'

import LabeledCheckbox from './LabeledCheckbox.tsx'
import MonospaceTextField from './MonospaceTextField.tsx'

function SessionJsonPanel({ plaintext }: { plaintext: string }) {
  const [show, setShow] = useState(false)
  return (
    <>
      <LabeledCheckbox
        checked={show}
        onChange={val => {
          setShow(val)
        }}
        label="Show readable JSON"
      />
      {show ? (
        <MonospaceTextField
          label="Session JSON"
          value={plaintext}
          readOnly
          fullWidth
          maxRows={20}
        />
      ) : null}
    </>
  )
}

// Read-only single-line field for a shareable URL; clicking selects the whole
// value so it's easy to copy. `plaintext` is the session a plaintext-JSON link
// carries, offered indented behind a checkbox. Shared by jbrowse-web's
// ShareDialog and jbrowse-desktop's ExportToWebDialog.
export default function ShareLinkField({
  value,
  label = 'URL',
  plaintext,
}: {
  value: string
  label?: string
  plaintext?: string
}) {
  return (
    <>
      <TextField
        label={label}
        value={value}
        variant="filled"
        fullWidth
        onClick={event => {
          const target = event.target as HTMLInputElement
          target.select()
        }}
        slotProps={{
          input: {
            readOnly: true,
          },
        }}
      />
      {plaintext ? <SessionJsonPanel plaintext={plaintext} /> : null}
    </>
  )
}
