import { uiStub } from '@jbrowse/core/ReExports/uiStub'
import { clipSyntenyFeature, getAlignmentOps } from '@jbrowse/synteny-core'

import modules from './reExports.generated.ts'
import workerModules from './workerReExports.generated.ts'

const asNamespace = (value: unknown) => value as Record<string, unknown>

const STAYS_STUBBED: { reason: string; names: string[] }[] = [
  {
    reason: 'renders: returns JSX, or serializes through react-dom',
    names: [
      '@jbrowse/core/svg/serializeSvg#serializeSvg',
      '@jbrowse/core/svg/wrapSvgExport#wrapSvgExport',
      '@jbrowse/core/ui#replaceViewAction',
      '@jbrowse/core/util/renderToStaticMarkup#renderToStaticMarkup',
      '@jbrowse/display-kit/renderDisplaySvg#renderDisplaySvg',
      '@jbrowse/plugin-breakpoint-split-view#renderToSvg',
      '@jbrowse/plugin-circular-view#renderToSvg',
      '@jbrowse/plugin-dotplot-view#renderToSvg',
      '@jbrowse/plugin-linear-comparative-view#renderToSvg',
      '@jbrowse/plugin-linear-genome-view#renderToSvg',
      '@jbrowse/synteny-core#colorByMenuItems',
      '@jbrowse/wiggle-core/chrome#makeResolutionSubMenuItem',
    ],
  },
  {
    reason: 'holds React components',
    names: [
      '@jbrowse/display-ui#resolveOverlays',
      '@jbrowse/synteny-core#defaultSyntenyFileFormats',
    ],
  },
  {
    reason: 'builds menu rows in a module that names a Material icon',
    names: [
      '@jbrowse/plugin-alignments#getColorByMenuItem',
      '@jbrowse/plugin-alignments#getHitMenuItems',
      '@jbrowse/product-core#aboutTrackMenuItem',
      '@jbrowse/product-core#exportSessionMenuItem',
      '@jbrowse/product-core#importSessionMenuItem',
      '@jbrowse/product-core#newSessionMenuItem',
      '@jbrowse/product-core#openConnectionMenuItem',
      '@jbrowse/product-core#openTrackMenuItem',
      '@jbrowse/product-core#pluginStoreMenuItem',
      '@jbrowse/product-core#preferencesMenuItem',
      '@jbrowse/product-core#redoMenuItem',
      '@jbrowse/product-core#trackActionItems',
      '@jbrowse/product-core#trackActionMenuItems',
      '@jbrowse/product-core#trackListMenuItems',
      '@jbrowse/product-core#undoMenuItem',
      '@jbrowse/product-core#workspacesMenuItem',
      '@jbrowse/wiggle-core/chrome#makePointSizeSubMenu',
      '@jbrowse/wiggle-core/chrome#makeScatterPointSizeMenuItem',
    ],
  },
  {
    reason:
      'an MST model factory whose model imports its menus, dialogs or view components',
    names: [
      '@jbrowse/plugin-alignments/LinearAlignmentsDisplay/stateModel#default',
      '@jbrowse/plugin-canvas/LinearBasicDisplay/baseStateModel#default',
      '@jbrowse/plugin-canvas/LinearBasicDisplay/stateModel#default',
      '@jbrowse/plugin-linear-genome-view#linearGenomeViewStateModelFactory',
      '@jbrowse/plugin-wiggle/LinearWiggleDisplay/stateModel#default',
      '@jbrowse/product-core#TrackMenuItemsSessionMixin',
      '@jbrowse/product-core#TrackMenuSessionMixin',
    ],
  },
  {
    reason:
      'a plugin class, and each product builds its worker from its own copy of the core plugins',
    names: [
      '@jbrowse/plugin-alignments#default',
      '@jbrowse/plugin-authentication#default',
      '@jbrowse/plugin-blat#default',
      '@jbrowse/plugin-circular-view#default',
      '@jbrowse/plugin-dotplot-view#default',
      '@jbrowse/plugin-grid-bookmark#default',
      '@jbrowse/plugin-jobs-management#default',
      '@jbrowse/plugin-linear-comparative-view#default',
      '@jbrowse/plugin-linear-genome-view#default',
      '@jbrowse/plugin-maf#default',
      '@jbrowse/plugin-sv-inspector#default',
    ],
  },
  {
    reason:
      'published only through a module that renders and runs code at load, which keeps its whole graph',
    names: [
      '@jbrowse/display-kit/DisplayContextMenu#openContextMenuFromEvent',
      '@jbrowse/plugin-alignments/LinearAlignmentsDisplay/stateModel#ColorScheme',
      '@jbrowse/plugin-canvas/LinearBasicDisplay/baseStateModel#defaultColorItem',
    ],
  },
]

function stubbedMainThreadValues(key: string): [string, unknown][] {
  const main = asNamespace(modules[key])
  const worker = asNamespace(workerModules[key])
  return worker === uiStub
    ? [['default', main]]
    : Object.keys(worker)
        .filter(name => worker[name] === uiStub)
        .map(name => [name, main[name]])
}

function isComponentOrHook(name: string, value: unknown) {
  if (typeof value === 'object' && value !== null) {
    return '$$typeof' in value
  }
  if (typeof value !== 'function') {
    return false
  }
  const source = Function.prototype.toString.call(value)
  return (
    /^use[A-Z]/.test(name) ||
    /^use[A-Z]/.test(value.name) ||
    (/^[A-Z]/.test(value.name) &&
      !source.startsWith('class') &&
      /jsx|createElement/.test(source))
  )
}

test('an RPC worker adapter reads the synteny clip helpers for real', () => {
  const synteny = asNamespace(workerModules['@jbrowse/synteny-core'])
  expect(synteny.clipSyntenyFeature).toBe(clipSyntenyFeature)
  expect(synteny.getAlignmentOps).toBe(getAlignmentOps)
  expect(synteny.AnchorsSelector).toBe(uiStub)
})

test('every name the worker stubs is a component or a hook on the main thread, or says why not', () => {
  const data = Object.keys(modules)
    .filter(key => key.startsWith('@jbrowse/'))
    .flatMap(key =>
      stubbedMainThreadValues(key)
        .filter(([name, value]) => !isComponentOrHook(name, value))
        .map(([name]) => `${key}#${name}`),
    )
  const allowed = STAYS_STUBBED.flatMap(entry => entry.names)
  expect({
    unexplained: data.filter(name => !allowed.includes(name)),
    noLongerStubbed: allowed.filter(name => !data.includes(name)),
  }).toEqual({ unexplained: [], noLongerStubbed: [] })
})
