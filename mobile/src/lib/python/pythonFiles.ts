/* eslint-disable @typescript-eslint/no-require-imports -- bundled assets are loaded with require() by design */
/**
 * The Pyodide runtime, shipped inside the app. Each file is stored with a ".bin" suffix so the bundler includes it as an asset; on first
 * use it is copied to the app's documents folder under its real name, because the WebView loads files from there.
 */
export const PYTHON_FILES: { name: string; bytes: number; asset: number }[] = [
  { name: "pyodide.js", bytes: 18912, asset: require("../../../assets/python/pyodide.js.bin") },
  { name: "pyodide.asm.mjs", bytes: 1250344, asset: require("../../../assets/python/pyodide.asm.mjs.bin") },
  { name: "pyodide.asm.wasm", bytes: 9598218, asset: require("../../../assets/python/pyodide.asm.wasm.bin") },
  { name: "python_stdlib.zip", bytes: 2545637, asset: require("../../../assets/python/python_stdlib.zip.bin") },
  { name: "pyodide-lock.json", bytes: 119077, asset: require("../../../assets/python/pyodide-lock.json.bin") },
];
