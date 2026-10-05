import { Fragment } from 'react'

import PopoverPicker from '@jbrowse/core/ui/PopoverPicker'
import { NO_VALUE_LABEL } from '@jbrowse/core/util/categoricalField'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'

import { rowColorChoiceLabel } from '../rowColorChoice.ts'

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
 * The `unknown` swatch: the colour every row or value with no pair of its own
 * takes; `''` for none from this setting; or undefined for automatic, the
 * palette where it deals and the row's own colour otherwise.
 */
export interface OtherColor {
  color: string | undefined
  onChange: (color: string | undefined) => void
}

function rowCount(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? 'row' : 'rows'}`
}

// The swatch picks a colour; Auto and None are the two states it cannot show,
// pressed while they hold. None is offered only where it differs from Auto.
function OtherControls({
  other,
  offersNone,
  label,
  count,
}: {
  other: OtherColor
  offersNone: boolean
  label: string
  count?: string
}) {
  const { classes } = useStyles()
  return (
    <>
      <PopoverPicker
        color={other.color || 'auto'}
        unset={!other.color}
        onChange={other.onChange}
      />
      <Typography variant="body2">{label}</Typography>
      <div className={classes.cell}>
        {count ? (
          <Typography
            variant="body2"
            color="textSecondary"
            data-testid="other-count"
          >
            {count}
          </Typography>
        ) : null}
        <ToggleButtonGroup
          exclusive
          size="small"
          aria-label={label}
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', py: 0 } }}
          value={
            other.color === undefined
              ? 'auto'
              : other.color === ''
                ? 'none'
                : null
          }
          onChange={(_event, value: string | null) => {
            if (value !== null) {
              other.onChange(value === 'auto' ? undefined : '')
            }
          }}
        >
          <ToggleButton value="auto" aria-label={`${label}: auto`}>
            Auto
          </ToggleButton>
          {offersNone ? (
            <ToggleButton value="none" aria-label={`${label}: none`}>
              None
            </ToggleButton>
          ) : null}
        </ToggleButtonGroup>
      </div>
    </>
  )
}

/**
 * What the rows are coloured by, above the rows: nothing, each row its own
 * colour, picked in the row list, or an attribute, whose values are listed
 * with their colours to pick. Either way the rest take the Other colour.
 */
export default function RowColorPanel({
  fields,
  choice,
  values,
  other,
  dealsByRow,
  onChoice,
  onValueColor,
  onClear,
}: {
  fields: readonly string[]
  choice: string
  values: ValueColor[]
  // Undefined under None, which colours nothing.
  other?: OtherColor
  // Whether Each row deals a palette colour to the rows with none picked, so
  // its Other None differs from Auto.
  dealsByRow: boolean
  onChoice: (choice: string) => void
  onValueColor: (value: string, color: string) => void
  onClear: () => void
}) {
  const { classes } = useStyles()
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
          aria-label="Color rows by"
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none' } }}
          value={choice}
          onChange={(_event, value: string | null) => {
            if (value !== null) {
              onChoice(value)
            }
          }}
        >
          {['', 'name', ...fields].map(value => (
            <ToggleButton key={value} value={value}>
              {rowColorChoiceLabel(value)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
      {!other ? (
        <Typography variant="body2" color="textSecondary">
          Rows show the colors their data gives them.
        </Typography>
      ) : choice === 'name' ? (
        <>
          <Typography variant="body2" color="textSecondary">
            {dealsByRow && other.color === undefined
              ? 'Each row takes a palette color. Click a swatch in the list to change one.'
              : 'Click a swatch in the list to color a row.'}
          </Typography>
          <div className={classes.line}>
            <OtherControls
              other={other}
              offersNone={dealsByRow}
              label="Other rows"
            />
            <Button size="small" onClick={onClear}>
              Clear row colors
            </Button>
          </div>
        </>
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
                <Typography variant="body2">
                  {value || NO_VALUE_LABEL}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {rowCount(count)}
                </Typography>
              </Fragment>
            ))}
            <OtherControls
              other={other}
              offersNone
              label="Other values"
              count={
                other.color === undefined ? undefined : rowCount(otherCount)
              }
            />
          </div>
          <div>
            <Button size="small" onClick={onClear}>
              Clear {rowColorChoiceLabel(choice)} colors
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
