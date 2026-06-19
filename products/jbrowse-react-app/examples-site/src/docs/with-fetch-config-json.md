If the config lives on a server — or differs per environment, per user, or per
route — fetch it before constructing `createViewState`. Wrap `viewState` in
`useState`/`useEffect` so React renders once the fetch resolves:

```jsx
function App() {
  const [state, setState] = useState()
  useEffect(() => {
    ;(async () => {
      const config = await (await fetch('/config.json')).json()
      setState(createViewState({ config }))
    })()
  }, [])
  return state ? <JBrowseApp viewState={state} /> : null
}
```

As with a [bundled config](../with-import-config-json/), URIs in the file are
resolved relative to where it was downloaded from, so tag each location with a
`baseUri` after fetching. The config shape is documented in
[JBrowseRootConfig](https://jbrowse.org/jb2/docs/config/jbrowserootconfig/).
