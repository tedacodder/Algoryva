import { render, waitFor } from "@testing-library/react-native";
import { press, typeText } from "./helpers";
import { AnswerForm } from "../components/judge/AnswerForm";
import type { ContentProblem } from "../lib/api/types";
import type { SubmissionView } from "../lib/judge/queue";
import { runtimeCalls, submitResult } from "./runtime.mock";

jest.mock("../lib/sync/runtime", () => {
  const m = jest.requireActual("./runtime.mock");
  return {
    submitAnswers: async (problemId: string, outputs: string[]) => {
      m.runtimeCalls.submitAnswers.push({ problemId, outputs });
      return m.submitResult.value;
    },
  };
});
jest.mock("../lib/auth/session", () => ({ isSignedIn: () => true, subscribeSession: () => () => {} }));

const problem: ContentProblem = {
  id: "p1", slug: "sum-two", title: "Sum two", kind: "INTERNAL", difficulty: "EASY", source: null, externalUrl: null,
  statement: "Add two numbers.", inputSpec: null, outputSpec: null, constraints: null, timeLimitMs: null, memoryLimitMb: null,
  position: 0, topics: [], samples: [{ input: "1 2", expected: "3", explanation: null }], testCount: 3,
};
const view = (over: Partial<SubmissionView>): SubmissionView => ({ clientId: "c1", createdAt: "2026-10-20T10:00:00Z", status: "pending", verdict: null, message: null, ...over });

beforeEach(() => {
  runtimeCalls.submitAnswers.length = 0;
  submitResult.value = { ok: true };
});

describe("answer form", () => {
  it("asks for one output per test, showing the sample inputs and not the hidden ones", async () => {
    const { getByLabelText, queryByLabelText } = await render(<AnswerForm problem={problem} submissions={[]} onSaved={() => {}} />);
    expect(getByLabelText("Example 1 output")).toBeTruthy();
    expect(getByLabelText("Hidden test 2 output")).toBeTruthy();
    expect(getByLabelText("Hidden test 3 output")).toBeTruthy();
    expect(queryByLabelText("Hidden test 1 output")).toBeNull();
  });

  it("saves the answer through the runtime and reports that it will be checked later", async () => {
    const { getByLabelText, getByRole, findByText } = await render(<AnswerForm problem={problem} submissions={[]} onSaved={() => {}} />);
    await typeText(getByLabelText("Example 1 output"), "3");
    await press(getByRole("button", { name: "Submit answer" }));
    expect(await findByText("Saved. It will be checked when you are online.")).toBeTruthy();
    expect(runtimeCalls.submitAnswers[0]).toEqual({ problemId: "p1", outputs: ["3", "", ""] });
  });

  it("shows the reason when the phone refuses the answer", async () => {
    submitResult.value = { ok: false, reason: "This answer was already saved." };
    const { getByRole, findByText } = await render(<AnswerForm problem={problem} submissions={[]} onSaved={() => {}} />);
    await press(getByRole("button", { name: "Submit answer" }));
    expect(await findByText("This answer was already saved.")).toBeTruthy();
  });

  it("a pending answer shows 'checking' and never 'Accepted'", async () => {
    const { getByText, queryByText } = await render(<AnswerForm problem={problem} submissions={[view({ status: "pending" })]} onSaved={() => {}} />);
    expect(getByText("Checking when you are online.")).toBeTruthy();
    expect(queryByText("Accepted")).toBeNull();
  });

  it("shows the server's accepted verdict, and only then", async () => {
    const verdict = { clientId: "c1", verdict: "accepted" as const, allPass: true, solved: true, results: [{ isSample: true, pass: true }, { isSample: false, pass: true }, { isSample: false, pass: true }] };
    const { getByText } = await render(<AnswerForm problem={problem} submissions={[view({ status: "judged", verdict })]} onSaved={() => {}} />);
    expect(getByText("Accepted")).toBeTruthy();
    expect(getByText("The problem is now marked solved.")).toBeTruthy();
  });

  it("a wrong answer lists the failing sample with the expected and actual output", async () => {
    const verdict = { clientId: "c1", verdict: "wrong_answer" as const, allPass: false, solved: false, results: [{ isSample: true, pass: false, input: "1 2", expected: "3", actual: "9" }, { isSample: false, pass: false }, { isSample: false, pass: false }] };
    const { getByText } = await render(<AnswerForm problem={problem} submissions={[view({ status: "judged", verdict })]} onSaved={() => {}} />);
    expect(getByText("Wrong answer")).toBeTruthy();
    expect(getByText("Example 1: expected 3, got 9")).toBeTruthy();
    expect(getByText("Hidden test 2 did not match.")).toBeTruthy();
  });

  it("a refused answer says why it could not be checked", async () => {
    const { getByText } = await render(<AnswerForm problem={problem} submissions={[view({ status: "refused", message: "This client id was already used." })]} onSaved={() => {}} />);
    await waitFor(() => expect(getByText(/could not be checked: This client id was already used/)).toBeTruthy());
  });
});
