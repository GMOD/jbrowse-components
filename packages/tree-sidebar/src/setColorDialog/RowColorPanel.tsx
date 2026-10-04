import { Fragment } from 'react'

import PopoverPicker from '@jbrowse/core/ui/PopoverPicker'
import { capitalizeFirst } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'

const useStyles = makeStyles()(theme => ({
  panel: {
    display: 'grid',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  line: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  cell: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  values: {
    display: 'grid',
    gridTemplateColumns: 'auto auto 1fr',
    alignItems: 'center',
    columnGap: theme.spacing(2),
    rowGap: theme.spacing(0.5),
    maxHeight: 220,
    overflowY: 'auto',
  },
}))

export interface ValueColor {
  value: string
  count: number
  /** As dealt: a pair's where `paired`, else the Other colour or the palette's. */
  color: string | undefined
  paired: boolean
}

/**
 * The `unknown` swatch: the one colour every row or value no swatch of its own
 * names takes; `''` for none from this setting; or undefined for automatic,
 * the palette where it deals and the row's own colour otherwise.
 */
export interface OtherColor {
  color: string | undefined
  onChange: (color: string) => void
  onClear: () => void
}

function rowCount(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? 'row' : 'rows'}`
}

/**
 * What the rows are coloured by, above the rows: no palette, a palette colour
 * each where the display deals one, or an attribute, whose values are listed
 * with their colours to edit.
 */
export default function RowColorPanel({
  eachRow,
  fields,
  choice,
  values,
  other,
  onChoice,
  onValueColor,
  onResetValues,
  onStartFrom,
  onClearRows,
}: {
  eachRow: boolean
  fields: readonly string[]
  choice: string
  values: ValueColor[]
  // Undefined where the choice fixes `unknown`: None with a palette dealing.
  other?: OtherColor
  onChoice: (choice: string) => void
  onValueColor: (value: string, color: string) => void
  onResetValues: () => void
  onStartFrom: (field: string) => void
  onClearRows: () => void
}) {
  const { classes } = useStyles()
  // `''` draws as an empty swatch with a solid border: a colour, none, rather
  // than the dashed automatic.
  const otherSwatch = other ? (
    <PopoverPicker
      color={other.color ?? 'auto'}
      unset={other.color === undefined}
      onChange={other.onChange}
    />
  ) : null
  // The way back to automatic, which the picker itself has no entry for.
  const otherAuto =
    other && other.color !== undefined ? (
      <Button size="small" onClick={other.onClear}>
        Auto
      </Button>
    ) : null
  const otherCount = values
    .filter(({ value, paired }) => value !== '' && !paired)
    .reduce((sum, { count }) => sum + count, 0)
  return (
    <div className={classes.panel}>
      <div className={classes.line}>
        <Typography variant="subtitle2">Color rows by</Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none' } }}
          value={choice}
          onChange={(_event, value: string | null) => {
            if (value !== null) {
              onChoice(value)
            }
          }}
        >
          <ToggleButton value="">None</ToggleButton>
          {eachRow ? <ToggleButton value="name">Each row</ToggleButton> : null}
          {fields.map(field => (
            <ToggleButton key={field} value={field}>
              {capitalizeFirst(field)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
      {choice === '' || choice === 'name' ? (
        <div className={classes.line}>
          <Typography variant="body2" color="textSecondary">
            {choice === ''
              ? 'Rows show the colors their data gives them. Click a swatch in the list to color one row.'
              : other?.color
                ? 'Each row takes the Other color. Click a swatch in the list to change one.'
                : 'Each row takes a palette color. Click a swatch in the list to change one.'}
          </Typography>
          {otherSwatch ? (
            <>
              {otherSwatch}
              <Typography variant="body2">Other rows</Typography>
              {otherAuto}
            </>
          ) : null}
          {fields.length ? (
            <TextField
              select
              size="small"
              variant="outlined"
              label="Start from"
              value=""
              sx={{ minWidth: 200 }}
              onChange={event => {
                onStartFrom(event.target.value)
              }}
            >
              {fields.map(field => (
                <MenuItem key={field} value={field}>
                  {capitalizeFirst(field)} colors
                </MenuItem>
              ))}
            </TextField>
          ) : null}
          <Button size="small" onClick={onClearRows}>
            Clear row colors
          </Button>
        </div>
      ) : (
        <>
          <div className={classes.values} data-testid="row-color-values">
            {values.map(({ value, count, color, paired }) => (
              <Fragment key={value}>
                <PopoverPicker
                  color={color ?? 'auto'}
                  unset={!paired}
                  onChange={next => {
                    onValueColor(value, next)
                  }}
                />
                <Typography variant="body2">{value || '(no value)'}</Typography>
                <Typography variant="body2" color="textSecondary">
                  {rowCount(count)}
                </Typography>
              </Fragment>
            ))}
            {other ? (
              <>
                {otherSwatch}
                <Typography variant="body2">Other values</Typography>
                <div className={classes.cell}>
                  <Typography variant="body2" color="textSecondary">
                    {rowCount(otherCount)}
                  </Typography>
                  {otherAuto}
                </div>
              </>
            ) : null}
          </div>
          <div>
            <Button size="small" onClick={onResetValues}>
              Reset {capitalizeFirst(choice)} colors
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
