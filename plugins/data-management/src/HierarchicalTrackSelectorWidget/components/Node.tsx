import React, { useState } from 'react'
import {
  Checkbox,
  FormControlLabel,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'

// icons
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'

// other
import { HierarchicalTrackSelectorModel, TreeNode } from '../model'
import JBrowseMenu from '@jbrowse/core/ui/Menu'
import { getSession } from '@jbrowse/core/util'

import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'

const useStyles = makeStyles()(theme => ({
  compactCheckbox: {
    padding: 0,
  },

  checkboxLabel: {
    marginRight: 0,
    '&:hover': {
      backgroundColor: '#eee',
    },
  },

  contrastColor: {
    color: theme.palette.secondary.contrastText,
  },

  // this accordionBase element's small padding is used to give a margin to
  // accordionColor it a "margin" because the virtualized elements can't really
  // use margin in a conventional way (it doesn't affect layout)
  accordionBase: {
    display: 'flex',
  },

  accordionCard: {
    padding: 3,
    cursor: 'pointer',
    display: 'flex',
  },

  nestingLevelMarker: {
    position: 'absolute',
    borderLeft: '1.5px solid #555',
  },
  // accordionColor set's display:flex so that the child accordionText use
  // vertically centered text
  accordionColor: {
    // @ts-ignore
    background: theme.palette.tertiary?.main,
    // @ts-ignore
    color: theme.palette.tertiary?.contrastText,
    width: '100%',
    display: 'flex',
    paddingLeft: 5,
  },

  // margin:auto 0 to center text vertically
  accordionText: {
    margin: 'auto 0',
  },
}))

export interface InfoArgs {
  target: HTMLElement
  id: string
  conf: AnyConfigurationModel
}

function treeToMap(tree: TreeNode, map = new Map<string, TreeNode>()) {
  if (tree.id && tree.children.length) {
    map.set(tree.id, tree)
  }
  for (let i = 0; i < tree.children.length; i++) {
    const node = tree.children[i]
    treeToMap(node, map)
  }
  return map
}

function isUnsupported(name = '') {
  return name.endsWith('(Unsupported)') || name.endsWith('(Unknown)')
}

// An individual node in the track selector. Note: manually sets cursor:
// pointer improves usability for what can be clicked
export default function Node(props: {
  data: {
    nestingLevel: number
    checked: boolean
    conf: AnyConfigurationModel
    drawerPosition: unknown
    id: string
    isLeaf: boolean
    name: string
    onChange: Function
    toggleCollapse: (arg: string) => void
    tree: TreeNode
    model: HierarchicalTrackSelectorModel
  }
  isOpen: boolean
  style?: { height: number }
  setOpen: (arg: boolean) => void
}) {
  const { data, isOpen, style, setOpen } = props
  const {
    checked,
    conf,
    drawerPosition,
    id,
    isLeaf,
    model,
    name,
    nestingLevel,
    onChange,
    toggleCollapse,
    tree,
  } = data

  const { classes } = useStyles()
  const width = 10
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null)
  const [info, setInfo] = useState<InfoArgs>()
  const marginLeft = nestingLevel * width + (isLeaf ? width : 0)
  const description = (conf && readConfObject(conf, ['description'])) || ''

  return (
    <div style={style} className={!isLeaf ? classes.accordionBase : undefined}>
      {new Array(nestingLevel).fill(0).map((_, idx) => (
        <div
          key={`mark-${idx}`}
          style={{ left: idx * width + 4, height: style?.height }}
          className={classes.nestingLevelMarker}
        />
      ))}
      <div
        className={!isLeaf ? classes.accordionCard : undefined}
        onClick={() => {
          if (!menuEl) {
            toggleCollapse(id)
            setOpen(!isOpen)
          }
        }}
        style={{
          marginLeft,
          whiteSpace: 'nowrap',
          width: '100%',
        }}
      >
        <div className={!isLeaf ? classes.accordionColor : undefined}>
          {!isLeaf ? (
            <div className={classes.accordionText}>
              <Typography>
                {isOpen ? <ArrowDropDownIcon /> : <ArrowRightIcon />}
                {name}
                <IconButton
                  onClick={event => {
                    setMenuEl(event.currentTarget)
                    event.stopPropagation()
                  }}
                  className={classes.contrastColor}
                >
                  <MoreHorizIcon />
                </IconButton>
              </Typography>
            </div>
          ) : (
            <>
              <Tooltip
                title={description}
                placement={drawerPosition === 'left' ? 'right' : 'left'}
              >
                <FormControlLabel
                  className={classes.checkboxLabel}
                  control={
                    <Checkbox
                      className={classes.compactCheckbox}
                      checked={checked}
                      onChange={() => onChange(id)}
                      color="primary"
                      disabled={isUnsupported(name)}
                      inputProps={{
                        // @ts-ignore
                        'data-testid': `htsTrackEntry-${id}`,
                      }}
                    />
                  }
                  label={name}
                />
              </Tooltip>
              <IconButton
                onClick={e => setInfo({ target: e.currentTarget, id, conf })}
                style={{ padding: 0 }}
                color="secondary"
                data-testid={`htsTrackEntryMenu-${id}`}
              >
                <MoreHorizIcon />
              </IconButton>
            </>
          )}
          {menuEl ? (
            <JBrowseMenu
              anchorEl={menuEl}
              menuItems={[
                {
                  label: 'Add to selection',
                  onClick: () => {
                    const subtree = treeToMap(tree).get(id)
                    const t = subtree?.children.map(t => t.conf) || []
                    model.addToGroup(t as AnyConfigurationModel[])
                  },
                },
              ]}
              onMenuItemClick={(_event, callback) => {
                callback()
                setMenuEl(null)
              }}
              open={Boolean(menuEl)}
              onClose={() => setMenuEl(null)}
            />
          ) : null}

          {info ? (
            <JBrowseMenu
              anchorEl={info?.target}
              menuItems={[
                ...(getSession(model).getTrackActionMenuItems?.(info.conf) ||
                  []),
                {
                  label: 'Add to selection',
                  onClick: () => model.addToGroup([info.conf]),
                },
              ]}
              onMenuItemClick={(_event, callback) => {
                callback()
                setInfo(undefined)
              }}
              open={Boolean(info)}
              onClose={() => setInfo(undefined)}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
