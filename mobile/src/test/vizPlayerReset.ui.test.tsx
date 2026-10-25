import { act, render } from "@testing-library/react-native";
import { VizPlayer, vizKey } from "../components/viz/VizPlayer";
import type { VizView } from "../components/viz/types";
import { press } from "./helpers";

const frames = [
  { values: [3, 1, 2], marks: {}, note: "one" },
  { values: [1, 3, 2], marks: {}, note: "two" },
  { values: [1, 2, 3], marks: {}, note: "three" },
];
const make = (): VizView => ({ kind: "array", title: "Demo", frames: frames as never });

describe("visualization player keeps its place", () => {
  it("a new but equal copy of the same visualization does not reset playback", async () => {
    const { getByRole, getByText, rerender } = await render(<VizPlayer viz={make()} />);
    await press(getByRole("button", { name: "Next step" }));
    expect(getByText("two")).toBeTruthy();
    // The parent rebuilds the object on every render; the player must not jump back to step 1.
    await act(async () => {
      rerender(<VizPlayer viz={make()} />);
    });
    expect(getByText("two")).toBeTruthy();
  }, 20000);

  it("a different visualization does start again from the first step", async () => {
    const { getByRole, getByText, rerender } = await render(<VizPlayer viz={make()} />);
    await press(getByRole("button", { name: "Next step" }));
    const other: VizView = { kind: "array", title: "Other", frames: frames as never };
    await act(async () => {
      rerender(<VizPlayer viz={other} />);
    });
    expect(getByText("one")).toBeTruthy();
  });

  it("the key depends on kind, title and length only", () => {
    expect(vizKey(make())).toBe(vizKey(make()));
    expect(vizKey(make())).not.toBe(vizKey({ kind: "array", title: "Demo", frames: frames.slice(0, 2) as never }));
  });
});
