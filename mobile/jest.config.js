/** Component tests (React Native Testing Library, run with Jest). The pure logic tests run separately with `npm test` (Node). */
module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/src/**/*.ui.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/src/test/jest.setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|expo-router)",
  ],
};
