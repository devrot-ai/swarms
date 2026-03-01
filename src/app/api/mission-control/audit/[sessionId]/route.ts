import { NextResponse } from "next/server";
import { listSessionAudit } from "@/lib/mission-control/missionControl";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const audit = listSessionAudit(sessionId);
  return NextResponse.json({ sessionId, audit }, { status: 200 });
}
