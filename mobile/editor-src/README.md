# Editor bundle

`entry.js` is the source of the code editor (CodeMirror 6). It is bundled into one file that the app loads from its own folder.

Rebuild after changing `entry.js`:

    npm install --no-save codemirror@6 @codemirror/lang-python@6 @codemirror/state@6 @codemirror/view@6 @codemirror/commands@6 @codemirror/search@6 @codemirror/language@6 @codemirror/autocomplete@6 esbuild@0.25
    npx esbuild editor-src/entry.js --bundle --format=iife --minify --outfile=editor-src/editor.bundle.js
    cp editor-src/editor.bundle.js assets/python/editor.bundle.js.bin

Commit both `entry.js` and the rebuilt `assets/python/editor.bundle.js.bin`.
