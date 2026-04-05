import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { logMissionEvent } from "@/lib/orchestrator/events";
import { AgentKeySchema } from "@/lib/ai/schemas";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const CreateStepSchema = z.object({
  agent_key: AgentKeySchema,
  title: z.string().min(3),
  description: z.string().min(8),
  step_order: z.number().int().positive().optional(),
  depends_on: z.array(z.string().uuid()).optional().default([]),
});

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("mission_steps")
      .select("*")
      .eq("mission_id", id)
      .order("step_order", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const steps = data ?? [];

    return NextResponse.json({
      missionId: id,
      steps,
      summary: {
        total: steps.length,
        pending: steps.filter((step) => step.status === "pending").length,
        running: steps.filter((step) => step.status === "running").length,
        completed: steps.filter((step) => step.status === "completed").length,
        failed: steps.filter((step) => step.status === "failed").length,
        needs_review: steps.filter((step) => step.status === "needs_review").length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch mission steps.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const payload = CreateStepSchema.parse(body);
    const supabase = getSupabaseAdmin();

    let stepOrder = payload.step_order;

    if (!stepOrder) {
      const { data: lastStep, error: lastStepError } = await supabase
        .from("mission_steps")
        .select("step_order")
        .eq("mission_id", id)
        .order("step_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastStepError) {
        throw new Error(lastStepError.message);
      }

      stepOrder = (lastStep?.step_order ?? 0) + 1;
    }

    const insertRow = {
      mission_id: id,
      agent_key: payload.agent_key,
      title: payload.title,
      description: payload.description,
      step_order: stepOrder,
      depends_on: payload.depends_on,
      input_json: {},
      output_json: {},
      status: "pending",
    };

    const { data: created, error } = await supabase
      .from("mission_steps")
      .insert(insertRow)
      .select("*")
      .single();

    if (error || !created) {
      throw new Error(error?.message ?? "Failed to create mission step.");
    }

    await logMissionEvent({
      missionId: id,
      stepId: created.id,
      eventType: "step_added",
      payload: {
        agent: payload.agent_key,
        title: payload.title,
      },
    });

    return NextResponse.json({
      missionId: id,
      step: created,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to add mission step.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
