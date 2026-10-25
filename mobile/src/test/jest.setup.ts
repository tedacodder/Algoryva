import { cleanup } from "@testing-library/react-native";

// React must know it runs under test, so state updates are flushed inside act(). Unmount after each test so renders do not leak.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(async () => {
  await cleanup();
});
