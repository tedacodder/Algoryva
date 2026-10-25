// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expo = require("eslint-config-expo/flat");

module.exports = defineConfig([
  { ignores: ["dist/**", "dist-android-check/**", "node_modules/**", ".expo/**"] },
  expo,
]);
