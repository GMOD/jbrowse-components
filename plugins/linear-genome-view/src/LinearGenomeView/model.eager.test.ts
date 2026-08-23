import { readFileSync } from 'node:fs'
import path from 'node:path'

// A view's state model is registered when the plugin installs, so model.ts and
// everything it statically imports are in every host's first paint. The view's
// components are not — index.ts registers them with `ReactComponent: lazy()`.
//
// model.ts used to open with `import Header from './components/Header.tsx'` to
// serve a `HeaderComponent()` method, which put the stock header (SearchBox ->
// RefNameAutocomplete -> MUI Autocomplete, HeaderZoomControls -> SingleSlider ->
// MUI Slider) in the eager set of every host, including ones that set
// hideHeader. 3e66ae532f fixed the bytes by putting the header behind a second
// lazy() *inside* the already-lazy view component, with `fallback={null}` — and
// that made the header arrive a round trip after the tracks it sits above, so
// the sticky scalebar (top: rubberbandTop, arithmetic that assumes the header is
// mounted) detached and floated over the first track for ~500ms on every load.
// Measured: container and first track mount in the same frame, header +513ms.
//
// Both halves are fixed by the same rule, which is what this pins: the eager
// side names no component, and the header is a plain import on the lazy side, so
// it ships in the chunk the view component was already fetching.
//
// `.tsx` stands in for "declares a React component". A React-free helper is
// fine and model.ts imports one (`./components/util.ts`).
const modelPath = path.join(__dirname, 'model.ts')

// static `import ... from` / `export ... from` only; a dynamic import() is the
// escape hatch and is what model.ts already uses for its dialogs
const STATIC_FROM = /^\s*(?:import|export)\b[^(]*?\sfrom\s+'([^']+)'/gm

test('the eagerly-evaluated view model names no React component', () => {
  const text = readFileSync(modelPath, 'utf8')
  const offenders = []
  for (const m of text.matchAll(STATIC_FROM)) {
    // types are erased at build time, so a type-only import costs nothing
    if (!/^\s*import\s+type\b/.test(m[0]) && m[1]!.endsWith('.tsx')) {
      offenders.push(m[1])
    }
  }
  expect(offenders).toEqual([])
})
