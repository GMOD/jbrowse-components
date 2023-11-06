import React from 'react'
import { Link } from '@mui/material'
import { getSession } from '@jbrowse/core/util'

// locals
import { locationLinkClick } from '../../components/util'

export default function LocString({
  value,
  model,
}: {
  value: string
  model: { assemblyName?: string }
}) {
  return (
    <Link
      href="#"
      onClick={async event => {
        try {
          event.preventDefault()
          await locationLinkClick(model, value)
        } catch (e) {
          console.error(e)
          getSession(model).notify(`${e}`, 'error')
        }
      }}
    >
      {value}
    </Link>
  )
}
