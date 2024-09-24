import React from 'react'
import { Link } from '@mui/material'
import { AbstractSessionModel } from '@jbrowse/core/util'

// locals
import { locationLinkClick } from '../../components/util'

export default function LocString({
  value,
  assemblyName,
  session,
  spreadsheetViewId,
}: {
  value: string
  assemblyName: string
  session: AbstractSessionModel
  spreadsheetViewId: string
}) {
  return (
    <Link
      href="#"
      onClick={async event => {
        try {
          event.preventDefault()
          await locationLinkClick({
            spreadsheetViewId,
            session,
            locString: value,
            assemblyName,
          })
        } catch (e) {
          console.error(e)
          session.notifyError(`${e}`, e)
        }
      }}
    >
      {value}
    </Link>
  )
}
