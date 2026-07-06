import { canLaunchSyntenyForMate } from './util.ts'

describe('canLaunchSyntenyForMate', () => {
  const trackAssemblyNames = ['volvox', 'volvox_del2']

  it('allows launch when the mate is a declared assembly of the track', () => {
    // holds even for an assembly that is not loaded yet — it resolves on demand
    // when the synteny view opens
    expect(canLaunchSyntenyForMate(trackAssemblyNames, 'volvox_del2')).toBe(true)
  })

  it('hides launch for a one-vs-all sample label not in assemblyNames', () => {
    // one-vs-all mates that are only a PanSN sample prefix, not a listed
    // assembly, are not launchable
    expect(canLaunchSyntenyForMate(trackAssemblyNames, 'sampleB')).toBe(false)
  })

  it('hides launch when there is no mate assembly', () => {
    expect(canLaunchSyntenyForMate(trackAssemblyNames, undefined)).toBe(false)
  })
})
