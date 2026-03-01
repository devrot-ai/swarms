import { NextRequest, NextResponse } from "next/server";
import { validateAndEncryptKey } from "@/lib/mission-control/security";
import { userKeyStore } from "@/lib/mission-control/userKeyStore";

interface ValidateApiKeyInput {
  provider: "google" | "openai" | "anthropic" | "custom";
  apiKey: string;
  model?: string;
}

const providerMap: Record<ValidateApiKeyInput["provider"], "google" | "openai" | "anthropic" | "other"> = {
  google: "google",
  openai: "openai",
  anthropic: "anthropic",
  custom: "other",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const { uid } = await params;
    const body = (await req.json()) as ValidateApiKeyInput;

    if (!uid || !body?.provider || !body?.apiKey) {
      return NextResponse.json(
        { valid: false, error: "uid, provider and apiKey are required." },
        { status: 400 },
      );
    }

    const providerForValidation = providerMap[body.provider];
    const secured = validateAndEncryptKey(body.apiKey, providerForValidation);

    userKeyStore.save(uid, {
      provider: body.provider,
      model: body.model ?? "user-selected",
      keyRef: secured.keyRef,
      fingerprint: secured.fingerprint,
      encryptedKey: secured.encryptedKey,
      createdAtUtc: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        valid: true,
        message: "Key accepted. Choose an agent template.",
        keyRef: secured.keyRef,
        fingerprint: secured.fingerprint,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        valid: false,
        error: error instanceof Error ? error.message : "Validation failed",
      },
      { status: 400 },
    );
  }
}
