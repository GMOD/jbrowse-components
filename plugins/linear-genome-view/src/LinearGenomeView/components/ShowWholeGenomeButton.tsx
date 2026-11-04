import { CascadingMenuButton } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { Button, ButtonGroup } from '@mui/material'
import { observer } from 'mobx-react'

import {
  everyRegionMenuItems,
  showWholeGenomeLabel,
} from '../showWholeGenome.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ButtonProps } from '@mui/material'

const DropDownHalf = observer(function DropDownHalf(props: ButtonProps) {
  return <Button {...props} size="small" />
})

/**
 * The import form's way into the whole genome. Where the assembly's whole
 * genome is its chromosomes and leaves regions out, a dropdown at its end
 * shows every region instead.
 */
const ShowWholeGenomeButton = observer(function ShowWholeGenomeButton({
  model,
  assemblyName,
  disabled,
  className,
}: {
  model: LinearGenomeViewModel
  assemblyName: string | undefined
  disabled: boolean
  className: string
}) {
  const assembly = assemblyName
    ? getSession(model).assemblyManager.get(assemblyName)
    : undefined
  const everyRegion = everyRegionMenuItems(assembly, () => {
    model.setError(undefined)
    model.showEveryRegionInAssembly(assemblyName)
  })
  return (
    <ButtonGroup
      variant="contained"
      color="secondary"
      disabled={disabled}
      className={className}
    >
      <Button
        onClick={() => {
          model.setError(undefined)
          model.showAllRegionsInAssembly(assemblyName)
        }}
      >
        {showWholeGenomeLabel(assembly)}
      </Button>
      {everyRegion.length ? (
        <CascadingMenuButton
          menuItems={everyRegion}
          ButtonComponent={DropDownHalf}
          disabled={disabled}
          aria-label="More ways to show the whole genome"
          data-testid="show-whole-genome-more"
        >
          <ArrowDropDownIcon />
        </CascadingMenuButton>
      ) : null}
    </ButtonGroup>
  )
})

export default ShowWholeGenomeButton
