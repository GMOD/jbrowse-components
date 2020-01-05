
# Desktop Install


```
git clone https://github.com/gmod/jbrowse-components
cd jbrowse-components
yarn
cd packages/jbrowse-desktop
yarn start
```

This will launch jbrowse-desktop from the latest instance of our github master branch

# Web Production Install

```
git clone https://github.com/gmod/jbrowse-components
cd jbrowse-components
yarn
cd packages/jbrowse-web
yarn build
cp -R build/* <web-sharable directory>
```

Point web browser to where index.html is shown.


# Web Development Install


```
git clone https://github.com/gmod/jbrowse-components
cd jbrowse-components
yarn
cd packages/jbrowse-web
yarn start
```

Open http://localhost:3000

