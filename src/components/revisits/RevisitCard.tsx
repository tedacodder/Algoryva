import Link from "next/link";
import { Callout } from "@/components/ui";
import { countDueRevisits } from "@/lib/revisit-store";

/** Shows the number of problems due for a solve-again review. Renders nothing when none are due. */
export async function RevisitCard({ userId }: { userId: string }) {
  const due = await countDueRevisits(userId, new Date());
  if (due === 0) return null;
  return (
    <Callout title={`${due} ${due === 1 ? "problem" : "problems"} to solve again`}>
      <p>You solved these with help earlier. Solve them on your own: site problems pass automatically, and outside problems you confirm yourself. <Link className="font-semibold text-brand underline" href="/revisits">Open revisits</Link></p>
    </Callout>
  );
}
