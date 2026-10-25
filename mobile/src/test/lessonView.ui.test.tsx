import { render } from "@testing-library/react-native";
import { press } from "./helpers";
import { LessonView } from "../components/lesson/LessonView";
import { sampleContent } from "../lib/test-support/fixtures";
import type { BuiltinLesson } from "../lib/api/types";

const lesson = sampleContent().lessons[0] as BuiltinLesson;
const base = { progress: null, locked: false, missing: [], message: null, onComplete: jest.fn(), onQuiz: jest.fn() };

describe("lesson view and progress", () => {
  it("offers to mark the topic complete when it is unlocked and not yet complete", async () => {
    const onComplete = jest.fn();
    const { getByRole } = await render(<LessonView lesson={lesson} progressState={{ ...base, onComplete }} />);
    await press(getByRole("button", { name: "Mark this topic complete" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("says what to finish first when the topic is locked, and offers no completion button", async () => {
    const { queryByRole, getByText } = await render(<LessonView lesson={lesson} progressState={{ ...base, locked: true, missing: ["Python basics"] }} />);
    expect(getByText(/Finish Python basics first/)).toBeTruthy();
    expect(queryByRole("button", { name: "Mark this topic complete" })).toBeNull();
  });

  it("answering the last question sends all the answers in order, with no submit step", async () => {
    const onQuiz = jest.fn();
    const { getByLabelText } = await render(<LessonView lesson={lesson} progressState={{ ...base, onQuiz }} />);
    await press(getByLabelText("Option 1: x = 1"));
    expect(onQuiz).toHaveBeenCalledWith([0]);
  });

  it("marks each answer straight away, with its explanation, and shows the score once all are answered", async () => {
    const { getByLabelText, getByText } = await render(<LessonView lesson={lesson} progressState={{ ...base, onQuiz: jest.fn() }} />);
    await press(getByLabelText("Option 2: x == 1"));
    expect(getByText("Not quite. A single = assigns.")).toBeTruthy();
    expect(getByLabelText("Option 1: x = 1, correct")).toBeTruthy();
    expect(getByText("0 of 1 correct")).toBeTruthy();
  });
});
