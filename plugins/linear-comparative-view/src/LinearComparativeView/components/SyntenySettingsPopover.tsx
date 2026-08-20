import { SingleSlider } from '@jbrowse/core/ui'
import {
  LOD_MODES,
  MIN_LENGTH_HELP,
  MinLengthSlider,
  OpacitySlider,
  PAN_BUFFER_PX,
  SettingRow,
  SettingSection,
  SettingSelect,
  SettingToggleGroup,
  SettingsPopover,
} from '@jbrowse/synteny-core'
import WarningIcon from '@mui/icons-material/WarningAmber'
import { observer } from 'mobx-react'

import { CIGAR_MODE_OPTIONS } from '../../LinearSyntenyView/cigarModes.ts'
import {
  OFFSCREEN_MATE_HELP,
  OFFSCREEN_MATE_MODE_OPTIONS,
} from '../../LinearSyntenyView/offscreenMateModes.ts'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'

const FADE_MODES = [
  { value: 'auto', label: 'Auto' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
] as const

const ON_OFF = [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
] as const

// 'off' is the mode that can mislead, so it carries the icon on the row itself
// rather than only in the tooltip — and in the closed control too, which is
// where the menu this replaced could not put it.
const CIGAR_OPTIONS = CIGAR_MODE_OPTIONS.map(({ value, label }) => ({
  value,
  label,
  icon: value === 'off' ? WarningIcon : undefined,
}))

// Composed from the options rather than written again beside them: a Select
// shows one label at a time where the menu form showed all three with their own
// help, and prose repeating what `cigarModes.ts` and `lodTier.ts` already say is
// prose that drifts from them.
//
// ONE LINE PER OPTION, which `HelpTooltip` honours: joined into a paragraph
// instead, three option descriptions read as one run-on sentence and the reader
// has to work out where each mode's ends.
const CIGAR_HELP = CIGAR_MODE_OPTIONS.reduce(
  (acc, o) => ('helpText' in o ? `${acc}\n${o.label} — ${o.helpText}` : acc),
  'How per-base insertions and deletions inside each alignment are shown.',
)

const LOD_HELP = LOD_MODES.map(m => `${m.label} — ${m.helpText}`).join('\n')

/**
 * Every setting that decides what the ribbons look like and how much detail
 * feeds them, which is the whole of the division this view draws: the header
 * menu answers what the view IS — which genomes it stacks, where they point,
 * what leaves it — and this panel answers what it LOOKS LIKE. Before, the split
 * ran between continuous and discrete instead, so "Identity fade" was a row here
 * while "Show curved lines" was two levels down a menu, and nothing about
 * either setting predicted which surface held it.
 *
 * THREE SECTIONS, each a question rather than a kind of widget: RIBBONS is how
 * one alignment looks, DETAIL is how much of one is loaded and painted, and
 * SCOPE is which alignments make it into the picture at all — dropped for being
 * short, marked for having nowhere to land, or drawn past the edge of the
 * window. Min length and Overdraw read as unrelated until they are next to each
 * other under that heading, where they are the same question asked of feature
 * size and of screen extent.
 *
 * WIDER THAN THE DOTPLOT'S, with a wider label column, because the three
 * settings that moved in are the wordy ones: a `SettingToggleGroup`'s segments
 * cannot hold "Alignment blocks only", so those rows are `SettingSelect`s and
 * the control column has to fit their longest option.
 */
const SyntenySettingsPopover = observer(function SyntenySettingsPopover({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  const {
    alpha,
    cigarMode,
    drawCurves,
    drawLocationMarkers,
    fadeThinAlignmentsMode,
    hasCigarData,
    hasLodCapableAdapter,
    lodMode,
    minAlignmentLength,
    offscreenMateMode,
    opacityByIdentity,
    overdrawPx,
  } = model
  return (
    <SettingsPopover
      title="Synteny display settings"
      width={440}
      labelWidth={120}
    >
      <SettingSection label="Ribbons" />
      <SettingRow
        label="Opacity:"
        help="Overall opacity of all synteny ribbons. Lower values let dense overlapping alignments show through each other."
      >
        <OpacitySlider
          value={alpha}
          onChange={v => {
            model.setAlpha(v)
          }}
        />
      </SettingRow>
      <SettingRow
        label="Identity fade:"
        help="Modulates ribbon opacity by per-feature sequence identity, independent of the color mode. Low-identity blocks fade out so identity-dropoff zones become visible without consuming the color channel."
      >
        <SettingToggleGroup
          ariaLabel="Identity fade"
          value={opacityByIdentity ? 'on' : 'off'}
          options={ON_OFF}
          onChange={v => {
            model.setOpacityByIdentity(v === 'on')
          }}
        />
      </SettingRow>
      <SettingRow
        label="Thin fade:"
        help="Fades sub-pixel-thin ribbons by their on-screen width, so an unfiltered whole-genome view doesn't read as a hard full-opacity hairball. Auto enables it only when the view is dense enough to tangle; a genuinely sparse comparison (e.g. distant species, every alignment sub-pixel) stays unfaded so the fade doesn't wash it out. On/Off pin it."
      >
        <SettingToggleGroup
          ariaLabel="Thin fade"
          value={fadeThinAlignmentsMode}
          options={FADE_MODES}
          onChange={v => {
            model.setFadeThinAlignmentsMode(v)
          }}
        />
      </SettingRow>
      <SettingRow
        label="Curved lines:"
        help="Draws each ribbon as a bezier curve rather than a straight chord. Reads much better at whole-genome scale, where straight crossings stack into noise."
      >
        <SettingToggleGroup
          ariaLabel="Curved lines"
          value={drawCurves ? 'on' : 'off'}
          options={ON_OFF}
          onChange={v => {
            model.setDrawCurves(v === 'on')
          }}
        />
      </SettingRow>
      <SettingRow
        label="Location markers:"
        help="Continues the query row's scalebar grid down through the ribbons: a tick at each round query coordinate, joined to the coordinate the alignment pairs it with."
      >
        <SettingToggleGroup
          ariaLabel="Location markers"
          value={drawLocationMarkers ? 'on' : 'off'}
          options={ON_OFF}
          onChange={v => {
            model.setDrawLocationMarkers(v === 'on')
          }}
        />
      </SettingRow>

      {/*
        Gated on the data, not on config: a CIGAR-less PAF has no ops to draw,
        and an adapter with no coarse tier has nothing to switch between. Both
        rows are absent rather than disabled — a control over a choice that does
        not exist is a choice.

        THE HEADING GOES WITH THEM. These are the only two rows in the section,
        so a CIGAR-less untiered PAF would otherwise render "DETAIL" with the
        next section's heading directly under it.
      */}
      {hasCigarData || hasLodCapableAdapter ? (
        <SettingSection label="Detail" />
      ) : null}
      {hasCigarData ? (
        <SettingRow label="CIGAR indels:" help={CIGAR_HELP}>
          <SettingSelect
            ariaLabel="CIGAR indels"
            value={cigarMode}
            options={CIGAR_OPTIONS}
            onChange={v => {
              model.setCigarMode(v)
            }}
          />
        </SettingRow>
      ) : null}
      {hasLodCapableAdapter ? (
        <SettingRow label="Level of detail:" help={LOD_HELP}>
          <SettingSelect
            ariaLabel="Level of detail"
            value={lodMode}
            options={LOD_MODES}
            onChange={v => {
              model.setLodMode(v)
            }}
          />
        </SettingRow>
      ) : null}
      <SettingSection label="Scope" />
      <SettingRow label="Min length:" help={MIN_LENGTH_HELP}>
        <MinLengthSlider
          value={minAlignmentLength}
          onCommit={bp => {
            model.setMinAlignmentLength(bp)
          }}
        />
      </SettingRow>
      {/*
        NOT GATED ON THERE BEING SOME. A count of zero is not the same as
        nothing to offer: the last step is the one that would go and find out,
        and gating the control on the number it exists to change is a door that
        only opens once you are already through it.
      */}
      <SettingRow label="Off-screen mates:" help={OFFSCREEN_MATE_HELP}>
        <SettingSelect
          ariaLabel="Off-screen mates"
          value={offscreenMateMode}
          options={OFFSCREEN_MATE_MODE_OPTIONS}
          onChange={v => {
            model.setOffscreenMateMode(v)
          }}
        />
      </SettingRow>
      <SettingRow
        label="Overdraw:"
        help="Extra pixels drawn beyond the visible area. Higher values keep off-screen synteny lines visible when scrolling, but may reduce performance."
      >
        {/*
          Capped at the pan buffer, which is what the worker emits out to
          (syntenyPanBufferPx: this floor, or half the viewport on a wide view).
          Past it there is no CIGAR detail and there are no location markers,
          because the geometry stage culled them — so the slider used to offer
          5x more overdraw than there was anything to draw, and spending it
          bought ribbons whose ticks stopped partway along. The floor rather
          than the width-scaled value so this holds at every viewport size
          without plumbing the width in; a wide view leaves a little on the
          table, and overdraw beyond one screen is already past what panning
          reveals before the fetch window rolls over.
        */}
        <SingleSlider
          value={overdrawPx}
          onChange={val => {
            model.setOverdrawPx(val)
          }}
          min={0}
          max={PAN_BUFFER_PX}
          step={100}
          valueLabelDisplay="auto"
          size="small"
          valueLabelFormat={(val: number) => `${val}px`}
        />
      </SettingRow>
    </SettingsPopover>
  )
})

export default SyntenySettingsPopover
