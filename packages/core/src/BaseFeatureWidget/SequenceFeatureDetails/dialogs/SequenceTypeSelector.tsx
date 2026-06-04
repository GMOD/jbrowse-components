import { FormControl, MenuItem, Select } from '@mui/material'
import { observer } from 'mobx-react'

import { makeStyles } from '../../../util/tss-react/index.ts'
import { featureHasCDS, featureHasExonOrCDS } from '../featureTypeUtil.ts'

import type { SimpleFeatureSerialized } from '../../../util/index.ts'
import type {
  SequenceDisplayMode,
  SequenceFeatureDetailsModel,
} from '../model.ts'

const useStyles = makeStyles()({
  formControl: {
    margin: 0,
    marginLeft: 4,
  },
})

const SequenceTypeSelector = observer(function SequenceTypeSelector({
  model,
  feature,
  mode,
  setMode,
}: {
  model: SequenceFeatureDetailsModel
  feature: SimpleFeatureSerialized
  mode: SequenceDisplayMode
  setMode: (mode: SequenceDisplayMode) => void
}) {
  const { classes } = useStyles()
  const { intronBp, upDownBp } = model
  const hasCDS = featureHasCDS(feature)
  const hasExonOrCDS = featureHasExonOrCDS(feature)

  return (
    <FormControl className={classes.formControl}>
      <Select
        size="small"
        value={mode}
        onChange={event => {
          setMode(event.target.value)
        }}
        aria-label="Sequence type"
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
