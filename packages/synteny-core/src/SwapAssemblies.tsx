import { makeStyles } from '@jbrowse/core/util/tss-react'
import HelpIcon from '@mui/icons-material/Help'
import { Button, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { helpStrings } from './SelectorTypes.ts'

import type { ReactNode } from 'react'

export interface SwapAssembliesProps {
  assembly1: string
  assembly2: string
  swap: boolean
  setSwap: (swap: boolean) => void
  radioOption: string
  helpContent?: ReactNode
  text1: string
  text2: string
}

const useStyles = makeStyles()({
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
  },
  swap: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 4,
    alignItems: 'center',
  },
})

const SwapAssemblies = observer(function SwapAssemblies({
  assembly1,
  assembly2,
  swap,
  setSwap,
  radioOption,
  helpContent,
  text1,
  text2,
}: SwapAssembliesProps) {
  const { classes } = useStyles()
  return assembly1 === assembly2 ? null : (
    <div>
      <div className={classes.row}>
        <div className={classes.swap}>
          <div>
            <i>{swap ? assembly2 : assembly1}</i>
          </div>
          <div>{text1}</div>
          <div>
            <i>{swap ? assembly1 : assembly2}</i>
          </div>
          <div>{text2}</div>
        </div>
        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            setSwap(!swap)
          }}
        >
          Swap
        </Button>
        <Tooltip title={helpContent || <code>{helpStrings[radioOption]}</code>}>
          <HelpIcon />
        </Tooltip>
      </div>
    </div>
  )
})

export default SwapAssemblies
