import { missionEventBus } from "@/lib/mission-control/eventBus";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  let unsubscribe: (() => void) | null = null;
  let keepAlive: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();

      const sendSse = (eventName: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${eventName}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      sendSse("connected", {
        sessionId,
        timestampUtc: new Date().toISOString(),
        message: "Mission event stream connected.",
      });

      unsubscribe = missionEventBus.subscribe(sessionId, (event) => {
        sendSse("mission-event", event);
      });

      keepAlive = setInterval(() => {
        sendSse("heartbeat", { timestampUtc: new Date().toISOString() });
      }, 15000);
    },
    cancel() {
      if (keepAlive) {
        clearInterval(keepAlive);
      }
      if (unsubscribe) {
        unsubscribe();
      }
      return;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
