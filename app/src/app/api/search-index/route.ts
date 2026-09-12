import { getModel } from "@/lib/data";

export async function GET() {
  const model = getModel();
  return Response.json({
    branches: model.branches.map((b) => ({ id: b.id, name: b.name, city: b.city })),
    reps: model.reps.map((r) => ({ id: r.id, name: r.name, branchName: r.branchName, role: r.roleLabel })),
  });
}
