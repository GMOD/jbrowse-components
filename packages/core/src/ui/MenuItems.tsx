import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import {
  CircularProgress,
  ListItemIcon,
  ListItemText,
  MenuItem,
} from '@mui/material'

import { makeStyles } from '../util/tss-react/index.ts'

const useStyles = makeStyles()({
  menuItemEndDecoration: {
    padding: 0,
    margin: 0,
    height: 16,
  },
})

export function MenuItemEndDecoration({
  type,
  checked,
  disabled,
}: {
  type: 'checkbox' | 'radio'
  checked: boolean
  disabled?: boolean
}) {
  const { classes } = useStyles()
  const color = disabled && checked ? 'inherit' : undefined
  let icon: React.ReactElement
  switch (type) {
    case 'checkbox': {
      icon = checked ? (
        <CheckBoxIcon color={color} />
      ) : (
        <CheckBoxOutlineBlankIcon color="action" />
      )
      break
    }
    case 'radio': {
      icon = checked ? (
        <RadioButtonCheckedIcon color={color} />
      ) : (
        <RadioButtonUncheckedIcon color="action" />
      )
      break
    }
  }
  return <div className={classes.menuItemEndDecoration}>{icon}</div>
}

export function LoadingMenuItem() {
  return (
    <MenuItem disabled>
      <ListItemIcon>
        <CircularProgress size={20} />
      </ListItemIcon>
      <ListItemText primary="Loading..." />
    </MenuItem>
  )
}

export function ErrorMenuItem({ error }: { error: unknown }) {
  return (
    <MenuItem disabled>
      <ListItemText
        primary="Error loading menu"
        secondary={error instanceof Error ? error.message : String(error)}
      />
    </MenuItem>
  )
}
