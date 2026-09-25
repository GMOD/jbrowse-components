import { useState } from 'react'

import LabeledCheckbox from './LabeledCheckbox.tsx'
import MonospaceTextField from './MonospaceTextField.tsx'

// The session a share or export dialog is about to hand over, as indented JSON
// behind a checkbox, so the sender can read what they are sending whichever
// link carries it. Shared by jbrowse-web's ShareDialog and jbrowse-desktop's
// ExportToWebDialog.
export default function SessionJsonPanel({ session }: { session: unknown }) {
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
          value={JSON.stringify(session, null, 2)}
          readOnly
          fullWidth
          maxRows={20}
        />
      ) : null}
    </>
  )
}
