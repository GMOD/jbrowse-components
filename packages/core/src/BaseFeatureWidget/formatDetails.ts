import {
  DEFAULT_FORMAT_DETAILS_DEPTH,
  mergeFormatCallbacks,
  readConfObject,
} from '../configuration/index.ts'
import { isPlainObject } from '../util/objectUtils.ts'

import type { AnyConfigurationModel } from '../configuration/index.ts'
import type {
  SimpleFeatureSerialized,
  SimpleFeatureSerializedNoId,
} from '../util/index.ts'

/**
 * The two config nodes carrying a `formatDetails` sub-schema. The session's
 * applies to every track; the track's is absent when the widget was opened
 * without one. The track's object spreads over the session's, and its numbers
 * win.
 */
export interface FormatDetailsTiers {
  session: AnyConfigurationModel
  track?: AnyConfigurationModel
}

function readCallback(
  conf: AnyConfigurationModel,
  where: string,
  slot: string,
  args: Record<string, unknown>,
) {
  try {
    const fields = mergeFormatCallbacks(
      readConfObject(conf, ['formatDetails', slot], args),
    )
    if (fields.subfeatures != null) {
      throw new Error(
        'a callback can hide subfeatures but not replace them; reshape each one with the subfeatures callback',
      )
    }
    return fields
  } catch (e) {
    throw new Error(`formatDetails.${slot} of ${where}: ${e}`, { cause: e })
  }
}

function readCallbacks(
  { session, track }: FormatDetailsTiers,
  slot: string,
  args: Record<string, unknown>,
) {
  return mergeFormatCallbacks(
    readCallback(session, 'the session configuration', slot, args),
    track
      ? readCallback(
          track,
          `track "${readConfObject(track, 'trackId')}"`,
          slot,
          args,
        )
      : undefined,
  )
}

/**
 * Whether either tier sets `slot`, read raw off the node: an arg-less read of
 * a `jexl:` slot evaluates it against an empty context just to find out it
 * exists. Both callback slots default to `{}`, so a config that never mentions
 * `formatDetails` answers false and the walk below is skipped entirely, which
 * matters on a RefSeq gene with 16k nested nodes.
 */
function declaresCallback(
  { session, track }: FormatDetailsTiers,
  slot: string,
) {
  return [session, track].some(conf => {
    const value = (
      conf?.formatDetails as Record<string, unknown> | undefined
    )?.[slot]
    return typeof value === 'string'
      ? value !== ''
      : isPlainObject(value) && Object.keys(value).length > 0
  })
}

/** `depth` or `maxDepth`: the track's value when set, else the session's. */
export function formatDetailsNumber(tiers: FormatDetailsTiers, slot: string) {
  const fromSession = readConfObject(tiers.session, ['formatDetails', slot])
  const fromTrack = tiers.track
    ? readConfObject(tiers.track, ['formatDetails', slot])
    : undefined
  return typeof fromTrack === 'number'
    ? fromTrack
    : typeof fromSession === 'number'
      ? fromSession
      : undefined
}

/**
 * The feature as the details panel shows it: each tier's `feature` callback
 * output spread over the clicked feature, and `subfeatures` output over each
 * subfeature down to `depth`. A key set to null or undefined hides that row,
 * since every detail component filters with `!= null`. A config declaring no
 * callback gets the input back untouched.
 */
export function applyFormatDetails(
  tiers: FormatDetailsTiers,
  feature: SimpleFeatureSerialized,
): SimpleFeatureSerialized {
  const formatsFeature = declaresCallback(tiers, 'feature')
  const formatsSubfeatures = declaresCallback(tiers, 'subfeatures')
  if (!formatsFeature && !formatsSubfeatures) {
    return feature
  }
  const depth = formatsSubfeatures
    ? (formatDetailsNumber(tiers, 'depth') ?? DEFAULT_FORMAT_DETAILS_DEPTH)
    : 0
  const track = tiers.track ? readConfObject(tiers.track) : undefined

  function format<T extends SimpleFeatureSerializedNoId>(
    node: T,
    level: number,
    fmt: Record<string, unknown>,
  ): T {
    const { subfeatures } = node
    return {
      ...node,
      ...(subfeatures && level < depth
        ? {
            subfeatures: subfeatures.map(sub =>
              format(
                sub,
                level + 1,
                readCallbacks(tiers, 'subfeatures', {
                  feature: sub,
                  parent: node,
                  depth: level + 1,
                  track,
                }),
              ),
            ),
          }
        : {}),
      ...fmt,
    }
  }

  return format(
    feature,
    0,
    formatsFeature ? readCallbacks(tiers, 'feature', { feature, track }) : {},
  )
}
