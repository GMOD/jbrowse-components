import { ConfigurationSchema } from '../configuration/configurationSchema.ts'
import {
  displayMisnamed,
  unappliedSettingsMessages,
} from './unknownSnapshotKeys.ts'

const rows = ConfigurationSchema(
  'ReportRows',
  { step: { type: 'number', defaultValue: 10 } },
  { misnamed: { height: 'step' } },
)

const displaySchema = ConfigurationSchema(
  'ReportDisplay',
  { rows },
  {
    explicitlyTyped: true,
    explicitIdentifier: 'displayId',
    misnamed: { rowHeight: 'rows.step' },
  },
)

const display = { configuration: displaySchema.create({ displayId: 'd' }) }
const label = 'ReportDisplay for track "t"'

test("a display's misnamed words are its config schema's", () => {
  expect(displayMisnamed(display)).toEqual({ rowHeight: 'rows.step' })
  expect(displayMisnamed({})).toEqual({})
  expect(displayMisnamed(undefined)).toEqual({})
})

test('a misnamed key points at its path over the setter the display has', () => {
  expect(
    unappliedSettingsMessages(
      label,
      [{ key: 'rowHeight', reason: 'setter-only' }],
      displayMisnamed(display),
    ),
  ).toEqual([
    'ReportDisplay for track "t" did not apply rowHeight: no config slot takes it — did you mean rows.step?',
  ])
})

test('the other keys keep their own sentences', () => {
  expect(
    unappliedSettingsMessages(
      label,
      [
        { key: 'rowHeight', reason: 'no-slot' },
        { key: 'scrollTop', reason: 'setter-only' },
        { key: 'colour', reason: 'no-slot' },
      ],
      displayMisnamed(display),
    ),
  ).toEqual([
    'ReportDisplay for track "t" did not apply rowHeight: no config slot takes it — did you mean rows.step?',
    'ReportDisplay for track "t" ignored unknown key(s): colour',
    'ReportDisplay for track "t" did not apply scrollTop: no config slot takes it. Call setScrollTop on the display instead.',
  ])
})
