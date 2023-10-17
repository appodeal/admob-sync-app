# Admob-sync

install dependencies
```
npm i 
```

# Electron App

## Develop 

```
npm run start:app
npm run electron
```


# Chrome extension

## Develop

#### How to build extension:
- Go to the [config](config) folder and add two files **developer.json** & **production.json**. Example files are in the folder.
- Go to [developer.json](config/development.json) and change the fields “**appodeal**” & “**appodeal_auth**” to <u>staging</u> where current changes are collected.
- Then go to [.graphqlconfig](.graphqlconfig) and change <u>staging8</u> to what you need. To the get current graphql schema
- In [package.json](package.json) you need to replace the extension version. Indicate the next minor version after the current one.
For example:
```
 "0.1.32" to "0.2.32",
```
- Install dependencies. If it doesn't start with your local version of the node, try installing `v12.14.1`
```
npm i
```
- Build extension:
```
npm run start:ext
```
- Go to the extensions page in Google Chrome:
```
chrome://extensions/
```
- Switch <u>**ON**</u> the **“developer mode”**.
- Click the “**load unpacked**” button and select the [build/extension](build/extension) folder.
