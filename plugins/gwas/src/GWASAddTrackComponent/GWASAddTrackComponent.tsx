import { FileSelector } from '@jbrowse/core/ui'
import { useAddTrackFields } from '@jbrowse/core/util'
import { getRoot } from '@jbrowse/mobx-state-tree'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import ScoreColumnFields from '../GWASAdapter/ScoreColumnFields.tsx'
import {
  INITIAL_GWAS_FORM,
  gwasTrackMixin,
  ldIndexMissing,
} from './gwasTrackMixin.ts'
import { isTabixLocation } from './ldAdapterConfig.ts'

import type { GwasForm } from './gwasTrackMixin.ts'
import type {
  AbstractRootModel,
  AddTrackComponentProps,
} from '@jbrowse/core/util'

function contribute(form: GwasForm) {
  return { trackConfig: gwasTrackMixin(form) }
}

const GWASAddTrackComponent = observer(function ({
  model,
}: AddTrackComponentProps) {
  const rootModel = getRoot<AbstractRootModel>(model)
  const { form, update: set } = useAddTrackFields(
    model,
    'GWASAdapter',
    INITIAL_GWAS_FORM,
    contribute,
  )
  const { scoreColumn, scoreTransform, ldLocation, ldIndexLocation } = form
  const indexMissing = ldIndexMissing(form)

  return (
    <>
      <ScoreColumnFields
        scoreColumn={scoreColumn}
        setScoreColumn={val => {
          set({ scoreColumn: val })
        }}
        scoreTransform={scoreTransform}
        setScoreTransform={val => {
          set({ scoreTransform: val })
        }}
      />
      <FileSelector
        name="PLINK LD table, to color points by r² to an index SNP (optional; .ld or .vcor, bgzipped or not)"
        location={ldLocation}
        rootModel={rootModel}
        setLocation={loc => {
          set({ ldLocation: loc })
        }}
      />
      {ldLocation && isTabixLocation(ldLocation) ? (
        <>
          <FileSelector
            name="LD tabix index (.tbi or .csi; defaults to <file>.tbi)"
            location={ldIndexLocation}
            rootModel={rootModel}
            setLocation={loc => {
              set({ ldIndexLocation: loc })
            }}
          />
          {indexMissing ? (
            <Typography color="error" variant="body2">
              An uploaded LD file needs its index uploaded too; until then the
              track is added without LD coloring
            </Typography>
          ) : null}
        </>
      ) : null}
    </>
  )
})

export default GWASAddTrackComponent
