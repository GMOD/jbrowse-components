import React from 'react'
import { observer } from 'mobx-react'
import { IconButton, FormGroup, useTheme, alpha } from '@mui/material'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import ZoomControls from '@jbrowse/plugin-linear-genome-view/src/LinearGenomeView/components/ZoomControls'
import { SearchBox } from '@jbrowse/plugin-linear-genome-view'

import { MultilevelLinearViewModel } from '../model'
import { PanControls, RegionWidth } from './Controls'

type LCV = MultilevelLinearViewModel

const LinkViews = observer(({ model }: { model: LCV }) => {
  return (
    <IconButton
      onClick={model.toggleLinkViews}
      title="Toggle linked scrolls and behavior across views"
    >
      {model.linkViews ? (
        <LinkOffIcon color="secondary" />
      ) : (
        <LinkIcon color="secondary" />
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
    // @ts-ignore
    const anchorView = model?.views.find(view => view.isAnchor)

    return (
      <div>
        {model?.initialized && anchorView?.initialized ? (
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
              {/* @ts-ignore */}
              <PanControls model={anchorView} />
              <SearchBox model={anchorView} />
            </FormGroup>
            {/* @ts-ignore */}
            <RegionWidth model={anchorView} />
            <ZoomControls model={anchorView} />
            <div style={{ flexGrow: '1' }} />
          </div>
        ) : null}
      </div>
    )
  },
)

export default Header
