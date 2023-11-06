import React from 'react'
import { getSession } from '@jbrowse/core/util'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'

// icons
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'

// locals
import { locationLinkClick } from '../../components/util'

export default function FeatureMenu({
  value,
  model,
  arg,
}: {
  value: string
  model: {
    assemblyName?: string
  }
  arg: unknown
}) {
  console.log({ arg, value })
  return (
    <CascadingMenuButton
      menuItems={[
        {
          label: 'Open in linear genome view',
          onClick: async () => {
            try {
              await locationLinkClick(model, value)
            } catch (e) {
              console.error(e)
              getSession(model).notify(`${e}`, 'error')
            }
          },
        },
      ]}
    >
      <ArrowDropDownIcon />
    </CascadingMenuButton>
  )
}
