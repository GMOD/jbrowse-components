import { makeSizeSubMenu } from '@jbrowse/core/ui'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { toggleItem, withHint } from '@jbrowse/core/ui/menuItems'
import { toLocale } from '@jbrowse/core/util'
import {
  MAX_MIN_LENGTH_BP,
  MIN_LENGTH_HELP,
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
  'Hides alignments whose sequence identity is below this percentage, the ' +
  'same measurement the identity color mode paints. An alignment whose ' +
  'adapter reported no identity at all is kept at every threshold, so a ' +
  'track carrying none is left alone by this slider rather than emptied by ' +
  'it.'

/**
 * Every setting that decides what the plot looks like and how much detail feeds
 * it, in the shape the synteny view's settings menu uses — so the two
 * comparative views cannot present the same settings as different kinds of
 * control. Opacity and Min length are literally the same settings in both.
 *
 * LEVEL OF DETAIL IS HERE, not in the ⋮ menu it used to sit in. It was the last
 * of these settings split off by widget type rather than by subject: a radio
 * group in one surface while the sliders it belongs beside were in another, and
 * nothing about the setting predicted which one held it.
 *
 * CIGAR AND GRIDLINES ARE HERE for the same reason: both were in the ⋮ menu's
 * "Show..." submenu, which filed them by widget type — a checkbox is a checkbox
 * — while the synteny view had already moved their twins into its settings
 * menu. Lock aspect ratio stayed behind, because it frames the plot rather than
 * draws it, and its twin (`sameScale`) is likewise in the synteny hamburger.
 *
 * FLAT, with no section headings. The synteny view's menu earns its three
 * because it has ten rows to group; seven do not, and a heading over a single
 * gated row is more rule than list. What it does keep is that menu's row shape
 * — `label + [?] + (checkbox | chevron)`, the sliders behind `makeSizeSubMenu` —
 * and the order arity gives the rows inside one of its sections: the checkboxes,
 * then the choice, then the values, so the row shape changes once down the menu
 * rather than flickering.
 */
const DotplotSettingsMenu = observer(function DotplotSettingsMenu({
  model,
}: {
  model: DotplotViewModel
}) {
  return (
    <CascadingMenuButton
      tooltip="Dotplot display settings"
      menuItems={() =>
        [
          toggleItem(
            'Draw CIGAR insertions/deletions',
            model.drawCigar,
            flag => {
              model.setDrawCigar(flag)
            },
            {
              helpText:
                'Toggle detailed CIGAR string visualization showing matches, insertions, and deletions in alignments. Disable for a cleaner view that shows only broad syntenic blocks.',
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
                "Carries each axis' ruler ticks across the plot as faint lines, in two weights, so a point can be read back to a coordinate without tracing to the axis. An axis with no room to number itself draws none at all, which at whole-genome zoom is both of them, and a tick already marked by a chromosome boundary is left to the boundary.",
            },
          ),
          ...lodMenuItems(model),
          makeSizeSubMenu({
            label: 'opacity',
            title: 'Opacity',
            help: 'Overall opacity of every plotted point. Lower values let dense overlapping alignments show through each other.',
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
            help: 'Screen-space thickness of each alignment, in pixels. Sub-pixel alignments render as dots, so a wider line makes a sparse whole-genome plot legible; a narrower one keeps a dense one from filling in.',
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
