[![Build Status](https://img.shields.io/travis/com/GMOD/jbrowse-components/master.svg?logo=travis&style=for-the-badge)](https://travis-ci.com/GMOD/jbrowse-components)
[![Coverage Status](https://img.shields.io/codecov/c/github/GMOD/jbrowse-components/master.svg?logo=codecov&style=for-the-badge)](https://codecov.io/gh/GMOD/jbrowse-components/branch/master)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-v1.4%20adopted-ff69b4.svg?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAyNTYgMjU2IiB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiPjx0aXRsZT5Db250cmlidXRvciBDb3ZlbmFudCBMb2dvPC90aXRsZT48ZyBpZD0iQ2FudmFzIj48ZyBpZD0iR3JvdXAiPjxnIGlkPSJTdWJ0cmFjdCI+PHVzZSB4bGluazpocmVmPSIjcGF0aDBfZmlsbCIgZmlsbD0iIzVFMEQ3MyIvPjwvZz48ZyBpZD0iU3VidHJhY3QiPjx1c2UgeGxpbms6aHJlZj0iI3BhdGgxX2ZpbGwiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDU4IDI0KSIgZmlsbD0iIzVFMEQ3MyIvPjwvZz48L2c+PC9nPjxkZWZzPjxwYXRoIGlkPSJwYXRoMF9maWxsIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0gMTgyLjc4NyAxMi4yODQ2QyAxNzMuMDA1IDkuNDk0MDggMTYyLjY3NyA4IDE1MiA4QyA5MC4xNDQxIDggNDAgNTguMTQ0MSA0MCAxMjBDIDQwIDE4MS44NTYgOTAuMTQ0MSAyMzIgMTUyIDIzMkMgMTg4LjQ2NCAyMzIgMjIwLjg1NyAyMTQuNTc1IDI0MS4zMDggMTg3LjU5OEMgMjE5Ljg3IDIyOC4yNzIgMTc3LjE3MyAyNTYgMTI4IDI1NkMgNTcuMzA3NSAyNTYgMCAxOTguNjkyIDAgMTI4QyAwIDU3LjMwNzUgNTcuMzA3NSAwIDEyOCAwQyAxNDcuNjA0IDAgMTY2LjE3OSA0LjQwNzA5IDE4Mi43ODcgMTIuMjg0NloiLz48cGF0aCBpZD0icGF0aDFfZmlsbCIgZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNIDEzNy4wOSA5LjIxMzQyQyAxMjkuNzU0IDcuMTIwNTYgMTIyLjAwOCA2IDExNCA2QyA2Ny42MDgxIDYgMzAgNDMuNjA4MSAzMCA5MEMgMzAgMTM2LjM5MiA2Ny42MDgxIDE3NCAxMTQgMTc0QyAxNDEuMzQ4IDE3NCAxNjUuNjQzIDE2MC45MzEgMTgwLjk4MSAxNDAuNjk4QyAxNjQuOTAzIDE3MS4yMDQgMTMyLjg4IDE5MiA5NiAxOTJDIDQyLjk4MDcgMTkyIDAgMTQ5LjAxOSAwIDk2QyAwIDQyLjk4MDcgNDIuOTgwNyAwIDk2IDBDIDExMC43MDMgMCAxMjQuNjM0IDMuMzA1MzEgMTM3LjA5IDkuMjEzNDJaIi8+PC9kZWZzPjwvc3ZnPg==)](CODE_OF_CONDUCT.md)

# jbrowse-components

Monorepo using Lerna and Yarn workspaces containing many related packages for
next-generation JBrowse development.

## Pre-requisites

- [git](https://git-scm.com/downloads)
- [nodejs](https://nodejs.org/en/download/) (node 10 or greater)
- [yarn](https://yarnpkg.com/en/docs/install)

## Install (Linux/Mac)

Simply clone the git repo and run yarn in the root repository

```sh
git clone https://github.com/GMOD/jbrowse-components.git
cd jbrowse-components
yarn
```

## Install (Windows)

```pwsh
# Make sure you check out line-endings as-is by running
# `git config --global core.autocrlf false`
# Also, make sure symlinks are enabled by running
# `git config --global core.symlinks true`.
# You may also need to clone as an administrator for symlinks to work.
git clone -c core.symlinks=true https://github.com/GMOD/jbrowse-components.git
cd .\jbrowse-components\
yarn
```

## Quick start

Either cd to packages/jbrowse-web or packages/jbrowse-desktop and run `yarn start`
