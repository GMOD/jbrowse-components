import { makeStyles } from '@jbrowse/core/util/tss-react'
import DeleteIcon from '@mui/icons-material/Delete'
import { Card, CardContent, CardHeader, IconButton } from '@mui/material'
import { observer } from 'mobx-react'

import AddNewField from './AddNewField.tsx'

const useStyles = makeStyles()(theme => ({
  card: {
    marginTop: theme.spacing(1),
  },
}))

// shared card for a single key in a map slot editor: a titled card with a
// delete button wrapping the per-value editor passed as children
const MapEntryCard = observer(function MapEntryCard({
  title,
  onDelete,
  children,
}: {
  title: string
  onDelete: () => void
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  return (
    <Card raised className={classes.card}>
      <CardHeader
        title={title}
        action={
          <IconButton
            onClick={() => {
              onDelete()
            }}
          >
            <DeleteIcon />
          </IconButton>
        }
      />
      <CardContent>{children}</CardContent>
    </Card>
  )
})

export default MapEntryCard

// trailing card in a map slot editor holding the "add new key" field
export const MapAddCard = observer(function MapAddCard({
  onAdd,
}: {
  onAdd: (key: string) => void
}) {
  const { classes } = useStyles()
  return (
    <Card raised className={classes.card}>
      <CardHeader disableTypography title={<AddNewField onAdd={onAdd} />} />
    </Card>
  )
})
