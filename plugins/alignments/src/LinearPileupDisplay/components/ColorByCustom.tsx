import React from 'react'
import { observer } from 'mobx-react'
import { Button, DialogContent, DialogActions, Typography } from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'
import { ColorPicker } from '@jbrowse/core/ui/ColorPicker'

import { fillColor, IColorByModel } from '../../shared/color'

function ColorByCustomDlg(props: {
  model: {
    colorBy: IColorByModel
    setColorScheme: Function
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props

  const type = model.colorBy ? model.colorBy.type : 'normal'
  const tag = model.colorBy ? model.colorBy.tag : ''
  const extra = model.colorBy ? model.colorBy.extra : undefined

  const colorOptionMap = {
    normal: ['color_unknown'],
    mappingQuality: ['hsl'],
    strand: ['color_fwd_strand', 'color_rev_strand'],
    pairOrientation: [
      'color_nostrand',
      'color_pair_lr',
      'color_pair_rr',
      'color_pair_rl',
      'color_pair_ll',
    ],
    perBaseQuality: ['hsl'],
    perBaseLettering: ['hsl'],
    modifications: ['color_modifications'],
    methylation: ['color_methylation'],
    insertSize: ['hsl'],
    stranded: [
      'color_fwd_strand',
      'color_rev_strand',
      'color_fwd_missing_mate',
      'color_rev_missing_mate',
      'color_fwd_strand_not_proper',
      'color_rev_strand_not_proper',
      'color_fwd_diff_chr',
      'color_rev_diff_chr',
    ],
    tag: ['color_fwd_strand', 'color_rev_strand', 'color_nostrand'],
  }

  return (
    <Dialog open onClose={handleClose} title="Apply custom color scheme">
      <DialogContent>
        <Typography variant="body1">
          Select custom color options (color by {type}) for the track display.
        </Typography>
        {/* @ts-ignore */}
        {colorOptionMap[type].map((colorOption: string) => {
          return (
            <div key={colorOption}>
              {colorOption === 'hsl' ? (
                <>
                  <br />
                  <Typography variant="body2">
                    There is no colour configurations for the {type} color
                    scheme setting.
                  </Typography>
                </>
              ) : (
                <>
                  <Typography variant="h6">{colorOption}</Typography>
                  <ColorPicker
                    // @ts-ignore
                    color={extra?.custom[colorOption] || fillColor[colorOption]}
                    onChange={event => {
                      const scheme = {
                        type: type,
                        tag: tag,
                        extra: {
                          ...extra,
                          custom: {
                            ...extra?.custom,
                            [colorOption]: event,
                          },
                        },
                      }
                      model.setColorScheme(scheme)
                    }}
                  />
                </>
              )}
            </div>
          )
        })}
        <DialogActions>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              const scheme = {
                type: type,
                tag: tag,
                extra: {
                  ...extra,
                  custom: {
                    ...extra?.custom,
                    ...fillColor,
                  },
                },
              }
              model.setColorScheme(scheme)
            }}
          >
            Restore default
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              handleClose()
            }}
          >
            Submit
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  )
}

export default observer(ColorByCustomDlg)
