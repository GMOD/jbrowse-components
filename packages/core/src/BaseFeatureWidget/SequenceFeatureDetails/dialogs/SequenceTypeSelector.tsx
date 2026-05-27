import { FormControl, MenuItem, Select } from '@mui/material'
import { observer } from 'mobx-react'

import { makeStyles } from '../../../util/tss-react/index.ts'

import type { SequenceFeatureDetailsModel } from '../model.ts'

const useStyles = makeStyles()({
  formControl: {
    margin: 0,
    marginLeft: 4,
  },
})

const SequenceTypeSelector = observer(function SequenceTypeSelector({
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
        {[
          ...(hasCDS
            ? [
                ['cds', 'CDS'],
                ['protein', 'Protein'],
              ]
            : []),
          ...(hasExonOrCDS
            ? [
                ['cdna', 'cDNA'],
                ['gene', 'Genomic w/ full introns'],
                [
                  'gene_updownstream',
                  `Genomic w/ full introns +/- ${upDownBp}bp up+down stream`,
                ],
                ['gene_collapsed_intron', `Genomic w/ ${intronBp}bp intron`],
                [
                  'gene_updownstream_collapsed_intron',
                  `Genomic w/ ${intronBp}bp intron +/- ${upDownBp}bp up+down stream`,
                ],
              ]
            : []),
          ...(!hasExonOrCDS
            ? [
                ['genomic', 'Genomic'],
                [
                  'genomic_sequence_updownstream',
                  `Genomic +/- ${upDownBp}bp up+down stream`,
                ],
              ]
            : []),
        ].map(([key, val]) => (
          <MenuItem key={key} value={key}>
            {val}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
})

export default SequenceTypeSelector
