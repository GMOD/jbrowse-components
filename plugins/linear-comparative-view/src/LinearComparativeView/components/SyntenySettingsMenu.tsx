import { makeSizeMenu } from '@jbrowse/core/ui'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { radioItems, toggleItem } from '@jbrowse/core/ui/menuItems'
import { toLocale } from '@jbrowse/core/util'
import {
  MAX_MIN_LENGTH_BP,
  MIN_LENGTH_HELP,
  PAN_BUFFER_PX,
  lodMenuItems,
} from '@jbrowse/synteny-core'
import TuneIcon from '@mui/icons-material/Tune'
import WarningIcon from '@mui/icons-material/WarningAmber'
import { observer } from 'mobx-react'

import { CIGAR_MODE_OPTIONS } from '../../LinearSyntenyView/cigarModes.ts'
import {
  DEFAULT_ALPHA,
  DEFAULT_MIN_ALIGNMENT_LENGTH,
  DEFAULT_OVERDRAW_PX,
} from '../../LinearSyntenyView/model.ts'
import {
  OFFSCREEN_MATE_HELP,
  OFFSCREEN_MATE_MODE_OPTIONS,
} from '../../LinearSyntenyView/offscreenMateModes.ts'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const FADE_MODES = [
  { value: 'auto', label: 'Auto' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
] as const

const THIN_FADE_HELP =
  'Fades sub-pixel-thin ribbons by their on-screen width, so an unfiltered ' +
  'whole-genome view does not read as a hard full-opacity hairball. Auto ' +
  'enables it only when the view is dense enough to tangle; a genuinely ' +
  'sparse comparison (e.g. distant species, every alignment sub-pixel) stays ' +
  'unfaded so the fade does not wash it out. On/Off pin it.'

/**
 * Every setting that decides what the ribbons look like and how much detail
 * feeds them, which is the whole of the division this view draws: the header
 * menu answers what the view IS — which genomes it stacks, where they point,
 * what leaves it — and this one answers what it LOOKS LIKE.
 *
 * A MENU, not a panel of laid-out rows. The panel put nine controls of four
 * different widget kinds — sliders, segmented toggles, dropdowns — in one grid,
 * and a grid whose control column holds a different shape on every line reads
 * as a form to fill in rather than a list to pick from. A menu gives every
 * setting the same row shape whatever its arity: a boolean is a checkbox, a
 * choice is a submenu of radios, and only a continuous value draws a widget of
 * its own (`makeSizeMenu`, the inline slider row every track menu already
 * uses).
 *
 * THREE SECTIONS, each a question rather than a kind of widget: RIBBONS is how
 * one alignment looks, DETAIL is how much of one is loaded and painted, and
 * SCOPE is which alignments make it into the picture at all — dropped for being
 * short, marked for having nowhere to land, or drawn past the edge of the
 * window. Min length and Overdraw read as unrelated until they are next to each
 * other under that heading, where they are the same question asked of feature
 * size and of screen extent.
 *
 * The wordy choices are what the panel's grid had to be widened for ("Alignment
 * blocks only" does not fit a segmented toggle's segment); as radio rows in
 * their own submenu they cost the top level nothing, and each option keeps the
 * help the option table already carries.
 */
const SyntenySettingsMenu = observer(function SyntenySettingsMenu({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  const { cigarMode, hasCigarData, hasLodCapableAdapter } = model
  return (
    <CascadingMenuButton
      tooltip="Synteny display settings"
      menuItems={() =>
        [
          { type: 'subHeader', label: 'Ribbons' },
          makeSizeMenu({
            label: 'opacity',
            title: 'Opacity',
            help: 'Overall opacity of all synteny ribbons. Lower values let dense overlapping alignments show through each other.',
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
          toggleItem(
            'Identity fade',
            model.opacityByIdentity,
            v => {
              model.setOpacityByIdentity(v)
            },
            {
              helpText:
                'Modulates ribbon opacity by per-feature sequence identity, independent of the color mode. Low-identity blocks fade out so identity-dropoff zones become visible without consuming the color channel.',
            },
          ),
          {
            label: 'Thin fade',
            helpText: THIN_FADE_HELP,
            subMenu: radioItems(
              FADE_MODES,
              model.fadeThinAlignmentsMode,
              mode => {
                model.setFadeThinAlignmentsMode(mode)
              },
            ),
          },
          toggleItem(
            'Curved lines',
            model.drawCurves,
            v => {
              model.setDrawCurves(v)
            },
            {
              helpText:
                'Draws each ribbon as a bezier curve rather than a straight chord. Reads much better at whole-genome scale, where straight crossings stack into noise.',
            },
          ),
          toggleItem(
            'Location markers',
            model.drawLocationMarkers,
            v => {
              model.setDrawLocationMarkers(v)
            },
            {
              helpText:
                "Continues the query row's scalebar grid down through the ribbons: a tick at each round query coordinate, joined to the coordinate the alignment pairs it with.",
            },
          ),

          /*
            Gated on the data, not on config: a CIGAR-less PAF has no ops to
            draw, and an adapter with no coarse tier has nothing to switch
            between. Both rows are absent rather than disabled — a control over
            a choice that does not exist is a choice.

            THE HEADING GOES WITH THEM. These are the only two rows in the
            section, so a CIGAR-less untiered PAF would otherwise render
            "DETAIL" with the next section's heading directly under it.
          */
          ...(hasCigarData || hasLodCapableAdapter
            ? [{ type: 'subHeader' as const, label: 'Detail' }]
            : []),
          ...(hasCigarData
            ? [
                {
                  label: 'CIGAR indels',
                  helpText:
                    'How per-base insertions and deletions inside each alignment are shown.',
                  // Built here rather than with `radioItems` because one row
                  // differs: 'off' is the mode that can mislead, and the icon
                  // says so on the row instead of only in its help.
                  subMenu: CIGAR_MODE_OPTIONS.map(
                    ({ value, label, ...rest }) => ({
                      label,
                      ...rest,
                      icon: value === 'off' ? WarningIcon : undefined,
                      type: 'radio' as const,
                      checked: cigarMode === value,
                      onClick: () => {
                        model.setCigarMode(value)
                      },
                    }),
                  ),
                },
              ]
            : []),
          ...lodMenuItems(model),
          { type: 'subHeader', label: 'Scope' },
          makeSizeMenu({
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
          /*
            NOT GATED ON THERE BEING SOME. A count of zero is not the same as
            nothing to offer: the last step is the one that would go and find
            out, and gating the control on the number it exists to change is a
            door that only opens once you are already through it.
          */
          {
            label: 'Off-screen mates',
            helpText: OFFSCREEN_MATE_HELP,
            subMenu: radioItems(
              OFFSCREEN_MATE_MODE_OPTIONS,
              model.offscreenMateMode,
              mode => {
                model.setOffscreenMateMode(mode)
              },
            ),
          },
          makeSizeMenu({
            label: 'overdraw',
            title: 'Overdraw',
            help: 'Extra pixels drawn beyond the visible area. Higher values keep off-screen synteny lines visible when scrolling, but may reduce performance.',
            min: 0,
            // Capped at the pan buffer, which is what the worker emits out to
            // (syntenyPanBufferPx: this floor, or half the viewport on a wide
            // view). Past it there is no CIGAR detail and there are no location
            // markers, because the geometry stage culled them — so the slider
            // used to offer 5x more overdraw than there was anything to draw,
            // and spending it bought ribbons whose ticks stopped partway along.
            // The floor rather than the width-scaled value so this holds at
            // every viewport size without plumbing the width in; a wide view
            // leaves a little on the table, and overdraw beyond one screen is
            // already past what panning reveals before the fetch window rolls
            // over.
            max: PAN_BUFFER_PX,
            step: 100,
            getValue: () => model.overdrawPx,
            isDefault: model.overdrawPx === DEFAULT_OVERDRAW_PX,
            onChange: v => {
              model.setOverdrawPx(v)
            },
            onReset: () => {
              model.setOverdrawPx(DEFAULT_OVERDRAW_PX)
            },
          }),
        ] satisfies MenuItem[]
      }
    >
      <TuneIcon />
    </CascadingMenuButton>
  )
})

export default SyntenySettingsMenu
