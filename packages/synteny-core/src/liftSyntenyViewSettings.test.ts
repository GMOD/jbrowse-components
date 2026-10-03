import { liftSyntenyViewSettings } from './liftSyntenyViewSettings.ts'

// launch links the genomes portal handed out hold the mode string on the view
test('a mode string lifts into the field it paints', () => {
  expect(liftSyntenyViewSettings({ colorBy: 'strand' })).toEqual({
    color: { field: 'strand' },
  })
  expect(liftSyntenyViewSettings({ colorBy: 'mappingQuality' })).toEqual({
    color: { field: 'mapq' },
  })
  expect(liftSyntenyViewSettings({ colorBy: 'meanQueryIdentity' })).toEqual({
    color: { field: 'identity' },
  })
  expect(liftSyntenyViewSettings({ colorBy: 'default' })).toEqual({
    color: undefined,
  })
})

test('a snapshot with no colorBy is left alone', () => {
  const snap = { color: { field: 'track' }, init: { views: [] } }
  expect(liftSyntenyViewSettings(snap)).toBe(snap)
})

// v4.3.0 held colorBy, alpha and minAlignmentLength on each synteny display
test('a v4.3.0 display setting lands on the view', () => {
  const lifted = liftSyntenyViewSettings({
    levels: [
      {
        tracks: [
          {
            type: 'SyntenyTrack',
            displays: [
              {
                type: 'LinearSyntenyDisplay',
                colorBy: 'strand',
                alpha: 0.6,
                minAlignmentLength: 500,
              },
            ],
          },
        ],
      },
    ],
  })
  expect(lifted).toMatchObject({
    color: { field: 'strand' },
    opacity: 0.6,
    minAlignmentLength: 500,
  })
  expect(lifted).not.toHaveProperty('colorBy')
  expect(lifted).not.toHaveProperty('alpha')
})

test("a dotplot's display colorBy lands, and the view's own setting wins", () => {
  expect(
    liftSyntenyViewSettings({
      tracks: [{ displays: [{ type: 'DotplotDisplay', colorBy: 'query' }] }],
    }),
  ).toMatchObject({ color: { field: 'query' } })
  expect(
    liftSyntenyViewSettings({
      alpha: 0.9,
      tracks: [{ displays: [{ alpha: 0.1 }] }, 'a_track_id'],
    }),
  ).toMatchObject({ opacity: 0.9 })
})

// share links and figure specs written before the opacity object say alpha
test("a view's alpha is the opacity object's constant, which wins if written", () => {
  expect(liftSyntenyViewSettings({ alpha: 0.3 })).toEqual({ opacity: 0.3 })
  expect(
    liftSyntenyViewSettings({ alpha: 0.3, opacity: { field: 'identity' } }),
  ).toEqual({ opacity: { field: 'identity' } })
})
