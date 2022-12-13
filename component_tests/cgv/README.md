# Demo of `@jbrowse/react-linear-genome-view`

This module uses "packed" builds of the repo, and runs an e2e test using
cypress.

It is most similar to a test that a user would get from installing the module
from NPM. Note that these `packed` builds can be heavily cached by the yarn
caching system, so if you want to test the component_test folder on your own
machine, try:

```
yarn build # running build from root of the repo copies files to component_test/packed
cd component_test
rm -f yarn.lock
rm -rf node_modules
yarn cache clean
yarn
yarn start
yarn build
yarn test:e2e
```
