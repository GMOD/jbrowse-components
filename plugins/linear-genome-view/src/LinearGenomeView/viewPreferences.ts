import { readConfObject } from '@jbrowse/core/configuration'
import {
  isSessionModel,
  isSessionWithMultipleViews,
  localStorageGetBoolean,
  localStorageGetItem,
  localStorageRemoveItem,
  localStorageSetBoolean,
  localStorageSetItem,
  notifyLocalStorageKey,
} from '@jbrowse/core/util'
import { VIEW_TRACK_LABEL_MODES } from '@jbrowse/display-kit/types'

import type { LinearGenomeViewModel } from './model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { ResettablePreference } from '@jbrowse/core/ui/preferencesPanels'
import type { TrackConfigChange } from '@jbrowse/core/util'
import type { ViewTrackLabelMode } from '@jbrowse/display-kit/types'

/**
 * The view settings a new linear genome view starts from: this browser's last
 * choice, stored under `key`, else `defaultValue`. A view's menu records its
 * choice here, and the Preferences dialog's "Linear genome view" tab edits the
 * same keys.
 */
export const LGV_TOGGLES = [
  {
    key: 'lgv-showCenterLine',
    defaultValue: false,
    label: 'Show center line',
    setter: 'setShowCenterLine',
  },
  {
    key: 'lgv-showCytobands',
    defaultValue: true,
    label: 'Show ideogram',
    setter: 'setShowCytobands',
  },
  {
    key: 'lgv-showTrackOutlines',
    defaultValue: true,
    label: 'Show track outlines',
    setter: 'setShowTrackOutlines',
  },
  {
    key: 'lgv-colorByFrame',
    defaultValue: false,
    label: 'Show CDS reading frame colors',
    setter: 'setColorByFrame',
  },
  {
    key: 'lgv-showAminoAcids',
    defaultValue: true,
    label: 'Show amino acids when zoomed in',
    setter: 'setShowAminoAcids',
  },
] as const

export type LgvToggle = (typeof LGV_TOGGLES)[number]
export type LgvToggleKey = LgvToggle['key']

export const TRACK_LABELS_KEY = 'lgv-trackLabels'

function toggleFor(key: LgvToggleKey) {
  return LGV_TOGGLES.find(t => t.key === key)!
}

export function storedToggle(key: LgvToggleKey) {
  return localStorageGetBoolean(key, toggleFor(key).defaultValue)
}

// a stored mode this build does not know reads as unset, the plugin default
export function storedTrackLabels() {
  const stored = localStorageGetItem(TRACK_LABELS_KEY)
  return VIEW_TRACK_LABEL_MODES.find(mode => mode === stored) ?? ''
}

/** The session's top-level linear genome views, which the tab's edits reach. */
export function lgvViews(session: unknown) {
  return isSessionWithMultipleViews(session)
    ? session.views.filter(
        (v): v is LinearGenomeViewModel => v.type === 'LinearGenomeView',
      )
    : []
}

export function setToggle(
  views: readonly LinearGenomeViewModel[],
  key: LgvToggleKey,
  flag: boolean,
) {
  const toggle = toggleFor(key)
  for (const view of views) {
    view[toggle.setter](flag)
  }
  localStorageSetBoolean(key, flag)
  notifyLocalStorageKey(key)
}

/**
 * The root config's `LinearGenomeViewPlugin.trackLabels`, a namespace only
 * products that load this plugin declare, so the root config's own type does
 * not name it.
 */
export function sessionTrackLabels(session: {
  configuration: AnyConfigurationModel
}): ViewTrackLabelMode {
  const configured: unknown = readConfObject(session.configuration, [
    'LinearGenomeViewPlugin',
    'trackLabels',
  ])
  return VIEW_TRACK_LABEL_MODES.find(mode => mode === configured) ?? 'offset'
}

export function configTrackLabels(session: unknown) {
  return isSessionModel(session) ? sessionTrackLabels(session) : 'offset'
}

export function setTrackLabels(
  views: readonly LinearGenomeViewModel[],
  mode: ViewTrackLabelMode | '',
  configDefault: ViewTrackLabelMode,
) {
  for (const view of views) {
    view.setTrackLabels(mode || configDefault)
  }
  if (mode) {
    localStorageSetItem(TRACK_LABELS_KEY, mode)
  } else {
    localStorageRemoveItem(TRACK_LABELS_KEY)
  }
  notifyLocalStorageKey(TRACK_LABELS_KEY)
}

const PREFIX = 'Linear genome view: '

/**
 * The rows "Reset to defaults" lists and reverts for this tab: each setting a
 * stored choice moves off its default.
 */
export const LGV_RESETTABLE: ResettablePreference[] = [
  ...LGV_TOGGLES.map(t => ({
    head: t.key,
    change: (): TrackConfigChange | undefined => {
      const current = storedToggle(t.key)
      return current === t.defaultValue
        ? undefined
        : {
            path: [t.key],
            label: PREFIX + t.label.toLowerCase(),
            from: t.defaultValue,
            to: current,
          }
    },
    reset: (session: unknown) => {
      setToggle(lgvViews(session), t.key, t.defaultValue)
      localStorageRemoveItem(t.key)
    },
  })),
  {
    head: TRACK_LABELS_KEY,
    change: (session: unknown): TrackConfigChange | undefined => {
      const stored = storedTrackLabels()
      const dflt = configTrackLabels(session)
      return stored && stored !== dflt
        ? {
            path: [TRACK_LABELS_KEY],
            label: `${PREFIX}track labels`,
            from: dflt,
            to: stored,
          }
        : undefined
    },
    reset: (session: unknown) => {
      setTrackLabels(lgvViews(session), '', configTrackLabels(session))
    },
  },
]
