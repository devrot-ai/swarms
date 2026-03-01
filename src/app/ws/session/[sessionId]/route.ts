import { NextResponse } from "next/server";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  return NextResponse.json(
    {
      message: "WebSocket upgrade is not available on this route in current runtime.",
      sessionId,
      fallback: `/api/mission-control/events/${sessionId}`,
    },
    { status: 426 },
  );
}
