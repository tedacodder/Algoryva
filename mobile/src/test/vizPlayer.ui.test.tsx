import { act, render } from "@testing-library/react-native";
import { press } from "./helpers";
import { VizPlayer } from "../components/viz/VizPlayer";
import type { VizView } from "../components/viz/types";

const viz: VizView = {
  kind: "array",
  title: "Demo",
  frames: [
    { values: [3, 1, 2], marks: {}, note: "Start with the array" },
    { values: [1, 3, 2], marks: { 0: ["lo"], 1: ["hi"] }, note: "Swap the first two" },
    { values: [1, 2, 3], marks: {}, note: "Done" },
  ] as VizView extends { kind: "array"; frames: infer F } ? F : never,
};

describe("visualization player", () => {
  it("starts at the first step and shows the note and the step count", async () => {
    const { getByText, getByLabelText } = await render(<VizPlayer viz={viz} />);
    expect(getByText("Start with the array")).toBeTruthy();
    expect(getByLabelText("Step 1 of 3")).toBeTruthy();
  });

  it("next and previous move through the steps, and previous is disabled at the start", async () => {
    const { getByRole, getByText, getByLabelText } = await render(<VizPlayer viz={viz} />);
    expect(getByRole("button", { name: "Previous step" })).toBeDisabled();
    await press(getByRole("button", { name: "Next step" }));
    expect(getByText("Swap the first two")).toBeTruthy();
    expect(getByLabelText("Step 2 of 3")).toBeTruthy();
    await press(getByRole("button", { name: "Previous step" }));
    expect(getByLabelText("Step 1 of 3")).toBeTruthy();
  });

  it("next is disabled on the last step, so playback never wraps", async () => {
    const { getByRole } = await render(<VizPlayer viz={viz} />);
    await press(getByRole("button", { name: "Next step" }));
    await press(getByRole("button", { name: "Next step" }));
    expect(getByRole("button", { name: "Next step" })).toBeDisabled();
  });

  it("play advances by itself and stops at the last step", async () => {
    jest.useFakeTimers();
    try {
      const { getByRole, getByLabelText } = await render(<VizPlayer viz={viz} />);
      await press(getByRole("button", { name: "Play" }));
      await act(async () => { jest.advanceTimersByTime(1500); });
      expect(getByLabelText("Step 2 of 3")).toBeTruthy();
      await act(async () => { jest.advanceTimersByTime(5000); });
      expect(getByLabelText("Step 3 of 3")).toBeTruthy();
      expect(getByRole("button", { name: "Play" })).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });
});
