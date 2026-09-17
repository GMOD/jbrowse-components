import { makeSizeSubMenu } from '@jbrowse/core/ui'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { toggleItem, withHint } from '@jbrowse/core/ui/menuItems'
import { toLocale } from '@jbrowse/core/util'
import {
  MAX_MIN_LENGTH_BP,
  MIN_LENGTH_HELP,
  SETTINGS_SURFACE_LABELS,
  lodMenuItems,
} from '@jbrowse/synteny-core'
import TuneIcon from '@mui/icons-material/Tune'
import { observer } from 'mobx-react'

import {
  DEFAULT_ALPHA,
  DEFAULT_LINE_WIDTH,
  DEFAULT_MIN_ALIGNMENT_LENGTH,
  DEFAULT_MIN_IDENTITY,
} from '../consts.ts'

import type { DotplotViewModel } from '../model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// Not in synteny-core beside MIN_LENGTH_HELP: the synteny view enforces its
// filters as shader uniforms over an instance buffer that carries no identity
// lane, so it has no twin of this control to diverge from yet.
const MIN_IDENTITY_HELP =
  'Hide alignments below this sequence identity. One with no identity ' +
  'reported is kept at every threshold.'

/**
 * Every setting that decides what the plot looks like and how much detail feeds
 * it, in the shape the synteny view's settings menu uses: the checkboxes, then
 * the submenus (choices before values). Lock aspect ratio frames
 * the plot rather than draws it, so it stays in the ⋮ menu.
 */
const DotplotSettingsMenu = observer(function DotplotSettingsMenu({
  model,
}: {
  model: DotplotViewModel
}) {
  return (
    <CascadingMenuButton
      tooltip={SETTINGS_SURFACE_LABELS.DotplotView}
      menuItems={() =>
        [
          toggleItem(
            'CIGAR indels',
            model.drawCigar,
            flag => {
              model.setDrawCigar(flag)
            },
            {
              helpText: 'Off draws each alignment as one straight segment.',
            },
          ),
          toggleItem(
            // a plot with no room for a ruler on either axis has no gridlines to
            // draw, and the box stays ticked through it
            withHint(
              'Gridlines',
              model.gridlinesEmpty ? 'none at this zoom' : undefined,
            ),
            model.showGridlines,
            flag => {
              model.setShowGridlines(flag)
            },
            {
              helpText:
                "Carry each axis' ruler ticks across the plot. An axis with no room to number itself draws none.",
            },
          ),
          ...lodMenuItems(model),
          makeSizeSubMenu({
            label: 'opacity',
            title: 'Opacity',
            help: 'Lower lets overlapping points show through each other.',
            min: 0,
            max: 1,
            step: 0.01,
            // cubic gives fine control near 0, where a small opacity change is
            // perceptually large
            scale: 'cubic',
            format: n => n.toFixed(3),
            getValue: () => model.alpha,
            isDefault: model.alpha === DEFAULT_ALPHA,
            onChange: v => {
              model.setAlpha(v)
            },
            onReset: () => {
              model.setAlpha(DEFAULT_ALPHA)
            },
          }),
          makeSizeSubMenu({
            label: 'line width',
            title: 'Line width',
            help: 'Thickness of each alignment in pixels. Wider makes a sparse plot legible, narrower keeps a dense one from filling in.',
            min: 0.5,
            max: 10,
            step: 0.5,
            getValue: () => model.lineWidth,
            isDefault: model.lineWidth === DEFAULT_LINE_WIDTH,
            onChange: v => {
              model.setLineWidth(v)
            },
            onReset: () => {
              model.setLineWidth(DEFAULT_LINE_WIDTH)
            },
          }),
          makeSizeSubMenu({
            label: 'min length',
            title: 'Min length',
            help: MIN_LENGTH_HELP,
            min: DEFAULT_MIN_ALIGNMENT_LENGTH,
            max: MAX_MIN_LENGTH_BP,
            step: 1,
            scale: 'log',
            format: n => `${toLocale(n)}bp`,
            // raising the filter re-runs the geometry stage, so the model is
            // written when the drag ends rather than on every pixel of it
            commitOnRelease: true,
            getValue: () => model.minAlignmentLength,
            isDefault:
              model.minAlignmentLength === DEFAULT_MIN_ALIGNMENT_LENGTH,
            onChange: bp => {
              model.setMinAlignmentLength(bp)
            },
            onReset: () => {
              model.setMinAlignmentLength(DEFAULT_MIN_ALIGNMENT_LENGTH)
            },
          }),
          makeSizeSubMenu({
            label: 'min identity',
            title: 'Min identity',
            help: MIN_IDENTITY_HELP,
            min: DEFAULT_MIN_IDENTITY,
            max: 1,
            step: 0.01,
            format: n => `${(n * 100).toFixed(0)}%`,
            // same reason min length commits late: the threshold is enforced in
            // the geometry build, not in a shader uniform
            commitOnRelease: true,
            getValue: () => model.minIdentity,
            isDefault: model.minIdentity === DEFAULT_MIN_IDENTITY,
            onChange: fraction => {
              model.setMinIdentity(fraction)
            },
            onReset: () => {
              model.setMinIdentity(DEFAULT_MIN_IDENTITY)
            },
          }),
        ] satisfies MenuItem[]
      }
    >
      <TuneIcon />
    </CascadingMenuButton>
  )
})

export default DotplotSettingsMenu
