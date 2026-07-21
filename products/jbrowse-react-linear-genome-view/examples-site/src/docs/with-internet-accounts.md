_Internet accounts_ are JBrowse's mechanism for accessing authenticated
resources or otherwise overriding `fetch` on a per-track basis. The most common
use case is supplying a bearer token for protected files (Google Drive, S3 with
signed URLs, internal endpoints behind auth).

```js
const state = createViewState({
  assembly,
  tracks,
  internetAccounts: [
    {
      type: 'ExternalTokenInternetAccount',
      internetAccountId: 'manualGoogleEntry',
      name: 'Google Drive Manual Token Entry',
      tokenType: 'Bearer',
    },
  ],
})
```

Any track whose file locations carry `internetAccountId: 'manualGoogleEntry'`
routes through this account, which prompts the user for a token and adds an
`Authorization: Bearer <token>` header to each request.

**OAuth note:** `DropboxOAuthInternetAccount` and
`GoogleDriveOAuthInternetAccount` are **not** supported in the embedded LGV.
They need app-level control over redirects and popups that only full JBrowse Web
provides. Run the OAuth flow in your host app and pass the resulting token to
`ExternalTokenInternetAccount`.

Although the name suggests external services, internet accounts are a general
`fetch` override. A custom account type can rewrite URLs, add caching, or proxy
through your own backend. Config slots:
[ExternalTokenInternetAccount](https://jbrowse.org/jb2/docs/config/externaltokeninternetaccount/)
([state model](https://jbrowse.org/jb2/docs/models/externaltokeninternetaccount/)),
[HTTPBasicInternetAccount](https://jbrowse.org/jb2/docs/config/httpbasicinternetaccount/).
