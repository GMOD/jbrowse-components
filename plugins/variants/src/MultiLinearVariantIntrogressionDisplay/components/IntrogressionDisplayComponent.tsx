import { useState } from 'react'
import { Button, CircularProgress, Box } from '@mui/material'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import TreeSidebar from '../../shared/components/TreeSidebar'
import PopulationConfigDialog from './PopulationConfigDialog'

import type { MultiLinearVariantIntrogressionDisplayModel } from '../model'

const IntrogressionDisplayComponent = observer(function (props: {
  model: MultiLinearVariantIntrogressionDisplayModel
}) {
  const { model } = props
  const [showPopulationDialog, setShowPopulationDialog] = useState(false)

  return (
    <div>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 1,
          backgroundColor: '#f5f5f5',
          borderBottom: '1px solid #ddd',
        }}
      >
        <Button
          variant="contained"
          size="small"
          onClick={() => setShowPopulationDialog(true)}
        >
          Configure Populations
        </Button>

        {model.isPopulationConfigured && (
          <>
            <Button
              variant="outlined"
              size="small"
              onClick={() => model.calculateIntrogression()}
              disabled={model.introgressionLoading}
            >
              Recalculate
            </Button>
            {model.introgressionLoading && <CircularProgress size={20} />}
          </>
        )}

        {model.introgressionData && (
          <Box sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
            D = {model.introgressionData.dStatistic.toFixed(4)} | Z ={' '}
            {model.introgressionData.zScore.toFixed(2)} |
            {model.introgressionData.zScore > 3
              ? ' Significant'
              : ' Not significant'}
          </Box>
        )}
      </Box>

      <TreeSidebar model={model} />
      <BaseLinearDisplayComponent {...props} />

      {showPopulationDialog && (
        <PopulationConfigDialog
          model={model}
          handleClose={() => setShowPopulationDialog(false)}
        />
      )}
    </div>
  )
})

export default IntrogressionDisplayComponent
