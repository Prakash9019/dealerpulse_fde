import { getContext } from "@/lib/data";
import { compareBranchToNetwork, compareBranches, compareRepToBranch, compareRepToNetwork, compareReps } from "@/lib/ai/compare";

type CompareType = "branch" | "rep" | "branch-network" | "rep-network" | "rep-branch";

export async function POST(request: Request) {
  const body = await request.json();
  const type: CompareType = body.type;
  const idA: string = body.idA;
  const idB: string | undefined = body.idB;
  const range: string = body.range || "all";

  if (!idA) return Response.json({ error: "missing ids" }, { status: 400 });
  if ((type === "branch" || type === "rep" || type === "rep-branch") && !idB) {
    return Response.json({ error: "missing ids" }, { status: 400 });
  }

  const ctx = getContext({ range });

  if (type === "rep") {
    const a = ctx.reps.find((r) => r.id === idA);
    const b = ctx.reps.find((r) => r.id === idB);
    if (!a || !b) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json(compareReps(a, b));
  }

  if (type === "rep-network") {
    const a = ctx.reps.find((r) => r.id === idA);
    if (!a) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json(compareRepToNetwork(a, ctx));
  }

  if (type === "rep-branch") {
    const a = ctx.reps.find((r) => r.id === idA);
    const b = ctx.branchRows.find((r) => r.id === idB);
    if (!a || !b) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json(compareRepToBranch(a, b));
  }

  if (type === "branch-network") {
    const a = ctx.branchRows.find((r) => r.id === idA);
    if (!a) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json(compareBranchToNetwork(a, ctx));
  }

  const a = ctx.branchRows.find((r) => r.id === idA);
  const b = ctx.branchRows.find((r) => r.id === idB);
  if (!a || !b) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(compareBranches(a, b));
}
