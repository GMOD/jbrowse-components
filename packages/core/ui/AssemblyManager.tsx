import React from 'react'
import { makeStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableContainer from '@material-ui/core/TableContainer'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import Paper from '@material-ui/core/Paper'

const useStyles = makeStyles(() => ({
  titleBox: {
    color: '#FFFFFF',
    backgroundColor: '#0D233F',
  },
  table: {
    minWidth: 650,
  },
}))

// remember to make observable
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AssemblyTable(props: any) {
  const { rootModel } = props
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = rootModel.jbrowse.assemblies.map((assembly: any) => {
    const { name } = assembly
    return (
      <TableRow>
        <TableCell>{name}</TableCell>
      </TableRow>
    )
  })

  return (
    <TableContainer component={Paper}>
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Aliases</TableCell>
        </TableRow>
      </TableHead>
      <Table>
        <TableBody>{rows}</TableBody>
      </Table>
    </TableContainer>
  )
}

const AssemblyManager = ({
  rootModel,
  open,
  onClose,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rootModel: any
  open: boolean
  onClose: Function
}) => {
  const classes = useStyles()

  return (
    <Dialog open={open}>
      <DialogTitle className={classes.titleBox}>Assembly Manager</DialogTitle>
      <DialogContent>
        <AssemblyTable rootModel={rootModel} />
      </DialogContent>
      <DialogActions>
        <Button
          color="secondary"
          variant="contained"
          onClick={() => {
            onClose(false)
          }}
        >
          OK
        </Button>
        <Button
          color="secondary"
          variant="contained"
          onClick={() => {
            onClose(false)
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// remember to make observable
export default AssemblyManager
