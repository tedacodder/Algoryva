import { act, fireEvent } from "@testing-library/react-native";

/** Presses an element and lets React finish the state update. Without act, a press may not show on screen yet. */
export async function press(element: Parameters<typeof fireEvent.press>[0]): Promise<void> {
  await act(async () => {
    fireEvent.press(element);
  });
}

export async function typeText(element: Parameters<typeof fireEvent.changeText>[0], text: string): Promise<void> {
  await act(async () => {
    fireEvent.changeText(element, text);
  });
}
