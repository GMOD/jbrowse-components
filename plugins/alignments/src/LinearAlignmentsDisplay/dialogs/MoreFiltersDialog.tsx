import { Fragment, useState } from 'react'

import { samFlagDescriptions, samFlagLabels } from '@jbrowse/cigar-utils'
import { Dialog, TagTextField } from '@jbrowse/core/ui'
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
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import {
  DEFAULT_FLAG_MASKS,
  readFieldsEntries,
  readFieldsFormOf,
} from '../../shared/alignmentsFilter.ts'
import {
  CategoryRow,
  FilterForm,
  FormHeading,
  FormRow,
  FormWide,
  NumberRow,
} from './FilterForm.tsx'
import LayerFilterSections from './LayerFilterSections.tsx'
import {
  declaredLayerFilterState,
  layerBasesPatch,
  layerFilterEntries,
  layerFilterStateOf,
} from './layerFilters.ts'

import type { TagFilter } from '../../shared/types.ts'
import type { LayerFiltersModel } from './layerFilters.ts'
import type {
  FieldPredicate,
  FieldsPatch,
} from '@jbrowse/core/util/fieldPredicate'

const useStyles = makeStyles()(theme => ({
  tagRows: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
  },
  tagRow: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
    width: '100%',
  },
  tagName: {
    width: 90,
    flex: 'none',
  },
  // `auto` for the label column and `justifyContent: start`, NOT `1fr`: a
  // fraction hands it every spare pixel of the dialog, which put ~450px of
  // whitespace between "read paired" and the box that answers for it — the
  // wide-table problem, where the eye loses the row on the way across. Sizing
  // to the longest label keeps each row readable as one line.
  flagGrid: {
    display: 'grid',
    gridTemplateColumns: 'auto repeat(2, auto)',
    alignItems: 'center',
    justifyContent: 'start',
    columnGap: theme.spacing(2),
  },
  flagHeading: {
    textAlign: 'center',
  },
  maskRow: {
    display: 'flex',
    gap: theme.spacing(2),
    margin: theme.spacing(1.5, 0),
  },
  checkbox: {
    margin: 0,
    padding: theme.spacing(0.25),
    justifySelf: 'center',
  },
  sectionButton: {
    padding: 0,
    minWidth: 0,
    textTransform: 'none',
    font: 'inherit',
  },
}))

function toggleBit(flag: number, index: number, checked: boolean) {
  return checked ? flag | (1 << index) : flag & ~(1 << index)
}

function masksOverlap(include: number, exclude: number) {
  return (include & exclude) !== 0
}

const MaskField = observer(function MaskField(props: {
  label: string
  flag: number
  setFlag: (arg: number) => void
  error: boolean
}) {
  const { label, flag, setFlag, error } = props
  return (
    <TextField
      label={label}
      variant="outlined"
      size="small"
      value={flag}
      error={error}
      helperText={error ? 'A flag is both required and excluded' : undefined}
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

// One row per SAM flag with a Require and an Exclude box. The filter holds one
// `flags.X` entry per flag, so ticking one box clears the other, and masks
// typed to share a bit hold Submit until they don't.
const FlagFilterSection = observer(function FlagFilterSection(props: {
  flagInclude: number
  flagExclude: number
  setFlagInclude: (arg: number) => void
  setFlagExclude: (arg: number) => void
}) {
  const { classes } = useStyles()
  const { flagInclude, flagExclude, setFlagInclude, setFlagExclude } = props
  const overlap = masksOverlap(flagInclude, flagExclude)
  const atDefault =
    flagInclude === DEFAULT_FLAG_MASKS.include &&
    flagExclude === DEFAULT_FLAG_MASKS.exclude
  // Open when it is doing something beyond the default: the masks are the
  // dialog's expert control and its tallest section.
  const [open, setOpen] = useState(!atDefault)
  const site = 'https://broadinstitute.github.io/picard/explain-flags.html'

  return (
    <>
      <FormHeading>
        <Button
          color="inherit"
          className={classes.sectionButton}
          endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={() => {
            setOpen(!open)
          }}
        >
          SAM flags
        </Button>
      </FormHeading>
      <FormWide>
        <Collapse in={open}>
          <Typography variant="body2">
            A read must have every Require flag and none of the Exclude flags (
            <Link href={site}>flag reference</Link>).
          </Typography>
          <div className={classes.maskRow}>
            <MaskField
              label="Require mask"
              flag={flagInclude}
              setFlag={setFlagInclude}
              error={overlap}
            />
            <MaskField
              label="Exclude mask"
              flag={flagExclude}
              setFlag={setFlagExclude}
              error={overlap}
            />
          </div>
          <div className={classes.flagGrid}>
            <span />
            <Typography variant="caption" className={classes.flagHeading}>
              Require
            </Typography>
            <Typography variant="caption" className={classes.flagHeading}>
              Exclude
            </Typography>
            {samFlagLabels.map((name, index) => (
              <Fragment key={name}>
                <Typography variant="body2" title={samFlagDescriptions[index]}>
                  {name}
                </Typography>
                <Checkbox
                  size="small"
                  className={classes.checkbox}
                  checked={Boolean(flagInclude & (1 << index))}
                  onChange={event => {
                    setFlagInclude(
                      toggleBit(flagInclude, index, event.target.checked),
                    )
                    setFlagExclude(toggleBit(flagExclude, index, false))
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
                    setFlagInclude(toggleBit(flagInclude, index, false))
                  }}
                  slotProps={{ input: { 'aria-label': `Exclude ${name}` } }}
                />
              </Fragment>
            ))}
          </div>
        </Collapse>
      </FormWide>
    </>
  )
})

interface TagRow {
  id: number
  tag: string
  value: string
}

// An empty value box is an unset value, which passes any read carrying the
// tag (`valid: true`)
function tagsOfRows(rows: readonly TagRow[]): TagFilter[] {
  return rows
    .filter(r => r.tag !== '')
    .map(r =>
      r.value === '' ? { tag: r.tag } : { tag: r.tag, value: r.value },
    )
}

function tagRowsOf(tags: readonly TagFilter[]): TagRow[] {
  return tags.length > 0
    ? tags.map((f, id) => ({ id, tag: f.tag, value: f.value ?? '' }))
    : [{ id: 0, tag: '', value: '' }]
}

// The read fields as the boxes hold them: tag rows and the MAPQ text. Row ids
// start at `idBase`, so fresh ids remount the uncontrolled tag boxes.
interface ReadsForm {
  flagInclude: number
  flagExclude: number
  tagRows: TagRow[]
  readName: string
  minMapq: string
  mapqStrict: boolean
}

function readsFormOf(
  predicates: readonly FieldPredicate[],
  idBase = 0,
): ReadsForm {
  const { tags, minMapq, ...rest } = readFieldsFormOf(predicates)
  return {
    ...rest,
    tagRows: tagRowsOf(tags).map(r => ({ ...r, id: r.id + idBase })),
    minMapq: minMapq === undefined ? '' : `${minMapq}`,
  }
}

function readFieldsOf({ tagRows, minMapq, ...rest }: ReadsForm) {
  return {
    ...rest,
    tags: tagsOfRows(tagRows),
    minMapq:
      minMapq === '' || !Number.isFinite(Number(minMapq))
        ? undefined
        : Number(minMapq),
  }
}

// One row per tag filter, AND-ed: a read must carry every tag with its value.
// TagTextField is uncontrolled, so each row is keyed by a stable id rather
// than its index.
const TagFilterRows = observer(function TagFilterRows(props: {
  rows: TagRow[]
  setRows: (rows: TagRow[]) => void
}) {
  const { classes } = useStyles()
  const { rows, setRows } = props
  const update = (id: number, patch: Partial<TagRow>) => {
    setRows(rows.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  return (
    <FormRow label="Tags">
      <div className={classes.tagRows}>
        {rows.map(row => (
          <div key={row.id} className={classes.tagRow}>
            <TagTextField
              variant="outlined"
              size="small"
              label={undefined}
              inputAriaLabel="Tag name"
              placeholder="Tag"
              className={classes.tagName}
              defaultValue={row.tag}
              onValueChange={value => {
                update(row.id, { tag: value ?? '' })
              }}
            />
            <TextField
              variant="outlined"
              size="small"
              fullWidth
              value={row.value}
              placeholder="Any value"
              slotProps={{ htmlInput: { 'aria-label': 'Tag value' } }}
              onChange={event => {
                update(row.id, { value: event.target.value })
              }}
            />
            {rows.length > 1 ? (
              <IconButton
                size="small"
                aria-label="Remove tag filter"
                onClick={() => {
                  setRows(rows.filter(r => r.id !== row.id))
                }}
              >
                <CloseIcon fontSize="small" />
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
      </div>
    </FormRow>
  )
})

// "More filters...": every filter the "Filter by" submenu leaves out. The
// submenu keeps the read categories a user flips several times at a locus
// (SV evidence, split and spliced reads), mapping quality presets and, while
// the arcs draw, non-canonical junctions; this holds the rest — a read name,
// an exact mapping quality floor, the reads with no mate in view, tags, the
// filters of each layer drawing (Sashimi arcs, read connections,
// modifications) and the flag masks. Each filter has one home, so a choice
// never applies on click in one place and on Submit in another.
//
// Submit writes only the sections a user changed, and keeps the entries on
// their fields the dialog cannot show (a tag's `oneOf`, a MAPQ floor's `gt`).
// The menu's "Clear all filters" is what resets the whole filter.
//
// One form, one label column: a box per field read as eight separate dialogs.
const MoreFiltersDialog = observer(function MoreFiltersDialog(props: {
  model: LayerFiltersModel & {
    setFilterFields: (patch: FieldsPatch) => void
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const predicates = model.filterPredicates
  const [initial] = useState(() => readsFormOf(predicates))
  const [form, setForm] = useState(initial)
  const patchForm = (patch: Partial<ReadsForm>) => {
    setForm(f => ({ ...f, ...patch }))
  }
  const [initialLayers] = useState(() => layerFilterStateOf(model))
  const [layers, setLayers] = useState(initialLayers)

  // Back to what the track's config declares, as "Clear all filters" is, for
  // the fields this dialog shows
  const handleReset = () => {
    setForm(
      readsFormOf(
        model.declaredFilters.filterPredicates,
        Math.max(...form.tagRows.map(r => r.id)) + 1,
      ),
    )
    setLayers(declaredLayerFilterState(model))
  }

  const masksConflict = masksOverlap(form.flagInclude, form.flagExclude)
  const handleSubmit = () => {
    if (masksConflict) {
      return
    }
    const declared = model.declaredFilters.filterPredicates
    model.setFilterFields({
      ...readFieldsEntries(
        predicates,
        readFieldsOf(form),
        readFieldsOf(initial),
        { predicates: declared, reading: readFieldsOf(readsFormOf(declared)) },
      ),
      ...layerFilterEntries(layers, initialLayers, predicates, {
        predicates: declared,
        reading: declaredLayerFilterState(model),
      }),
    })
    const basesPatch = layerBasesPatch(layers, initialLayers)
    if (basesPatch) {
      model.setBases?.(basesPatch)
    }
    handleClose()
  }

  return (
    <Dialog
      open
      onClose={() => {
        handleClose()
      }}
      title="More filters"
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
          <FilterForm>
            <FormHeading>Reads</FormHeading>
            <FormRow label="Read name">
              <TextField
                variant="outlined"
                size="small"
                fullWidth
                value={form.readName}
                placeholder="Any read"
                slotProps={{ htmlInput: { 'aria-label': 'Read name' } }}
                onChange={event => {
                  patchForm({ readName: event.target.value })
                }}
              />
            </FormRow>
            <NumberRow
              label="Min mapping quality"
              value={form.minMapq}
              min={0}
              max={254}
              placeholder="Any"
              onChange={minMapq => {
                patchForm({ minMapq })
              }}
            />
            <CategoryRow
              label="Reads with no mate in view"
              all="All reads"
              only="Only reads with no mate in view"
              exclude="Hide reads with no mate in view"
              value={layers.alone}
              onChange={alone => {
                setLayers({ ...layers, alone })
              }}
            />
            <TagFilterRows
              rows={form.tagRows}
              setRows={tagRows => {
                patchForm({ tagRows })
              }}
            />
            <LayerFilterSections state={layers} setState={setLayers} />
            <FlagFilterSection
              flagInclude={form.flagInclude}
              flagExclude={form.flagExclude}
              setFlagInclude={flagInclude => {
                patchForm({ flagInclude })
              }}
              setFlagExclude={flagExclude => {
                patchForm({ flagExclude })
              }}
            />
          </FilterForm>
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
          <Button
            variant="contained"
            color="primary"
            autoFocus
            type="submit"
            disabled={masksConflict}
          >
            Submit
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
})

export default MoreFiltersDialog
