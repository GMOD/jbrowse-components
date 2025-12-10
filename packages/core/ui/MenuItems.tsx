import { makeStyles } from '@jbrowse/core/util/tss-react'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'
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

const useStyles = makeStyles()({
  menuItemEndDecoration: {
    padding: 0,
    margin: 0,
    height: 16,
  },
})

interface MenuItemEndDecorationSubMenuProps {
  type: 'subMenu'
}

interface MenuItemEndDecorationSelectorProps {
  type: 'checkbox' | 'radio'
  checked: boolean
  disabled?: boolean
}

type MenuItemEndDecorationProps =
  | MenuItemEndDecorationSubMenuProps
  | MenuItemEndDecorationSelectorProps

export function MenuItemEndDecoration(props: MenuItemEndDecorationProps) {
  const { classes } = useStyles()
  const { type } = props
  let checked: boolean | undefined
  let disabled: boolean | undefined
  if ('checked' in props) {
    ;({ checked, disabled } = props)
  }
  let icon: React.ReactElement
  switch (type) {
    case 'subMenu': {
      icon = <ArrowRightIcon color="action" />
      break
    }
    case 'checkbox': {
      if (checked) {
        const color = disabled ? 'inherit' : undefined
        icon = <CheckBoxIcon color={color} />
      } else {
        icon = <CheckBoxOutlineBlankIcon color="action" />
      }
      break
    }
    case 'radio': {
      if (checked) {
        const color = disabled ? 'inherit' : undefined
        icon = <RadioButtonCheckedIcon color={color} />
      } else {
        icon = <RadioButtonUncheckedIcon color="action" />
      }
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
