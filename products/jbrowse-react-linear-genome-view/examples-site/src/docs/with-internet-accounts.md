`DropboxOAuthInternetAccount` and `GoogleDriveOAuthInternetAccount` do not work
in an embedded view, which cannot control redirects and popups. Run the OAuth
flow in your host app and pass the token to
[`ExternalTokenInternetAccount`](https://jbrowse.org/jb2/docs/config/externaltokeninternetaccount/).
