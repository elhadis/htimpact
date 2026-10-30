import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { buildReport } from "@/lib/queries";
import { buildExcel } from "@/lib/exporters";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.active || !can(session.user.role, "reports", "export")) {
    return new Response("Forbidden", { status: 403 });
  }
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || undefined;
  const report = await buildReport(projectId);
  const body = await buildExcel(report);
  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=ht-impact-report.xlsx",
    },
  });
}
