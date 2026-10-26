import { Checkbox, FormControlLabel, MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import {
  cytosineContextOptions,
  getModificationName,
} from '../../shared/modificationData.ts'
import { CategoryRow, FormHeading, FormRow, NumberRow } from './FilterForm.tsx'

import type { LayerFilterState } from './layerFilters.ts'
import type { CytosineContext } from '@jbrowse/modifications-utils'

/**
 * The dialog's sections over what a layer draws from the reads: each layer
 * drawing — Sashimi arcs, read connections, modifications — with its own
 * filters.
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
      {junctions ? (
        <>
          <FormHeading>Sashimi arcs</FormHeading>
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
          <NumberRow
            label="Min reads at a junction"
            value={junctions.minReads}
            min={1}
            onChange={minReads => {
              setState({ ...state, junctions: { ...junctions, minReads } })
            }}
          />
        </>
      ) : null}
      {connections ? (
        <>
          <FormHeading>Read connections</FormHeading>
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
        </>
      ) : null}
      {bases ? (
        <>
          <FormHeading>Modifications</FormHeading>
          {bases.types.length > 0 ? (
            <FormRow label="Modification types">
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
            </FormRow>
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
            <FormRow label="Cytosine context">
              <TextField
                variant="outlined"
                select
                size="small"
                fullWidth
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
            </FormRow>
          )}
        </>
      ) : null}
    </>
  )
})

export default LayerFilterSections
