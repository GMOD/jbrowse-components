import React from 'react'
import { Link } from '@mui/material'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { MenuItem } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'

// icons
import MoreHoriz from '@mui/icons-material/MoreHoriz'

// locals
import { locationLinkClick } from '../../components/util'
import { SpreadsheetModel } from '../../models/Spreadsheet'

export default function LocString({
  value,
  model,
  row,
  getMenuItems,
}: {
  value: string
  model: SpreadsheetModel
  row: Record<string, unknown>
  getMenuItems: (arg: {
    model: SpreadsheetModel
    row: Record<string, unknown>
  }) => MenuItem[]
}) {
  return (
    <>
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
      <CascadingMenuButton menuItems={getMenuItems({ model, row })}>
        <MoreHoriz />
      </CascadingMenuButton>
    </>
  )
}
