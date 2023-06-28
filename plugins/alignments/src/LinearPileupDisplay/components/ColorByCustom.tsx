import React from 'react'
import { observer } from 'mobx-react'
import { Button, DialogContent, DialogActions, Typography } from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'
import { ColorPicker } from '@jbrowse/core/ui/ColorPicker'

import { fillColor } from '../../shared/color'

function ColorByCustomDlg(props: {
  model: {
    colorBy: any
    setColorScheme: Function
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const { type = 'normal', tag, extra } = model.colorBy

  const colorOptionMap = {
    normal: ['color_unknown'],
    strand: ['color_fwd_strand', 'color_rev_strand'],
    pairOrientation: [
      'color_nostrand',
      'color_pair_lr',
      'color_pair_rr',
      'color_pair_rl',
      'color_pair_ll',
    ],
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
    modifications: ['color_modifications'],
    methylation: ['color_methylation'],
  }

  return (
    <Dialog open onClose={handleClose} title="Apply custom color scheme">
      <DialogContent>
        <Typography>
          Select custom color options for the track display.
        </Typography>
        {/* @ts-ignore */}
        {colorOptionMap[type].map((colorOption: string) => {
          return (
            <div key={colorOption}>
              <Typography variant="h6">{colorOption}</Typography>
              <ColorPicker
                // @ts-ignore
                color={extra?.custom[colorOption] || fillColor[colorOption]}
                onChange={event => {
                  const scheme = {
                    type: model.colorBy.type,
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
            </div>
          )
        })}
        <DialogActions>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              const scheme = {
                type: model.colorBy.type,
                tag: model.colorBy?.tag,
                extra: {
                  ...model.colorBy?.extra,
                  custom: {
                    ...model.colorBy?.extra?.custom,
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
