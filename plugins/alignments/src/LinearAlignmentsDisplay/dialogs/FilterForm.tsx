import { makeStyles } from '@jbrowse/core/util/tss-react'
import { MenuItem, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { CategoryFilter } from '@jbrowse/display-kit/categoryFilter'

// One grid for the whole dialog, so every section's labels share a column and
// every control the same width.
const useStyles = makeStyles()(theme => ({
  form: {
    display: 'grid',
    gridTemplateColumns: 'max-content minmax(0, 300px)',
    justifyContent: 'start',
    alignItems: 'center',
    columnGap: theme.spacing(3),
    rowGap: theme.spacing(1.5),
  },
  heading: {
    gridColumn: '1 / -1',
    marginTop: theme.spacing(2),
    '&:first-of-type': {
      marginTop: 0,
    },
  },
  // zero width with a full-width floor, so a spanning paragraph wraps to the
  // columns instead of widening the label column to fit itself
  wide: {
    gridColumn: '1 / -1',
    width: 0,
    minWidth: '100%',
  },
}))

export const FilterForm = observer(function FilterForm({
  children,
}: {
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  return <div className={classes.form}>{children}</div>
})

export const FormHeading = observer(function FormHeading({
  children,
}: {
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  return (
    <Typography component="h3" variant="subtitle2" className={classes.heading}>
      {children}
    </Typography>
  )
})

/** A block spanning both columns, under a heading. */
export const FormWide = observer(function FormWide({
  children,
}: {
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  return <div className={classes.wide}>{children}</div>
})

export const FormRow = observer(function FormRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <>
      <Typography variant="body2">{label}</Typography>
      <div>{children}</div>
    </>
  )
})

const ALL = 'all'

// All / Only / Hide over one category, the menu's three radios as a select
export const CategoryRow = observer(function CategoryRow({
  label,
  all,
  only,
  exclude,
  value,
  onChange,
}: {
  label: string
  all: string
  only: string
  exclude: string
  value: CategoryFilter | undefined
  onChange: (value: CategoryFilter | undefined) => void
}) {
  return (
    <FormRow label={label}>
      <TextField
        variant="outlined"
        select
        size="small"
        fullWidth
        value={value ?? ALL}
        slotProps={{ htmlInput: { 'aria-label': label } }}
        onChange={event => {
          const v = event.target.value
          onChange(v === ALL ? undefined : (v as CategoryFilter))
        }}
      >
        <MenuItem value={ALL}>{all}</MenuItem>
        <MenuItem value="only">{only}</MenuItem>
        <MenuItem value="exclude">{exclude}</MenuItem>
      </TextField>
    </FormRow>
  )
})

export const NumberRow = observer(function NumberRow({
  label,
  value,
  min,
  max,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  min: number
  max?: number
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <FormRow label={label}>
      <TextField
        variant="outlined"
        size="small"
        type="number"
        fullWidth
        value={value}
        placeholder={placeholder}
        slotProps={{ htmlInput: { min, max, 'aria-label': label } }}
        onChange={event => {
          onChange(event.target.value)
        }}
      />
    </FormRow>
  )
})
