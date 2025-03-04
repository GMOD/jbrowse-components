[![Build Status](https://img.shields.io/github/actions/workflow/status/GMOD/jbrowse-components/push.yml?branch=main&logo=github&style=for-the-badge)](https://github.com/GMOD/jbrowse-components/actions)
[![Coverage Status](https://img.shields.io/codecov/c/github/GMOD/jbrowse-components/main.svg?logo=codecov&style=for-the-badge)](https://codecov.io/gh/GMOD/jbrowse-components/branch/main)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-v1.4%20adopted-ff69b4.svg?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAyNTYgMjU2IiB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiPjx0aXRsZT5Db250cmlidXRvciBDb3ZlbmFudCBMb2dvPC90aXRsZT48ZyBpZD0iQ2FudmFzIj48ZyBpZD0iR3JvdXAiPjxnIGlkPSJTdWJ0cmFjdCI+PHVzZSB4bGluazpocmVmPSIjcGF0aDBfZmlsbCIgZmlsbD0iIzVFMEQ3MyIvPjwvZz48ZyBpZD0iU3VidHJhY3QiPjx1c2UgeGxpbms6aHJlZj0iI3BhdGgxX2ZpbGwiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDU4IDI0KSIgZmlsbD0iIzVFMEQ3MyIvPjwvZz48L2c+PC9nPjxkZWZzPjxwYXRoIGlkPSJwYXRoMF9maWxsIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0gMTgyLjc4NyAxMi4yODQ2QyAxNzMuMDA1IDkuNDk0MDggMTYyLjY3NyA4IDE1MiA4QyA5MC4xNDQxIDggNDAgNTguMTQ0MSA0MCAxMjBDIDQwIDE4MS44NTYgOTAuMTQ0MSAyMzIgMTUyIDIzMkMgMTg4LjQ2NCAyMzIgMjIwLjg1NyAyMTQuNTc1IDI0MS4zMDggMTg3LjU5OEMgMjE5Ljg3IDIyOC4yNzIgMTc3LjE3MyAyNTYgMTI4IDI1NkMgNTcuMzA3NSAyNTYgMCAxOTguNjkyIDAgMTI4QyAwIDU3LjMwNzUgNTcuMzA3NSAwIDEyOCAwQyAxNDcuNjA0IDAgMTY2LjE3OSA0LjQwNzA5IDE4Mi43ODcgMTIuMjg0NloiLz48cGF0aCBpZD0icGF0aDFfZmlsbCIgZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNIDEzNy4wOSA5LjIxMzQyQyAxMjkuNzU0IDcuMTIwNTYgMTIyLjAwOCA2IDExNCA2QyA2Ny42MDgxIDYgMzAgNDMuNjA4MSAzMCA5MEMgMzAgMTM2LjM5MiA2Ny42MDgxIDE3NCAxMTQgMTc0QyAxNDEuMzQ4IDE3NCAxNjUuNjQzIDE2MC45MzEgMTgwLjk4MSAxNDAuNjk4QyAxNjQuOTAzIDE3MS4yMDQgMTMyLjg4IDE5MiA5NiAxOTJDIDQyLjk4MDcgMTkyIDAgMTQ5LjAxOSAwIDk2QyAwIDQyLjk4MDcgNDIuOTgwNyAwIDk2IDBDIDExMC43MDMgMCAxMjQuNjM0IDMuMzA1MzEgMTM3LjA5IDkuMjEzNDJaIi8+PC9kZWZzPjwvc3ZnPg==)](CODE_OF_CONDUCT.md)

# jbrowse-components

Monorepo using Lerna and Yarn workspaces containing many related packages for
next-generation JBrowse development.

Homepage https://jbrowse.org/jb2

Docs http://jbrowse.org/jb2/docs/

Fall 2023: New outreach! We created an "office hours" Google Calendar for anyone
to schedule 1-on-1 meetings with the development team. Details below:

- [Schedule 1-on-1 appointment](https://calendar.app.google/1AYZkNCQNmwdY2R26)

## Pre-requisites

- [git](https://git-scm.com/downloads)
- [nodejs](https://nodejs.org/en/download/) (node 18 or greater)
- [yarn](https://yarnpkg.com/en/docs/install)

You may need additional pre-requisites on certain versions of nodejs.

On macOS with homebrew:

    brew install pkg-config cairo pango libpng jpeg giflib librsvg

On Ubuntu, with apt:

    sudo apt install -y python3 make gcc libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

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

## Quick start for developers

You can use these commands to help get started with your development environment

For running jbrowse-web

```sh
cd products/jbrowse-web
yarn start
```

For jbrowse-desktop, launch two tabs

```sh
# starts webpack dev server
cd products/jbrowse-desktop
yarn start

# starts electron window
cd products/jbrowse-desktop
yarn electron
```

For running e.g. jbrowse-react-linear-genome-view you can use storybook

```sh
cd products/jbrowse-react-linear-genome-view
yarn storybook
```

See CONTRIBUTING.md for more info

If you are installing JBrowse on your server, check out our quick start guides
here https://jbrowse.org/jb2/docs/
