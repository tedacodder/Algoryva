import { render } from "@testing-library/react-native";
import { press } from "./helpers";
import { Button, Chip } from "../components/common/Controls";

describe("shared controls", () => {
  it("a button exposes its role and label and fires when pressed", async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(<Button label="Save note" variant="primary" onPress={onPress} />);
    const btn = getByRole("button", { name: "Save note" });
    await press(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("a disabled button does not fire and reports itself as disabled", async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(<Button label="Delete" variant="danger" disabled onPress={onPress} />);
    await press(getByRole("button", { name: "Delete" }));
    expect(onPress).not.toHaveBeenCalled();
    expect(getByRole("button", { name: "Delete" })).toBeDisabled();
  });

  it("a chip reports whether it is selected", async () => {
    const { getByRole } = await render(<Chip label="CONCEPTUAL" selected onPress={() => {}} />);
    expect(getByRole("button", { name: "CONCEPTUAL" }).props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
  });
});
