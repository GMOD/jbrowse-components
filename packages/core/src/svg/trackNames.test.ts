import { notifySkippedSvgTracks } from './trackNames.ts'

import type { AnyConfigurationModel } from '../configuration/index.ts'
import type { AbstractSessionModel } from '../util/index.ts'

// A display with no renderSvg is skipped rather than failing the export, so the
// one thing standing between that and a figure silently short a track is this
// message. Both halves matter: it says nothing when nothing was skipped (an
// export of ordinary tracks must not nag), and it names the tracks when
// something was, because the SVG file itself carries no record of the omission.
describe('notifySkippedSvgTracks', () => {
  function mockSession() {
    const notifications: { message: string; level?: string }[] = []
    return {
      notifications,
      session: {
        notify: (message: string, level?: string) => {
          notifications.push({ message, level })
        },
      } as unknown as AbstractSessionModel,
    }
  }

  const track = (name: string) =>
    ({ configuration: { name } }) as unknown as {
      configuration: AnyConfigurationModel
    }

  it('says nothing when every track exported', () => {
    const { session, notifications } = mockSession()
    notifySkippedSvgTracks(session, [])
    expect(notifications).toEqual([])
  })

  it('names one skipped track, in the singular', () => {
    const { session, notifications } = mockSession()
    notifySkippedSvgTracks(session, [track('my methylation track')])
    expect(notifications).toHaveLength(1)
    expect(notifications[0]!.level).toBe('info')
    expect(notifications[0]!.message).toContain('my methylation track')
    expect(notifications[0]!.message).toContain('Its display type does not')
  })

  it('names several, in the plural', () => {
    const { session, notifications } = mockSession()
    notifySkippedSvgTracks(session, [track('one'), track('two')])
    expect(notifications[0]!.message).toContain('one, two')
    expect(notifications[0]!.message).toContain('Their display types do not')
  })
})
