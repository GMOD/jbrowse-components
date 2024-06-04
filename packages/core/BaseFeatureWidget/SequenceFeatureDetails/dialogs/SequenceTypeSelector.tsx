import React, { useEffect } from 'react'
import { FormControl, MenuItem, Select } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
// locals
import { SimpleFeatureSerialized } from '../../../util'
import { SequenceFeatureDetailsModel } from '../model'

const useStyles = makeStyles()({
  formControl: {
    margin: 0,
    marginLeft: 4,
  },
})

const SequenceTypeSelector = observer(function ({
  mode,
  setMode,
  feature,
  model,
}: {
  mode: string
  setMode: (arg: string) => void
  feature: SimpleFeatureSerialized
  model: SequenceFeatureDetailsModel
}) {
  const { classes } = useStyles()
  const { intronBp, upDownBp } = model

  const hasCDS = feature.subfeatures?.some(sub => sub.type === 'CDS')
  const hasExon = feature.subfeatures?.some(sub => sub.type === 'exon')
  const hasExonOrCDS = hasExon || hasCDS

  useEffect(() => {
    setMode(hasCDS ? 'cds' : hasExon ? 'cdna' : 'genomic')
  }, [setMode, hasCDS, hasExon])

  return (
    <FormControl className={classes.formControl}>
      <Select
        size="small"
        value={mode}
        onChange={event => setMode(event.target.value)}
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
                gene: `Genomic w/ full introns`,
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
