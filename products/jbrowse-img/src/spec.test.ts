import { dotplotViewKnobs, syntenyViewKnobs } from './comparativeInit.ts'
import { subcommandForViewType, viewTypeModes } from './modes.ts'
import { specMode, viewSettingsFromSpec } from './spec.ts'

import type { ViewSpec } from './spec.ts'

const spec: ViewSpec = {
  type: 'LinearSyntenyView',
  views: [{ assembly: 'a' }, { assembly: 'b' }],
  alpha: 0.9,
  drawCurves: true,
}

describe('viewSettingsFromSpec', () => {
  it('drops the type discriminator and keeps the rest', () => {
    expect(viewSettingsFromSpec(spec)).toEqual({
      views: [{ assembly: 'a' }, { assembly: 'b' }],
      alpha: 0.9,
      drawCurves: true,
    })
  })

  it('lets an explicit flag win over the spec', () => {
    // `--spec view.json --alpha 0.2` parsed and validated --alpha, then applied
    // it nowhere
    expect(
      viewSettingsFromSpec(spec, syntenyViewKnobs({ alpha: 0.2 })),
    ).toMatchObject({ alpha: 0.2 })
  })

  it('leaves a setting the flags never mention alone', () => {
    expect(
      viewSettingsFromSpec(spec, syntenyViewKnobs({ colorBy: 'query' })),
    ).toMatchObject({ alpha: 0.9, drawCurves: true, colorBy: 'query' })
  })

  it('leaves a spec boolean alone when the flag is off', () => {
    // an absent boolean flag arrives as false, and the view applies an explicit
    // false — so the knob builder has to drop it before the merge sees it
    expect(
      viewSettingsFromSpec(spec, syntenyViewKnobs({ drawCurves: false })),
    ).toMatchObject({ drawCurves: true })
  })

  it('merges only the shared knobs for a dotplot', () => {
    const settings = viewSettingsFromSpec(
      { type: 'DotplotView', views: [], colorBy: 'target' },
      dotplotViewKnobs({ colorBy: 'query', alpha: 0.2 }),
    )
    expect(settings).toMatchObject({ colorBy: 'query' })
    expect(settings).not.toHaveProperty('alpha')
  })
})

describe('the linear view is not a --spec target', () => {
  it('refuses a LinearGenomeView spec', () => {
    expect(() => specMode({ type: 'LinearGenomeView' })).toThrow(
      /unsupported view type/,
    )
  })

  it('still names lgv when pointing at the subcommand that can draw one', () => {
    // the two halves of the same invariant: absent from the --spec map, present
    // in the answer a wrong-view-type error gives
    expect(viewTypeModes.has('LinearGenomeView')).toBe(false)
    expect(subcommandForViewType('LinearGenomeView')).toBe('lgv')
  })

  it('has no subcommand to name for a view type jb2export cannot draw', () => {
    expect(subcommandForViewType('SpreadsheetView')).toBeUndefined()
  })
})
