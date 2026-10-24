/* eslint-disable @typescript-eslint/no-require-imports -- bundled assets are loaded with require() by design */
/**
 * The Pyodide runtime, shipped inside the app. Each file is stored with a ".bin" suffix so the bundler includes it as an asset; on first
 * use it is copied to the app's documents folder under its real name, because the WebView loads files from there.
 */
export const PYTHON_FILES: { name: string; asset: number }[] = [
  { name: "pyodide.js", asset: require("../../../assets/python/pyodide.js.bin") },
  { name: "pyodide.asm.mjs", asset: require("../../../assets/python/pyodide.asm.mjs.bin") },
  { name: "pyodide.asm.wasm", asset: require("../../../assets/python/pyodide.asm.wasm.bin") },
  { name: "python_stdlib.zip", asset: require("../../../assets/python/python_stdlib.zip.bin") },
  { name: "pyodide-lock.json", asset: require("../../../assets/python/pyodide-lock.json.bin") },
];
