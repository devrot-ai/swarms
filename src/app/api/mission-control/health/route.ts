import { NextResponse } from "next/server";
import { agentMetadata } from "@/lib/mission-control/agents";

export async function GET() {
  // Vercel AI Gateway is zero-config - always available
  const models = [
    { provider: "openai", model: "openai/gpt-4o", label: "GPT-4o (OpenAI)" },
    { provider: "openai", model: "openai/gpt-4o-mini", label: "GPT-4o Mini (OpenAI)" },
    { provider: "openai", model: "openai/gpt-5-mini", label: "GPT-5 Mini (OpenAI)" },
    { provider: "anthropic", model: "anthropic/claude-opus-4.6", label: "Claude Opus 4.6 (Anthropic)" },
    { provider: "google", model: "google/gemini-3-flash", label: "Gemini 3 Flash (Google)" },
  ];

  const agents = Object.entries(agentMetadata).map(([id, meta]) => ({
    id,
    name: meta.name,
    department: meta.department,
    description: meta.description,
  }));

  return NextResponse.json({
    status: "ok",
    providers: {
      vercel_ai_gateway: true,
      openai: true,
      anthropic: true,
      google: true,
    },
    models,
    selectedModel: models[0]?.model ?? "openai/gpt-4o",
    agents,
    agentCount: agents.length,
    capabilities: [
      "Strategic planning and vision",
      "Operational task management",
      "Technical implementation",
      "Code generation and review",
      "Marketing campaigns",
      "Financial analysis",
      "HR and capacity planning",
      "Legal compliance",
      "Quality assurance",
      "DevOps and deployment",
      "UX/UI design",
      "Research and analysis",
    ],
  });
}
