import type { IJsonPatch } from '@jbrowse/mobx-state-tree'

import {
  ActionType,
  type ClassificationRule,
  type ClassifiedAction,
} from './ActionTypes.ts'

const classificationRules: ClassificationRule[] = [
  {
    pathPattern: /\/views\/\d+\/bpPerPx$/,
    op: 'replace',
    classify: (patch, reversePatch) => ({
      type:
        patch.value < reversePatch.value
          ? ActionType.ZOOM_IN
          : ActionType.ZOOM_OUT,
      metadata: {
        oldBpPerPx: reversePatch.value as number,
        newBpPerPx: patch.value as number,
        zoomFactor: (reversePatch.value as number) / (patch.value as number),
      },
    }),
  },
  {
    pathPattern: /\/views\/\d+\/offsetPx$/,
    op: 'replace',
    classify: (patch, reversePatch) => ({
      type:
        patch.value > reversePatch.value
          ? ActionType.PAN_RIGHT
          : ActionType.PAN_LEFT,
      metadata: {
        deltaPixels:
          (patch.value as number) - (reversePatch.value as number),
      },
    }),
  },
  {
    pathPattern: /\/views\/\d+\/displayedRegions$/,
    op: 'replace',
    classify: patch => ({
      type: ActionType.SEARCH,
      metadata: { regions: patch.value },
    }),
  },
  {
    pathPattern: /\/views\/\d+\/tracks\/\d+$/,
    op: 'add',
    classify: patch => ({
      type: ActionType.TOGGLE_TRACK,
      metadata: {
        trackId: (patch.value as Record<string, unknown>)?.trackId,
        added: true,
      },
    }),
  },
  {
    pathPattern: /\/views\/\d+\/tracks\/\d+$/,
    op: 'remove',
    classify: patch => ({
      type: ActionType.TOGGLE_TRACK,
      metadata: {
        trackId: (patch.value as Record<string, unknown>)?.trackId,
        added: false,
      },
    }),
  },
  {
    pathPattern: /\/widgets\/[^/]+$/,
    op: 'add',
    classify: patch => ({
      type: ActionType.OPEN_WIDGET,
      metadata: {
        widgetType: (patch.value as Record<string, unknown>)?.type,
      },
    }),
  },
  {
    pathPattern: /\/widgets\/[^/]+$/,
    op: 'remove',
    classify: () => ({
      type: ActionType.CLOSE_WIDGET,
      metadata: {},
    }),
  },
  {
    pathPattern: /\/views\/\d+$/,
    op: 'add',
    classify: patch => ({
      type: ActionType.ADD_VIEW,
      metadata: {
        viewType: (patch.value as Record<string, unknown>)?.type,
      },
    }),
  },
]

export default class ActionClassifier {
  classify(patch: IJsonPatch, reversePatch: IJsonPatch): ClassifiedAction {
    for (const rule of classificationRules) {
      if (rule.pathPattern.test(patch.path) && patch.op === rule.op) {
        const { type, metadata } = rule.classify(patch, reversePatch)
        return { type, timestamp: Date.now(), patch, reversePatch, metadata }
      }
    }
    return {
      type: ActionType.UNKNOWN,
      timestamp: Date.now(),
      patch,
      reversePatch,
      metadata: {},
    }
  }
}
