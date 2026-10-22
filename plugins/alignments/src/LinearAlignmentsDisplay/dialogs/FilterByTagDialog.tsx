import { Fragment, useState } from 'react'

import { samFlagDescriptions, samFlagLabels } from '@jbrowse/cigar-utils'
import { Dialog, TagTextField } from '@jbrowse/core/ui'
import { lowerBoundOf, withLowerBound } from '@jbrowse/core/util/fieldPredicate'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Button,
  Checkbox,
  Collapse,
  DialogActions,
  DialogContent,
  IconButton,
  Link,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import {
  DEFAULT_FLAG_MASKS,
  entriesOn,
  flagEntries,
  flagMasksOf,
  readNameOf,
  tagEntries,
  tagFiltersOf,
} from '../../shared/alignmentsFilter.ts'

import type { TagFilter } from '../../shared/types.ts'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

const useStyles = makeStyles()(theme => ({
  paper: {
    padding: theme.spacing(1),
    margin: theme.spacing(1),
  },
  field: {
    margin: theme.spacing(1),
  },
  tagRow: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'flex-start',
    marginTop: theme.spacing(1),
  },
  // `auto` for the label column and `justifyContent: start`, NOT `1fr`: a
  // fraction hands it every spare pixel of the dialog, which put ~450px of
  // whitespace between "read paired" and the box that answers for it — the
  // wide-table problem, where the eye loses the row on the way across. Sizing
  // to the longest label keeps each row readable as one line.
  grid: {
    display: 'grid',
    alignItems: 'center',
    justifyContent: 'start',
    columnGap: theme.spacing(2),
  },
  flagGrid: {
    gridTemplateColumns: 'auto repeat(2, auto)',
  },
  heading: {
    textAlign: 'center',
  },
  maskRow: {
    display: 'flex',
    gap: theme.spacing(2),
    margin: theme.spacing(1, 0),
  },
  checkbox: {
    margin: 0,
    padding: theme.spacing(0.25),
    justifySelf: 'center',
  },
  sectionButton: {
    justifyContent: 'flex-start',
    textTransform: 'none',
  },
}))

function toggleBit(flag: number, index: number, checked: boolean) {
  return checked ? flag | (1 << index) : flag & ~(1 << index)
}

const MaskField = observer(function MaskField(props: {
  label: string
  flag: number
  setFlag: (arg: number) => void
}) {
  const { label, flag, setFlag } = props
  return (
    <TextField
      label={label}
      size="small"
      value={flag}
      onChange={event => {
        // Whole numbers only. `Number.isFinite` let "1.5" and "1e3" through:
        // the field then showed 1.5 while every `flag & (1 << i)` below read
        // it as 1, so the checkboxes and the number disagreed.
        const n = Number(event.target.value)
        if (Number.isInteger(n) && n >= 0) {
          setFlag(n)
        }
      }}
    />
  )
})

// One row per SAM flag with a Require and an Exclude box, rather than two
// twelve-checkbox columns each captioned with a sentence. Half the height, the
// flag named once, and the contradiction a user can otherwise build without
// noticing — the same flag required AND excluded, which empties the track — is
// now two ticks on one line.
const FlagFilterSection = observer(function FlagFilterSection(props: {
  flagInclude: number
  flagExclude: number
  setFlagInclude: (arg: number) => void
  setFlagExclude: (arg: number) => void
}) {
  const { classes, cx } = useStyles()
  const { flagInclude, flagExclude, setFlagInclude, setFlagExclude } = props
  const atDefault =
    flagInclude === DEFAULT_FLAG_MASKS.include &&
    flagExclude === DEFAULT_FLAG_MASKS.exclude
  // Open when it is doing something beyond the default. The masks are the
  // dialog's expert control and its tallest section, so it stays out of the way
  // of the fields above until a track is actually filtered by one.
  const [open, setOpen] = useState(!atDefault)
  const site = 'https://broadinstitute.github.io/picard/explain-flags.html'

  return (
    <Paper className={classes.paper} variant="outlined">
      <Button
        fullWidth
        color="inherit"
        className={classes.sectionButton}
        endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        onClick={() => {
          setOpen(!open)
        }}
      >
        SAM flags
      </Button>
      <Collapse in={open}>
        <Typography variant="body2">
          A read must have every Require flag and none of the Exclude flags.
          Refer to <Link href={site}>{site}</Link> for details.
        </Typography>
        <div className={classes.maskRow}>
          <MaskField
            label="Require mask"
            flag={flagInclude}
            setFlag={setFlagInclude}
          />
          <MaskField
            label="Exclude mask"
            flag={flagExclude}
            setFlag={setFlagExclude}
          />
        </div>
        <div className={cx(classes.grid, classes.flagGrid)}>
          <span />
          <Typography variant="caption" className={classes.heading}>
            Require
          </Typography>
          <Typography variant="caption" className={classes.heading}>
            Exclude
          </Typography>
          {samFlagLabels.map((name, index) => (
            <Fragment key={name}>
              <label title={samFlagDescriptions[index]}>{name}</label>
              <Checkbox
                size="small"
                className={classes.checkbox}
                checked={Boolean(flagInclude & (1 << index))}
                onChange={event => {
                  setFlagInclude(
                    toggleBit(flagInclude, index, event.target.checked),
                  )
                }}
                slotProps={{ input: { 'aria-label': `Require ${name}` } }}
              />
              <Checkbox
                size="small"
                className={classes.checkbox}
                checked={Boolean(flagExclude & (1 << index))}
                onChange={event => {
                  setFlagExclude(
                    toggleBit(flagExclude, index, event.target.checked),
                  )
                }}
                slotProps={{ input: { 'aria-label': `Exclude ${name}` } }}
              />
            </Fragment>
          ))}
        </div>
      </Collapse>
    </Paper>
  )
})

interface TagRow {
  id: number
  tag: string
  value: string
}

function tagRowsOf(tags: readonly TagFilter[]): TagRow[] {
  return tags.length > 0
    ? tags.map((f, id) => ({ id, tag: f.tag, value: f.value ?? '' }))
    : [{ id: 0, tag: '', value: '' }]
}

// One row per tag filter, AND-ed. TagTextField is uncontrolled, so each row is
// keyed by a stable id rather than its index.
const TagFilterSection = observer(function TagFilterSection(props: {
  rows: TagRow[]
  setRows: (rows: TagRow[]) => void
}) {
  const { classes } = useStyles()
  const { rows, setRows } = props
  const update = (id: number, patch: Partial<TagRow>) => {
    setRows(rows.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  return (
    <Paper className={classes.paper} variant="outlined">
      <Typography>Filter by tag</Typography>
      <Typography variant="body2" color="text.secondary">
        Keeps only reads that carry every tag with its value.
      </Typography>
      {rows.map(row => (
        <div key={row.id} className={classes.tagRow}>
          <TagTextField
            variant="outlined"
            size="small"
            defaultValue={row.tag}
            helperText="e.g. HP, RG, NM"
            onValueChange={value => {
              update(row.id, { tag: value ?? '' })
            }}
          />
          <TextField
            label="Tag value"
            variant="outlined"
            size="small"
            margin="none"
            value={row.value}
            placeholder="any"
            helperText="Empty matches any value"
            onChange={event => {
              update(row.id, { value: event.target.value })
            }}
          />
          {rows.length > 1 ? (
            <IconButton
              aria-label="Remove tag filter"
              onClick={() => {
                setRows(rows.filter(r => r.id !== row.id))
              }}
            >
              <CloseIcon />
            </IconButton>
          ) : null}
        </div>
      ))}
      <Button
        size="small"
        onClick={() => {
          setRows([
            ...rows,
            { id: Math.max(...rows.map(r => r.id)) + 1, tag: '', value: '' },
          ])
        }}
      >
        Add tag filter
      </Button>
    </Paper>
  )
})

const ReadNameFilterSection = observer(function ReadNameFilterSection(props: {
  readName: string
  setReadName: (arg: string) => void
}) {
  const { classes } = useStyles()
  const { readName, setReadName } = props

  return (
    <Paper className={classes.paper} variant="outlined">
      <Typography>Filter by read name</Typography>
      <TextField
        className={classes.field}
        fullWidth
        variant="outlined"
        size="small"
        value={readName}
        placeholder="Enter read name"
        onChange={event => {
          setReadName(event.target.value)
        }}
      />
    </Paper>
  )
})

const MapqFilterSection = observer(function MapqFilterSection(props: {
  minMapq: string
  setMinMapq: (arg: string) => void
}) {
  const { classes } = useStyles()
  const { minMapq, setMinMapq } = props

  return (
    <Paper className={classes.paper} variant="outlined">
      <Typography>Minimum mapping quality</Typography>
      <TextField
        className={classes.field}
        variant="outlined"
        size="small"
        type="number"
        value={minMapq}
        placeholder="Any"
        slotProps={{ htmlInput: { min: 0, max: 254 } }}
        onChange={event => {
          setMinMapq(event.target.value)
        }}
      />
    </Paper>
  )
})

// The filters a user TYPES: a read name, a minimum mapping quality, a tag and its value, and the flag
// masks. The four read categories are picked off a list instead, so they are
// rows in the "Filter by..." submenu and are deliberately not repeated here —
// one control, one home, and one commitment model. Offering them in both places
// meant the same filter applied on click in the menu and only on Submit here,
// with Cancel undoing one and not the other.
//
// Which is also why this dialog's Submit and Reset touch only the fields
// below: everything it does not show, it preserves. The menu's "Clear all
// filters" is what resets the whole filter.
//
// Sections run in the order a user reaches for them, the flag masks last —
// they used to open the dialog and outweigh the rest of it put together.
const FilterByTagDialog = observer(function FilterByTagDialog(props: {
  model: {
    filterPredicates: FieldPredicate[]
    setFilterFields: (
      patch: Readonly<Record<string, readonly FieldPredicate[] | undefined>>,
    ) => void
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const predicates = model.filterPredicates
  const [flagInclude, setFlagInclude] = useState(
    () => flagMasksOf(predicates).include,
  )
  const [flagExclude, setFlagExclude] = useState(
    () => flagMasksOf(predicates).exclude,
  )
  const [tagRows, setTagRows] = useState(() =>
    tagRowsOf(tagFiltersOf(predicates)),
  )
  const [readName, setReadName] = useState(readNameOf(predicates) ?? '')
  const [minMapq, setMinMapq] = useState(() => {
    const floor = lowerBoundOf(predicates, 'mapq')
    return floor === undefined ? '' : `${floor}`
  })

  const handleReset = () => {
    setFlagInclude(DEFAULT_FLAG_MASKS.include)
    setFlagExclude(DEFAULT_FLAG_MASKS.exclude)
    setTagRows([
      { id: Math.max(...tagRows.map(r => r.id)) + 1, tag: '', value: '' },
    ])
    setReadName('')
    setMinMapq('')
  }

  const handleSubmit = () => {
    // An empty value box is an unset value, which passes any read carrying
    // the tag (`valid: true`)
    const tags = tagRows
      .filter(r => r.tag !== '')
      .map(r =>
        r.value === '' ? { tag: r.tag } : { tag: r.tag, value: r.value },
      )
    const floor =
      minMapq === '' || !Number.isFinite(Number(minMapq))
        ? undefined
        : Number(minMapq)
    // The fields this dialog shows and no others, so the read categories the
    // track menu edits carry through a Submit.
    model.setFilterFields({
      ...flagEntries(flagInclude, flagExclude),
      ...tagEntries(predicates, tags),
      name: readName === '' ? [] : [{ field: 'name', equal: readName }],
      mapq: withLowerBound(entriesOn(predicates, 'mapq'), 'mapq', floor),
    })
    handleClose()
  }

  return (
    <Dialog
      open
      onClose={() => {
        handleClose()
      }}
      title="Filter options"
    >
      {/* Form wrapper gives Enter-to-submit, like SubmitDialog. Reset/Cancel are
      MUI-default type="button" so they don't submit; only the primary does. */}
      <form
        onSubmit={event => {
          event.preventDefault()
          handleSubmit()
        }}
      >
        <DialogContent>
          <ReadNameFilterSection
            readName={readName}
            setReadName={setReadName}
          />
          <MapqFilterSection minMapq={minMapq} setMinMapq={setMinMapq} />
          <TagFilterSection rows={tagRows} setRows={setTagRows} />
          <FlagFilterSection
            flagInclude={flagInclude}
            flagExclude={flagExclude}
            setFlagInclude={setFlagInclude}
            setFlagExclude={setFlagExclude}
          />
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            onClick={() => {
              handleReset()
            }}
          >
            Reset defaults
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              handleClose()
            }}
          >
            Cancel
          </Button>
          <Button variant="contained" color="primary" autoFocus type="submit">
            Submit
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
})

export default FilterByTagDialog
