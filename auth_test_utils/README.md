# extra_test_utils

These start up authenticated servers for testing HTTP Basic and OAuth based file
access in jbrowse-web

## Usage

1. Run `yarn oauth` in a tab
2. Run `yarn basicauth` in another tab
3. Start jbrowse-web dev server
4. Visit http://localhost:3000/?config=test_data/volvox/config_auth.json
