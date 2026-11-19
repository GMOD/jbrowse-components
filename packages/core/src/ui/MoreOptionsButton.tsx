import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

const MoreOptionsButton = observer(function MoreOptionsButton({
  open,
  setOpen,
}: {
  open: boolean
  setOpen: (arg: boolean) => void
}) {
  return (
    <Button
      variant="text"
      size="small"
      aria-expanded={open}
      startIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      onClick={() => {
        setOpen(!open)
      }}
    >
      {open ? 'Fewer options' : 'More options'}
    </Button>
  )
})

export default MoreOptionsButton
