import React from 'react'
import { observer } from 'mobx-react'
import ZoomControls from '@jbrowse/plugin-linear-genome-view/src/LinearGenomeView/components/ZoomControls'
import { SearchBox } from '@jbrowse/plugin-linear-genome-view'
import { IconButton, FormGroup, useTheme, alpha } from '@material-ui/core'
import LinkIcon from '@material-ui/icons/Link'
import LinkOffIcon from '@material-ui/icons/LinkOff'
import FormatAlignCenterIcon from '@material-ui/icons/FormatAlignCenter'

import { MultilevelLinearComparativeViewModel } from '../model'
import { PanControls, RegionWidth } from './Controls'

type LCV = MultilevelLinearComparativeViewModel

const LinkViews = observer(({ model }: { model: LCV }) => {
  return (
    <IconButton
      onClick={model.toggleLinkViews}
      title="Toggle linked scrolls and behavior across views"
    >
      {model.linkViews ? (
        <LinkIcon color="secondary" />
      ) : (
        <LinkOffIcon color="secondary" />
      )}
    </IconButton>
  )
})

const AlignViews = observer(({ model }: { model: LCV }) => {
  return (
    <IconButton
      onClick={model.alignViews}
      title="Align views (realign sub views to the anchor view)"
    >
      <FormatAlignCenterIcon color="secondary" />
    </IconButton>
  )
})

const Header = observer(
  ({ model, ExtraButtons }: { model: LCV; ExtraButtons?: React.ReactNode }) => {
    const theme = useTheme()
    const { primary } = theme.palette
    const colour = primary.light

    return (
      <div>
        {model.initialized && model.views[model.anchorViewIndex].initialized ? (
          <div
            style={{
              gridArea: '1/1/auto/span 2',
              display: 'flex',
              alignItems: 'center',
              height: 48,
              background: alpha(colour, 0.3),
            }}
          >
            <LinkViews model={model} />
            <AlignViews model={model} />
            <div style={{ flexGrow: '1' }} />

            <FormGroup row style={{ flexWrap: 'nowrap', marginRight: 7 }}>
              <PanControls model={model.views[model.anchorViewIndex]} />
              <SearchBox model={model.views[model.anchorViewIndex]} />
            </FormGroup>
            <RegionWidth model={model.views[model.anchorViewIndex]} />
            <ZoomControls model={model.views[model.anchorViewIndex]} />
            <div style={{ flexGrow: '1' }} />
          </div>
        ) : null}
      </div>
    )
  },
)

export default Header
