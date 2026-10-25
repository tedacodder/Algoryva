// Ships the Python runtime files (stored with a .bin suffix) as bundled assets. Without this, Metro would not include them.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.assetExts = [...config.resolver.assetExts, "bin"];

module.exports = config;
