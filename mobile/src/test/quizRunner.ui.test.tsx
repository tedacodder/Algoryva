import { act, render } from "@testing-library/react-native";
import { press } from "./helpers";
import { QuizRunner, SECONDS_PER_QUESTION } from "../components/quiz/QuizRunner";
import type { QuizQuestion } from "../lib/api/types";

const questions: QuizQuestion[] = [
  { q: "Which assigns a value?", options: ["x = 1", "x == 1"], answer: 0, why: "A single = assigns." },
  { q: "Which is a list?", options: ["(1, 2)", "[1, 2]"], answer: 1, why: "Square brackets make a list." },
];

describe("quiz runner", () => {
  it("marks each answer straight away with its explanation, and the score at the end", async () => {
    const onFinish = jest.fn();
    const { getByLabelText, getByText, getByRole } = await render(
      <QuizRunner title="Topic challenge" questions={questions} timed={false} onFinish={onFinish} onExit={() => {}} />,
    );
    await press(getByLabelText("A: x = 1"));
    expect(getByText("Correct")).toBeTruthy();
    expect(getByText("A single = assigns.")).toBeTruthy();
    await press(getByRole("button", { name: "Next question" }));
    await press(getByLabelText("A: (1, 2)"));
    expect(getByText("Not quite")).toBeTruthy();
    await press(getByRole("button", { name: "See results" }));
    expect(getByText("50%")).toBeTruthy();
    expect(getByText("1 of 2 correct")).toBeTruthy();
    expect(onFinish).toHaveBeenCalledWith([0, 0], 1);
  });

  it("with the timer on, an unanswered question counts as wrong when time runs out", async () => {
    jest.useFakeTimers();
    try {
      const { getByText, getByRole } = await render(
        <QuizRunner title="Practice quiz" questions={questions} timed onExit={() => {}} />,
      );
      await act(async () => {
        jest.advanceTimersByTime(SECONDS_PER_QUESTION * 1000 + 1500);
      });
      expect(getByText("Time is up")).toBeTruthy();
      expect(getByRole("button", { name: "Next question" })).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });
});
