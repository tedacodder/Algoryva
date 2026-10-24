import { render, waitFor } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";
import { ThemeProvider, useTheme, type Preference } from "../lib/ui/theme";
import { DARK, LIGHT } from "../lib/ui/palette";
import { Button } from "../components/common/Controls";

function ModeProbe() {
  const { mode } = useTheme();
  return <Text>{`mode:${mode}`}</Text>;
}

const colorOf = (el: { props: { style?: unknown } }) => (StyleSheet.flatten(el.props.style as never) as { color?: string }).color;

describe("light and dark theme", () => {
  it("a saved dark preference switches the whole app to the dark palette", async () => {
    const load = async (): Promise<Preference> => "dark";
    const { getByText } = await render(
      <ThemeProvider load={load}>
        <ModeProbe />
        <Button label="Save note" onPress={() => {}} />
      </ThemeProvider>,
    );
    await waitFor(() => expect(getByText("mode:dark")).toBeTruthy());
    // A secondary button's label uses the palette's text colour, so it must be the dark-mode colour.
    expect(colorOf(getByText("Save note"))).toBe(DARK.fg);
  });

  it("a saved light preference uses the light palette", async () => {
    const load = async (): Promise<Preference> => "light";
    const { getByText } = await render(
      <ThemeProvider load={load}>
        <ModeProbe />
        <Button label="Save note" onPress={() => {}} />
      </ThemeProvider>,
    );
    await waitFor(() => expect(getByText("mode:light")).toBeTruthy());
    expect(colorOf(getByText("Save note"))).toBe(LIGHT.fg);
  });

  it("the two palettes are different everywhere the website's themes differ (background, text, brand)", () => {
    expect(LIGHT.bg).not.toBe(DARK.bg);
    expect(LIGHT.fg).not.toBe(DARK.fg);
    expect(LIGHT.brand).not.toBe(DARK.brand);
    expect(DARK.mode).toBe("dark");
  });
});
