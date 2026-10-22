import { useEffect } from 'react'

import { FileSelector } from '@jbrowse/core/ui'
import { workflowForm } from '@jbrowse/core/util'
import { getRoot, isAlive } from '@jbrowse/mobx-state-tree'
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
  AddTrackComponentModel,
  AddTrackComponentProps,
} from '@jbrowse/core/util'

const FORM_KEY = 'GWASAdapter'

function readForm(model: AddTrackComponentModel) {
  return workflowForm(model, FORM_KEY, INITIAL_GWAS_FORM)
}

const GWASAddTrackComponent = observer(function ({
  model,
}: AddTrackComponentProps) {
  // Seeds the track config from the form on mount, which may be a remount
  // after the drawer showed another widget, and takes it back on unmount, so a
  // switch to another adapter type carries none of these fields over.
  useEffect(() => {
    model.setMixinData(gwasTrackMixin(readForm(model).form))
    return () => {
      if (isAlive(model)) {
        model.setMixinData({})
      }
    }
  }, [model])

  const rootModel = getRoot<AbstractRootModel>(model)
  const { form, update } = readForm(model)
  const { scoreColumn, scoreTransform, ldLocation, ldIndexLocation } = form
  const indexMissing = ldIndexMissing(form)

  function set(patch: Partial<GwasForm>) {
    update(patch)
    model.setMixinData(gwasTrackMixin(readForm(model).form))
  }

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
