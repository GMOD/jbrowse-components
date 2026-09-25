```bash
npm install @jbrowse/react-app2
```

```js
import '@jbrowse/react-app2/styles.css'
```

Without the stylesheet the view manager's tabs render unstyled. The props are
read once, on mount; to drive the app afterwards, render `<JBrowseApp>` over
`useCreateViewState`, as [Observe the session](../sessions/#observe-session)
does.
