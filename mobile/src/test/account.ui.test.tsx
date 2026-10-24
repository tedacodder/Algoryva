import { render } from "@testing-library/react-native";
import { press, typeText } from "./helpers";
import AccountScreen from "../app/account/index";

const mockSignIn = jest.fn(async () => ({ kind: "linked" as const, userId: "u1" }));
const mockRegister = jest.fn(async () => ({ kind: "linked" as const, userId: "u1" }));

jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({}) }));
jest.mock("../lib/auth/session", () => ({
  isSignedIn: () => false,
  subscribeSession: () => () => {},
}));
jest.mock("../lib/db/open", () => ({
  getDatabase: async () => ({ getFirstAsync: async () => ({ n: 0 }) }),
}));
jest.mock("../lib/sync/runtime", () => {
  const engine = { status: { state: "guest", pending: 0, lastSyncedAt: null, message: null, issues: [] }, subscribe: () => () => {}, run: async () => {}, dismissIssues: () => {}, setGuest: () => {} };
  return {
    getRuntime: () => ({
      engine,
      account: {
        signIn: (...a: unknown[]) => mockSignIn(...(a as [])),
        register: (...a: unknown[]) => mockRegister(...(a as [])),
        chooseLink: async () => {},
        signOut: async () => ({ kind: "signed-out" }),
        deleteAccount: async () => {},
      },
    }),
  };
});

beforeEach(() => {
  mockSignIn.mockClear();
  mockRegister.mockClear();
});

describe("account screen validation", () => {
  it("refuses a malformed email before contacting the server", async () => {
    const { getByLabelText, getByRole, findByText } = await render(<AccountScreen />);
    await typeText(getByLabelText("Email"), "not-an-email");
    await typeText(getByLabelText("Password"), "a-long-password");
    await press(getByRole("button", { name: "Sign in" }));
    expect(await findByText("Enter a valid email address.")).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("requires at least ten characters for a new account's password", async () => {
    const { getByLabelText, getByRole, findByText } = await render(<AccountScreen />);
    await press(getByRole("button", { name: "No account yet? Create one" }));
    await typeText(getByLabelText("Email"), "ana@example.test");
    await typeText(getByLabelText("Username"), "ana");
    await typeText(getByLabelText("Password"), "short");
    await press(getByRole("button", { name: "Create account" }));
    expect(await findByText("Use a password of at least 10 characters.")).toBeTruthy();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("a valid sign-in is sent to the account service", async () => {
    const { getByLabelText, getByRole } = await render(<AccountScreen />);
    await typeText(getByLabelText("Email"), "ana@example.test");
    await typeText(getByLabelText("Password"), "a-long-password");
    await press(getByRole("button", { name: "Sign in" }));
    expect(mockSignIn).toHaveBeenCalledWith({ email: "ana@example.test", password: "a-long-password" });
  });
});
