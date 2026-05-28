import { AssemblySelector } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import { IconButton, TextField, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { AbstractSessionModel } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  loc: {
    flexGrow: 1,
  },
}))

const ImportFormRow = observer(function ImportFormRow({
  idx,
  count,
  assembly,
  loc,
  session,
  onAssemblyChange,
  onLocChange,
  onRemove,
  onMove,
}: {
  idx: number
  count: number
  assembly: string
  loc: string
  session: AbstractSessionModel
  onAssemblyChange: (val: string) => void
  onLocChange: (val: string) => void
  onRemove: () => void
  onMove: (delta: number) => void
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.row}>
      <span>Row {idx + 1}:</span>
      <AssemblySelector
        helperText=""
        selected={assembly}
        onChange={val => {
          onAssemblyChange(val)
        }}
        session={session}
      />
      <TextField
        className={classes.loc}
        value={loc}
        placeholder="e.g. chr1:1,000-2,000 (optional, blank = whole assembly)"
        onChange={event => {
          onLocChange(event.target.value)
        }}
      />
      <IconButton
        disabled={idx === 0}
        onClick={() => {
          onMove(-1)
        }}
      >
        <KeyboardArrowUpIcon />
      </IconButton>
      <IconButton
        disabled={idx === count - 1}
        onClick={() => {
          onMove(1)
        }}
      >
        <KeyboardArrowDownIcon />
      </IconButton>
      <Tooltip
        title={
          count <= 2
            ? 'Breakpoint split view requires at least 2 rows'
            : 'Remove this row'
        }
      >
        <span>
          <IconButton
            disabled={count <= 2}
            onClick={() => {
              onRemove()
            }}
          >
            <CloseIcon />
          </IconButton>
        </span>
      </Tooltip>
    </div>
  )
})

export default ImportFormRow
