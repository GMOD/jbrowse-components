import React, { useEffect, useState } from 'react'
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
  feature,
  model,
}: {
  feature: SimpleFeatureSerialized
  model: SequenceFeatureDetailsModel
}) {
  const { classes } = useStyles()
  const { intronBp, upDownBp, setMode } = model

  const hasCDS = feature.subfeatures?.some(sub => sub.type === 'CDS')
  const hasExon = feature.subfeatures?.some(sub => sub.type === 'exon')
  const hasExonOrCDS = hasExon || hasCDS

  const [selectMode, setSelectMode] = useState(
    hasCDS ? 'cds' : hasExon ? 'cdna' : 'genomic',
  )

  useEffect(() => {
    setMode(selectMode)
  }, [setMode, hasCDS, hasExon, selectMode])

  return (
    <FormControl className={classes.formControl}>
      <Select
        size="small"
        value={selectMode}
        onChange={event => setSelectMode(event.target.value)}
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
