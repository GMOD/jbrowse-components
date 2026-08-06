_Internet accounts_ override `fetch` per track. The common case is a bearer
token for protected files — Google Drive, signed-URL S3, an internal endpoint
behind auth. Any track whose file locations carry
`internetAccountId: 'manualGoogleEntry'` routes through the matching account,
which prompts for a token and adds `Authorization: Bearer <token>` to each
request.

`DropboxOAuthInternetAccount` and `GoogleDriveOAuthInternetAccount` **are not
supported in the embedded LGV** — they need app-level control over redirects and
popups that only full JBrowse Web has. Run the OAuth flow in your host app and
pass the resulting token to `ExternalTokenInternetAccount`.

Despite the name these are a general fetch override: a custom account type can
rewrite URLs, add caching, or proxy through your backend. Slots:
[ExternalTokenInternetAccount](https://jbrowse.org/jb2/docs/config/externaltokeninternetaccount/),
[HTTPBasicInternetAccount](https://jbrowse.org/jb2/docs/config/httpbasicinternetaccount/).
