import { subcommandForViewType, viewTypeModes } from './modes.ts'
import {
  parseSpec,
  specMode,
  viewSettingsFromSpec,
  withViewSettings,
} from './spec.ts'

import type { ViewSpec } from './spec.ts'

const spec: ViewSpec = {
  type: 'LinearSyntenyView',
  views: [{ assembly: 'a' }, { assembly: 'b' }],
  opacity: 0.9,
  mark: { interpolate: 'bump' },
}

describe('viewSettingsFromSpec', () => {
  it('drops the type discriminator and keeps the rest', () => {
    expect(viewSettingsFromSpec(spec)).toEqual({
      views: [{ assembly: 'a' }, { assembly: 'b' }],
      opacity: 0.9,
      mark: { interpolate: 'bump' },
    })
  })
})

describe('withViewSettings', () => {
  it('writes --view over the spec, member by member', () => {
    const settings = viewSettingsFromSpec({
      ...spec,
      mark: { type: 'link', interpolate: 'bump' },
    })
    expect(
      withViewSettings(settings, { mark: { interpolate: 'linear' } }),
    ).toMatchObject({
      opacity: 0.9,
      mark: { type: 'link', interpolate: 'linear' },
    })
    expect(settings.mark).toEqual({ type: 'link', interpolate: 'bump' })
  })

  it('leaves the settings alone with no --view', () => {
    expect(withViewSettings({ a: 1 })).toEqual({ a: 1 })
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

describe('parseSpec', () => {
  it('parses inline JSON too long to be a path', () => {
    const inline = JSON.stringify({
      type: 'DotplotView',
      views: [],
      note: 'x'.repeat(5000),
    })
    expect(parseSpec(inline).type).toBe('DotplotView')
  })

  // JSON.parse reported a mistyped path as `Unexpected token 's'`, which reads
  // as a malformed spec rather than as the file that isn't there
  it('names a path that is not on disk as a missing file', () => {
    expect(() => parseSpec('synteny.jsno')).toThrow(/no such file/)
  })

  it('still reports a syntax error in JSON that was written inline', () => {
    expect(() => parseSpec('{"type":')).toThrow(SyntaxError)
  })
})
