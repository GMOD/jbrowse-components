import { makeStyles } from '@jbrowse/core/util/tss-react'
import { MultiLevelRubberband } from '@jbrowse/plugin-linear-genome-view'
import { ColorByLegend } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import Header from './Header.tsx'
import LinearComparativeRenderArea from './LinearComparativeRenderArea.tsx'
import { asSyntenyModel } from '../../LinearSyntenyView/model.ts'

import type { LinearComparativeViewModel } from '../model.ts'
import type { SyntenyColorBy } from '@jbrowse/synteny-core'

const useStyles = makeStyles()(theme => ({
  // this helps keep the vertical guide inside the parent view container,
  // similar style exists in the single LGV's trackscontainer
  rubberbandContainer: {
    position: 'relative',
    overflow: 'hidden',
  },

  rubberbandDiv: {
    width: '100%',
    background: theme.palette.action.disabledBackground,
    height: 15,
    '&:hover': {
      background: theme.palette.action.selected,
    },
  },
  renderAreaWrapper: {
    position: 'relative',
  },
}))

const LinearComparativeView = observer(function LinearComparativeView({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const { classes } = useStyles()
  const syntenyModel = asSyntenyModel(model)
  const showLegend = !!syntenyModel?.showColorLegend

  return (
    <div className={classes.rubberbandContainer}>
      <Header model={model} />
      <MultiLevelRubberband
        model={model}
        ControlComponent={<div className={classes.rubberbandDiv} />}
      />
      <div className={classes.renderAreaWrapper}>
        <LinearComparativeRenderArea model={model} />
        {syntenyModel && showLegend ? (
          <ColorByLegend
            colorBy={syntenyModel.colorBy as SyntenyColorBy}
            onClose={() => {
              syntenyModel.setShowColorLegend(false)
            }}
          />
        ) : null}
      </div>
    </div>
  )
})

export default LinearComparativeView
