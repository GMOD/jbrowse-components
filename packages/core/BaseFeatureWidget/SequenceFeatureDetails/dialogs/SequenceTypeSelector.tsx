import React from 'react'
import { FormControl, MenuItem, Select } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
// locals
import type { SequenceFeatureDetailsModel } from '../model'

const useStyles = makeStyles()({
  formControl: {
    margin: 0,
    marginLeft: 4,
  },
})

const SequenceTypeSelector = observer(function ({
  model,
}: {
  model: SequenceFeatureDetailsModel
}) {
  const { classes } = useStyles()
  const { intronBp, upDownBp, mode, hasCDS, hasExonOrCDS } = model

  return (
    <FormControl className={classes.formControl}>
      <Select
        size="small"
        value={mode}
        onChange={event => {
          model.setMode(event.target.value)
        }}
      >
        {Object.entries({
          ...(hasCDS
            ? {
                cds: 'CDS',
              }
            : {}),
          ...(hasCDS
            ? {
                protein: 'Protein',
              }
            : {}),
          ...(hasExonOrCDS
            ? {
                cdna: 'cDNA',
              }
            : {}),
          ...(hasExonOrCDS
            ? {
                gene: 'Genomic w/ full introns',
              }
            : {}),
          ...(hasExonOrCDS
            ? {
                gene_updownstream: `Genomic w/ full introns +/- ${upDownBp}bp up+down stream`,
              }
            : {}),
          ...(hasExonOrCDS
            ? {
                gene_collapsed_intron: `Genomic w/ ${intronBp}bp intron`,
              }
            : {}),
          ...(hasExonOrCDS
            ? {
                gene_updownstream_collapsed_intron: `Genomic w/ ${intronBp}bp intron +/- ${upDownBp}bp up+down stream `,
              }
            : {}),
          ...(!hasExonOrCDS
            ? {
                genomic: 'Genomic',
              }
            : {}),
          ...(!hasExonOrCDS
            ? {
                genomic_sequence_updownstream: `Genomic +/- ${upDownBp}bp up+down stream`,
              }
            : {}),
        }).map(([key, val]) => (
          <MenuItem key={key} value={key}>
            {val}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
})

export default SequenceTypeSelector
