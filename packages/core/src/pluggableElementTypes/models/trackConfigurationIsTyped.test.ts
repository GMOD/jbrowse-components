import type { IsAny } from '../../util/types/index.ts'
import type { BaseTrackModel, TrackModelOf } from './BaseTrackModel.ts'
import type { BaseTrackConfig } from './baseTrackConfig.ts'

// Typecheck-only: createBaseTrackModel took its schema as
// AnyConfigurationSchemaType, so a view's `track.configuration.trackId` read
// as `any`.
test("a shown track's configuration is the base track config", () => {
  const notAny: IsAny<BaseTrackModel['configuration']> = false
  const viewTrackNotAny: IsAny<TrackModelOf['configuration']['trackId']> = false
  const isBase: BaseTrackModel['configuration'] extends BaseTrackConfig
    ? true
    : false = true
  expect([notAny, viewTrackNotAny, isBase]).toEqual([false, false, true])
})

// The `displays` entries were PluggableConfigNode, whose `displayId` read as
// `any` through its index signature.
test("a track config's display entries name their id and type", () => {
  type Entry = BaseTrackConfig['displays'][number]
  const idNotAny: IsAny<Entry['displayId']> = false
  const typeNotAny: IsAny<Entry['type']> = false
  const otherIsUnknown: unknown extends Entry['height'] ? true : false = true
  expect([idNotAny, typeNotAny, otherIsUnknown]).toEqual([false, false, true])
})
