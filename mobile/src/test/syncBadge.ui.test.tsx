import { render } from "@testing-library/react-native";
import { SyncBadge } from "../components/sync/SyncBadge";
import { engineStatus } from "./runtime.mock";

jest.mock("../lib/sync/runtime", () => {
  const m = jest.requireActual("./runtime.mock");
  const engine = {
    get status() { return m.engineStatus; },
    subscribe: () => () => {},
    run: async () => {},
  };
  return { getRuntime: () => ({ engine }) };
});

beforeEach(() => {
  Object.assign(engineStatus, { state: "guest", pending: 0, message: null });
});

// One render per test: each state is checked on its own, so no test depends on a previous unmount.
describe("sync badge", () => {
  it("says the account is not in use while signed out", async () => {
    const { getByLabelText } = await render(<SyncBadge />);
    expect(getByLabelText(/Sync status: Not signed in/)).toBeTruthy();
  });

  it("says one change is waiting, in the singular", async () => {
    Object.assign(engineStatus, { state: "pending", pending: 1 });
    const { getByLabelText } = await render(<SyncBadge />);
    expect(getByLabelText(/1 change waiting to sync/)).toBeTruthy();
  });

  it("says several changes are waiting, in the plural", async () => {
    Object.assign(engineStatus, { state: "pending", pending: 3 });
    const { getByLabelText } = await render(<SyncBadge />);
    expect(getByLabelText(/3 changes waiting to sync/)).toBeTruthy();
  });

  it("shows offline plainly, with the changes kept", async () => {
    Object.assign(engineStatus, { state: "offline" });
    const { getByLabelText } = await render(<SyncBadge />);
    expect(getByLabelText(/Offline. Changes are saved./)).toBeTruthy();
  });

  it("shows the server's message when a sync stopped with an error", async () => {
    Object.assign(engineStatus, { state: "error", message: "Sync stopped: bad request." });
    const { getByLabelText } = await render(<SyncBadge />);
    expect(getByLabelText(/Sync stopped: bad request/)).toBeTruthy();
  });
});
