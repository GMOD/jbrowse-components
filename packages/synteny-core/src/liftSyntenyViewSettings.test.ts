import { liftSyntenyViewSettings } from './liftSyntenyViewSettings.ts'

// launch links the genomes portal handed out hold the mode string on the view
test('a mode string lifts into the field it paints', () => {
  expect(liftSyntenyViewSettings({ colorBy: 'strand' })).toEqual({
    encoding: { color: { field: 'strand' } },
  })
  expect(liftSyntenyViewSettings({ colorBy: 'mappingQuality' })).toEqual({
    encoding: { color: { field: 'mapq' } },
  })
  expect(liftSyntenyViewSettings({ colorBy: 'meanQueryIdentity' })).toEqual({
    encoding: { color: { field: 'identity' } },
  })
  expect(liftSyntenyViewSettings({ colorBy: 'default' })).toEqual({})
})

test('a snapshot with no colorBy is left alone', () => {
  const snap = { encoding: { color: 'track' }, init: { views: [] } }
  expect(liftSyntenyViewSettings(snap)).toBe(snap)
})

// jb2hubs' desktop links write the view's `color` as it was before `encoding`
test("a view's color lands as encoding.color, a bare string the constant", () => {
  expect(liftSyntenyViewSettings({ color: { field: 'query' } })).toEqual({
    encoding: { color: { field: 'query' } },
  })
  expect(liftSyntenyViewSettings({ color: 'grey' })).toEqual({
    encoding: { color: { value: 'grey' } },
  })
  expect(
    liftSyntenyViewSettings({
      color: { field: 'identity', scale: 'threshold', domain: [0.9] },
    }),
  ).toEqual({
    encoding: {
      color: { field: 'identity', scale: { type: 'threshold', domain: [0.9] } },
    },
  })
  expect(
    liftSyntenyViewSettings({
      color: { field: 'query' },
      colorBy: 'strand',
      encoding: { opacity: 0.4 },
    }),
  ).toEqual({ encoding: { color: { field: 'query' }, opacity: 0.4 } })
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
    encoding: { color: { field: 'strand' }, opacity: 0.6 },
    filter: [{ field: 'length', gte: 500 }],
  })
  expect(lifted).not.toHaveProperty('colorBy')
  expect(lifted).not.toHaveProperty('alpha')
  expect(lifted).not.toHaveProperty('minAlignmentLength')
})

test("a dotplot's display colorBy lands, and the view's own setting wins", () => {
  expect(
    liftSyntenyViewSettings({
      tracks: [{ displays: [{ type: 'DotplotDisplay', colorBy: 'query' }] }],
    }),
  ).toMatchObject({ encoding: { color: { field: 'query' } } })
  expect(
    liftSyntenyViewSettings({
      alpha: 0.9,
      tracks: [{ displays: [{ alpha: 0.1 }] }, 'a_track_id'],
    }),
  ).toMatchObject({ encoding: { opacity: 0.9 } })
})

// share links and figure specs written before the opacity channel say alpha
test("a view's alpha is encoding.opacity's constant, which wins if written", () => {
  expect(liftSyntenyViewSettings({ alpha: 0.3 })).toEqual({
    encoding: { opacity: 0.3 },
  })
  expect(
    liftSyntenyViewSettings({
      alpha: 0.3,
      encoding: { opacity: { field: 'identity' } },
    }),
  ).toEqual({ encoding: { opacity: { field: 'identity' } } })
})

test('cigarMode and drawCigar land as the indels part', () => {
  expect(liftSyntenyViewSettings({ cigarMode: 'off' })).toEqual({
    indels: { show: false },
  })
  expect(liftSyntenyViewSettings({ cigarMode: 'matches' })).toEqual({
    indels: { encoding: { opacity: { value: 0 } } },
  })
  expect(liftSyntenyViewSettings({ cigarMode: 'full' })).toEqual({})
  expect(liftSyntenyViewSettings({ drawCigar: false })).toEqual({
    indels: { show: false },
  })
})
