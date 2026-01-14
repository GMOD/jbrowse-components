import type { ReactNode } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import HelpIcon from '@mui/icons-material/Help'
import { Button, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { helpStrings } from './SelectorTypes.ts'

export interface SwapAssembliesProps {
  assembly1?: string
  assembly2?: string
  swap?: boolean
  setSwap?: (arg: boolean) => void
  radioOption: string
  helpContent?: ReactNode
  text1: string
  text2: string
}

const useStyles = makeStyles()({
  row: {
    display: 'flex',
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
  return (
    <div>
      <div>
        Verify or click swap
        <Tooltip title={helpContent || <code>{helpStrings[radioOption]}</code>}>
          <HelpIcon />
        </Tooltip>
      </div>
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
          variant="contained"
          onClick={() => {
            if (setSwap) {
              setSwap(!swap)
            }
          }}
        >
          Swap?
        </Button>
      </div>
    </div>
  )
})

export default SwapAssemblies
