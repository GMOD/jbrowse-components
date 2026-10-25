import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Checkbox,
  FormControlLabel,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import {
  cytosineContextOptions,
  getModificationName,
} from '../../shared/modificationData.ts'

import type { LayerFilterState } from './layerFilters.ts'
import type { CategoryFilter } from '@jbrowse/display-kit/categoryFilter'
import type { CytosineContext } from '@jbrowse/modifications-utils'

const useStyles = makeStyles()(theme => ({
  paper: {
    padding: theme.spacing(1),
    margin: theme.spacing(1),
  },
  // label column sized to its longest label, as the flag grid is
  rows: {
    display: 'grid',
    gridTemplateColumns: 'auto auto',
    justifyContent: 'start',
    alignItems: 'center',
    columnGap: theme.spacing(2),
    rowGap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  field: {
    minWidth: 200,
  },
}))

const ALL = 'all'

// All / Only / Hide over one category, the menu's three radios as a select
const CategoryRow = observer(function CategoryRow({
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
  const { classes } = useStyles()
  return (
    <>
      <Typography variant="body2">{label}</Typography>
      <TextField
        select
        size="small"
        className={classes.field}
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
    </>
  )
})

const NumberRow = observer(function NumberRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: string
  min: number
  max?: number
  onChange: (value: string) => void
}) {
  const { classes } = useStyles()
  return (
    <>
      <Typography variant="body2">{label}</Typography>
      <TextField
        size="small"
        type="number"
        className={classes.field}
        value={value}
        slotProps={{ htmlInput: { min, max, 'aria-label': label } }}
        onChange={event => {
          onChange(event.target.value)
        }}
      />
    </>
  )
})

const Section = observer(function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  return (
    <Paper className={classes.paper} variant="outlined">
      <Typography>{title}</Typography>
      <div className={classes.rows}>{children}</div>
    </Paper>
  )
})

/**
 * The dialog's sections over what a layer draws from the reads: the reads
 * with no mate in view, then each layer drawing — Sashimi arcs, read
 * connections, modifications — with its own filters.
 */
const LayerFilterSections = observer(function LayerFilterSections({
  state,
  setState,
}: {
  state: LayerFilterState
  setState: (state: LayerFilterState) => void
}) {
  const { junctions, connections, bases } = state
  return (
    <>
      <Section title="Reads">
        <CategoryRow
          label="Reads with no mate in view"
          all="All reads"
          only="Only reads with no mate in view"
          exclude="Hide reads with no mate in view"
          value={state.alone}
          onChange={alone => {
            setState({ ...state, alone })
          }}
        />
      </Section>
      {junctions ? (
        <Section title="Sashimi arcs">
          <CategoryRow
            label="Split-read junctions"
            all="All junctions"
            only="Only split-read junctions"
            exclude="Hide split-read junctions"
            value={junctions.split}
            onChange={split => {
              setState({ ...state, junctions: { ...junctions, split } })
            }}
          />
          <CategoryRow
            label="Non-canonical junctions"
            all="All junctions"
            only="Only non-canonical junctions"
            exclude="Hide non-canonical junctions"
            value={junctions.nonCanonical}
            onChange={nonCanonical => {
              setState({ ...state, junctions: { ...junctions, nonCanonical } })
            }}
          />
          <NumberRow
            label="Min reads at a junction"
            value={junctions.minReads}
            min={1}
            onChange={minReads => {
              setState({ ...state, junctions: { ...junctions, minReads } })
            }}
          />
        </Section>
      ) : null}
      {connections ? (
        <Section title="Read connections">
          <CategoryRow
            label="Off-screen mate connections"
            all="All connections"
            only="Only off-screen mate connections"
            exclude="Hide off-screen mate connections"
            value={connections.offscreenMates}
            onChange={offscreenMates => {
              setState({
                ...state,
                connections: { ...connections, offscreenMates },
              })
            }}
          />
          <CategoryRow
            label="Inter-chromosomal pairs"
            all="All connections"
            only="Only inter-chromosomal pairs"
            exclude="Hide inter-chromosomal pairs"
            value={connections.interchrom}
            onChange={interchrom => {
              setState({
                ...state,
                connections: { ...connections, interchrom },
              })
            }}
          />
          <NumberRow
            label="Min reads at a breakpoint"
            value={connections.minInterchromReads}
            min={1}
            onChange={minInterchromReads => {
              setState({
                ...state,
                connections: { ...connections, minInterchromReads },
              })
            }}
          />
        </Section>
      ) : null}
      {bases ? (
        <Section title="Modifications">
          {bases.types.length > 0 ? (
            <>
              <Typography variant="body2">Modification types</Typography>
              <div>
                {bases.types.map(t => (
                  <FormControlLabel
                    key={t}
                    label={getModificationName(t)}
                    control={
                      <Checkbox
                        size="small"
                        checked={bases.shown.includes(t)}
                        onChange={(_, checked) => {
                          setState({
                            ...state,
                            bases: {
                              ...bases,
                              shown: checked
                                ? [...bases.shown, t]
                                : bases.shown.filter(s => s !== t),
                            },
                          })
                        }}
                      />
                    }
                  />
                ))}
              </div>
            </>
          ) : null}
          {bases.probabilityPercent === undefined ? null : (
            <NumberRow
              label="Hide calls under (%)"
              value={bases.probabilityPercent}
              min={0}
              max={100}
              onChange={probabilityPercent => {
                setState({ ...state, bases: { ...bases, probabilityPercent } })
              }}
            />
          )}
          {bases.context === undefined ? null : (
            <>
              <Typography variant="body2">Cytosine context</Typography>
              <TextField
                select
                size="small"
                value={bases.context}
                slotProps={{ htmlInput: { 'aria-label': 'Cytosine context' } }}
                onChange={event => {
                  setState({
                    ...state,
                    bases: {
                      ...bases,
                      context: event.target.value as CytosineContext,
                    },
                  })
                }}
              >
                {cytosineContextOptions.map(o => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            </>
          )}
        </Section>
      ) : null}
    </>
  )
})

export default LayerFilterSections
