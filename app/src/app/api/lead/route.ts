import { getContext, getModel } from "@/lib/data";
import { leadExplanation } from "@/lib/ai/explanations";
import { priorityRefs } from "@/lib/insights/priority";
import { STAGE_LABEL } from "@/lib/domain/model";

export async function POST(request: Request) {
  const { leadId } = await request.json();
  const model = getModel();
  const lead = model.leadById[leadId];
  if (!lead) return Response.json({ error: "not found" }, { status: 404 });

  const ctx = getContext({ range: "all" });
  const refs = priorityRefs(model, ctx.branchRows);
  const explanation = leadExplanation(lead, refs);

  return Response.json({
    id: lead.id,
    customerName: lead.customerName,
    phone: lead.phone,
    model: lead.model,
    branchName: lead.branchName,
    repName: lead.repName,
    branchId: lead.branchId,
    repId: lead.repId,
    stageLabel: STAGE_LABEL[lead.status],
    dealValue: lead.dealValue,
    idleDays: lead.idleDays,
    history: lead.history.map((h) => ({
      status: STAGE_LABEL[h.status] || h.status,
      at: h.at,
      note: h.note,
    })),
    explanation,
  });
}
