```bash
npm install @jbrowse/react-app2
```

```js
import '@jbrowse/react-app2/styles.css'
```

The stylesheet holds no rules yet; it is where any CSS the package needs will
ship. The props are read once, on mount; to drive the app afterwards, render
`<JBrowseApp>` over `useCreateViewState`, as
[Observe the session](../observe-session/) does.
