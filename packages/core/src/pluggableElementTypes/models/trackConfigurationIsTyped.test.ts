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
