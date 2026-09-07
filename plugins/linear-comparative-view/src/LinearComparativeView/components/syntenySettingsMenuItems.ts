import { makePin } from '@jbrowse/core/configuration'
import { makeSizeSubMenu } from '@jbrowse/core/ui'
import { toggleItem, withSubHeader } from '@jbrowse/core/ui/menuItems'
import { toLocale } from '@jbrowse/core/util'
import {
  MAX_MIN_LENGTH_BP,
  MIN_LENGTH_HELP,
  lodMenuItems,
} from '@jbrowse/synteny-core'
import WarningIcon from '@mui/icons-material/WarningAmber'

import { CIGAR_MODE_OPTIONS } from '../../LinearSyntenyView/cigarModes.ts'
import {
  DEFAULT_ALPHA,
  DEFAULT_MIN_ALIGNMENT_LENGTH,
} from '../../LinearSyntenyView/consts.ts'

import type { LinearSyntenyDisplayModel } from '../../LinearSyntenyDisplay/model.ts'
import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { SettingRowOptions } from '@jbrowse/core/ui/menuItems'

/**
 * One RIBBONS checkbox whose state a reader can also make this session's
 * default for every synteny track, via the trailing pin.
 *
 * The checkbox and the pin write the same promotable config slot, exactly as
 * any other promotable setting's row: the checkbox writes this view's synteny
 * displays (every level — `setDrawCurves` fans out), the pin applies the
 * checkbox's current state to every open display of the type and offers it as
 * the session-wide default, or clears that default once it is one.
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
    ? toggleItem(label, value, setValue, {
        ...opts,
        pin: makePin(display, slot),
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
 * short, or marked for having nowhere to land.
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
          'Fade each ribbon by its sequence identity, whatever the color mode.',
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
        "Carry the upper row's scalebar ticks down through the ribbons to the coordinates they pair with.",
    }),
    makeSizeSubMenu({
      label: 'opacity',
      title: 'Opacity',
      help: 'Lower lets overlapping ribbons show through each other.',
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
                'How insertions and deletions inside an alignment are drawn.',
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
    toggleItem(
      'Off-screen mates',
      model.showOffscreenMates,
      v => {
        model.setShowOffscreenMates(v)
      },
      {
        helpText:
          'Mark alignments whose other end is off screen or on a contig the facing panel is not showing. Costs a second query per panel pair on an indexed file.',
      },
    ),
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
  ] satisfies MenuItem[]
}
