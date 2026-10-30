# @jbrowse/display-kit

The layer a track type is built on. Everything between a worker fetch and a
canvas that is not the pixels themselves: the two fetch foundations
(`MultiRegionDisplayMixin`, `GlobalFetchMixin`), the byte gate
(`RegionTooLargeMixin`), the display chrome (`DisplayChrome`), SVG export
(`renderDisplaySvg`), and the `RegionHost` contract that says what a display may
read off the view containing it.

The pixels are `@jbrowse/render-core`; the toolkit-free chrome contract is
`@jbrowse/display-ui`. This package depends on both and on `@jbrowse/core`, and
the linear genome view plugin depends on it, never the reverse.

There is no barrel. The `exports` map in `package.json` is the API, pinned by
`src/publicApi.test.ts`, and **@experimental**. A runtime plugin gets the host's
copy whatever it pins, so the version a plugin builds against fixes only its
types.

A subpath belongs in the map when an external display would import it: a
foundation or mixin, a chrome piece, a host contract, a config-schema fragment,
or a module whose types an exported declaration names. A foundation's own
machinery, such as the autoruns it installs, stays unexported, since the host
serves every subpath to plugins (ADR-128).

## Conformance

The checks this tree runs on its own displays, for a plugin repo to run on its
own. The host never serves `conformance/*`, so a plugin imports these from its
installed copy, in lint and test setup only.

`conformance/lintRules` holds the `no-restricted-syntax` selectors that catch a
display breaking a contract no type states, such as a fetch hook declared in
`.actions()` or a gate mixin composed before the foundation. Flat config
replaces a rule rather than merging it, so spread them into your own entry:

```js
import {
  displayRestrictedSyntax,
  noUseEffectEvent,
  unobservedComponents,
} from '@jbrowse/display-kit/conformance/lintRules'

export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...displayRestrictedSyntax],
      'no-restricted-imports': ['error', { paths: [noUseEffectEvent] }],
    },
  },
  {
    files: ['src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...displayRestrictedSyntax,
        ...unobservedComponents,
      ],
    },
  },
]
```

`conformance/contractGate` fails a test when a runtime contract check reports.
Those checks report through `console.error` and never throw, so without it a
violation prints and the suite stays green. In a vitest setup file:

```js
import { installContractGate } from '@jbrowse/display-kit/conformance/contractGate'
import { afterAll, afterEach } from 'vitest'

installContractGate({ afterEach, afterAll })
```

A test that provokes a violation on purpose takes it with
`takeContractReports()` from the same module and asserts on it.

`conformance/displayTestEnvironment` mounts one display on one track inside a
real `LinearGenomeView`, so `afterAttach` runs and the display's getters read
the view they would read in the app. The caller supplies the view model and the
RPC mock, since this package sits below the linear genome view plugin:

```ts
import { createDisplayTestEnvironment } from '@jbrowse/display-kit/conformance/displayTestEnvironment'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory,
} from '@jbrowse/plugin-linear-genome-view'
import { vi } from 'vitest'

const rpcCall = vi.fn(() => new Promise(() => {}))
const { createDisplay } = createDisplayTestEnvironment<MyDisplayModel>({
  plugins: [new LinearGenomeViewPlugin()],
  viewModel: linearGenomeViewStateModelFactory,
  trackType: 'MyTrack',
  displayName: 'LinearMyDisplay',
  configSchema: configSchemaFactory,
  stateModel: stateModelFactory,
  rpcCall,
})
const { display, view, session } = createDisplay()
```

An unstubbed method should never settle, as above, rather than resolve
`undefined`. `conformance/displayTestSessionModel` and
`conformance/testAssembly` are the stub session and assembly it mounts the view
in, for a harness that builds its own.
