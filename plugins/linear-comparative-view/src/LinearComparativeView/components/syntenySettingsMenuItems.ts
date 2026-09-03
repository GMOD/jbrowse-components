import { makePin } from '@jbrowse/core/configuration'
import { makeSizeSubMenu } from '@jbrowse/core/ui'
import {
  promotableToggleItem,
  radioItems,
  toggleItem,
  withSubHeader,
} from '@jbrowse/core/ui/menuItems'
import { toLocale } from '@jbrowse/core/util'
import {
  MAX_MIN_LENGTH_BP,
  MIN_LENGTH_HELP,
  PAN_BUFFER_PX,
  lodMenuItems,
} from '@jbrowse/synteny-core'
import WarningIcon from '@mui/icons-material/WarningAmber'

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

import type { LinearSyntenyDisplayModel } from '../../LinearSyntenyDisplay/model.ts'
import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { SettingRowOptions } from '@jbrowse/core/ui/menuItems'

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
 * One RIBBONS checkbox whose state a reader can also make this session's
 * default for every synteny track, via the trailing pin.
 *
 * The checkbox and the pin write the same promotable config slot, exactly as
 * any other promotable setting's row: the checkbox writes this view's synteny
 * displays (every level — `setDrawCurves` fans out), the pin turns the setting
 * on for every open display of the type and offers that as the session-wide
 * default.
 *
 * `display` is the level the pin writes through — any one of them, since a
 * promoted default is keyed by display type rather than by track. A view with
 * no synteny display yet (the import form, a track still arriving) has no slot
 * to write and no ribbon to draw, so its row is disabled rather than a
 * checkbox that ticks nothing.
 */
function ribbonToggle({
  display,
  slot,
  value,
  setValue,
  label,
  ...opts
}: {
  display: LinearSyntenyDisplayModel | undefined
  slot: 'drawCurves' | 'drawLocationMarkers'
  value: boolean
  setValue: (value: boolean) => void
  label: string
} & SettingRowOptions): MenuItem {
  return display
    ? promotableToggleItem({
        label,
        checked: value,
        onToggle: () => {
          setValue(!value)
        },
        pin: makePin(display, slot, true),
        ...opts,
      })
    : toggleItem(label, value, setValue, {
        ...opts,
        disabled: true,
        disabledHelpText: 'Add a synteny track first — this is a track setting',
      })
}

/**
 * Every setting that decides what the ribbons look like and how much detail
 * feeds them, which is the whole of the division this view draws: the header
 * menu answers what the view IS — which genomes it stacks, where they point,
 * what leaves it — and this one answers what it LOOKS LIKE.
 *
 * A MENU, not a panel of laid-out rows. The panel put nine controls of four
 * different widget kinds — sliders, segmented toggles, dropdowns — in one grid,
 * and a grid whose control column holds a different shape on every line reads
 * as a form to fill in rather than a list to pick from.
 *
 * ONE ROW SHAPE, `label + [?] + (checkbox | chevron)`, whatever the setting's
 * arity: a boolean is a checkbox, a choice is a submenu of radios, and a
 * continuous value is a submenu holding its slider (`makeSizeSubMenu`). The
 * slider used to be drawn in the row itself, which is right where a track menu
 * has one of them and wrong here, where there are three: three two-line blocks
 * carrying a widget no other row has put the form back in the list.
 *
 * THREE SECTIONS, each a question rather than a kind of widget: RIBBONS is how
 * one alignment looks, DETAIL is how much of one is loaded and painted, and
 * SCOPE is which alignments make it into the picture at all — dropped for being
 * short, marked for having nowhere to land, or drawn past the edge of the
 * window. Min length and Overdraw read as unrelated until they are next to each
 * other under that heading, where they are the same question asked of feature
 * size and of screen extent.
 *
 * WITHIN a section, arity orders the rows: the checkboxes, then the choices,
 * then the values. Sections group by subject and nothing about a subject says
 * where its widget changes, so left alone the shape flickers down the menu — a
 * lone submenu sat between two checkboxes and read as a mis-set row rather than
 * as the next question. Ordered, the shape changes once per section.
 *
 * The wordy choices are what the panel's grid had to be widened for ("Alignment
 * blocks only" does not fit a segmented toggle's segment); as radio rows in
 * their own submenu they cost the top level nothing, and each option keeps the
 * help the option table already carries.
 *
 * A FUNCTION rather than a literal inside the button, so the pin coverage check
 * can walk the rows: `promotableSlotsWithoutPin` needs the built menu, and this
 * is the only surface LinearSyntenyDisplay's promotable slots have.
 */
export function syntenySettingsMenuItems(
  model: LinearSyntenyViewModel,
): MenuItem[] {
  const { cigarMode, hasCigarData } = model
  const display = model.allSyntenyDisplays[0]
  return [
    { type: 'subHeader', label: 'Ribbons' },
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
    ribbonToggle({
      display,
      slot: 'drawCurves',
      label: 'Curved lines',
      value: model.effectiveDrawCurves,
      setValue: v => {
        model.setDrawCurves(v)
      },
      helpText:
        'Draws each ribbon as a bezier curve rather than a straight chord. Reads much better at whole-genome scale, where straight crossings stack into noise.',
    }),
    ribbonToggle({
      display,
      slot: 'drawLocationMarkers',
      label: 'Location markers',
      value: model.effectiveDrawLocationMarkers,
      setValue: v => {
        model.setDrawLocationMarkers(v)
      },
      helpText:
        "Continues the query row's scalebar grid down through the ribbons: a tick at each round query coordinate, joined to the coordinate the alignment pairs it with.",
    }),
    {
      label: 'Thin fade',
      helpText: THIN_FADE_HELP,
      subMenu: radioItems(FADE_MODES, model.fadeThinAlignmentsMode, mode => {
        model.setFadeThinAlignmentsMode(mode)
      }),
    },
    makeSizeSubMenu({
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

    /*
      Gated on the data, not on config: a CIGAR-less PAF has no ops to
      draw, and an adapter with no coarse tier has nothing to switch
      between. Both rows are absent rather than disabled — a control over
      a choice that does not exist is a choice.

      THE HEADING GOES WITH THEM, derived from the rows rather than by
      re-testing what gated them: a CIGAR-less untiered PAF would
      otherwise render "DETAIL" with the next section's heading directly
      under it, and `lodMenuItems` is shared with two other surfaces, so
      a new reason for it to return nothing must not leave a heading
      stranded here.
    */
    ...withSubHeader('Detail', [
      ...(hasCigarData
        ? [
            {
              label: 'CIGAR indels',
              helpText:
                'How per-base insertions and deletions inside each alignment are shown.',
              // Built here rather than with `radioItems` because one row
              // differs: 'off' is the mode that can mislead, and the icon
              // says so on the row instead of only in its help.
              subMenu: CIGAR_MODE_OPTIONS.map(({ value, label, ...rest }) => ({
                label,
                ...rest,
                icon: value === 'off' ? WarningIcon : undefined,
                type: 'radio' as const,
                checked: cigarMode === value,
                onClick: () => {
                  model.setCigarMode(value)
                },
              })),
            },
          ]
        : []),
      ...lodMenuItems(model),
    ]),
    { type: 'subHeader', label: 'Scope' },
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
    makeSizeSubMenu({
      label: 'min length',
      title: 'Min length',
      help: MIN_LENGTH_HELP,
      min: DEFAULT_MIN_ALIGNMENT_LENGTH,
      max: MAX_MIN_LENGTH_BP,
      step: 1,
      scale: 'log',
      format: n => `${toLocale(n)}bp`,
      // A render parameter, like Opacity above — it never reaches the worker,
      // and the shader and the Canvas2D draw loop each cull on it per instance.
      // So what a drag costs is a repaint of the band per step, and this is
      // written on release because the band can be half a million ribbons where
      // Opacity's slider is usually read against a handful.
      commitOnRelease: true,
      getValue: () => model.minAlignmentLength,
      isDefault: model.minAlignmentLength === DEFAULT_MIN_ALIGNMENT_LENGTH,
      onChange: bp => {
        model.setMinAlignmentLength(bp)
      },
      onReset: () => {
        model.setMinAlignmentLength(DEFAULT_MIN_ALIGNMENT_LENGTH)
      },
    }),
    makeSizeSubMenu({
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
