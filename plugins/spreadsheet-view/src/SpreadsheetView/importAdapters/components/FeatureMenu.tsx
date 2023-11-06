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
}: {
  value: string
  model: { assemblyName?: string }
}) {
  return (
    <CascadingMenuButton
      menuItems={[
        {
          label: 'hello',
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
