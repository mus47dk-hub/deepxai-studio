import { NextResponse } from "next/server";

const supportedModels = [
  "real-esrgan-4x",
  "gfpgan-face",
  "clarity-hd",
] as const;
type EnhanceModel = (typeof supportedModels)[number];

type EnhanceRequest = {
  image: string;
  model: EnhanceModel;
};

function isEnhanceRequest(value: unknown): value is EnhanceRequest {
  if (typeof value !== "object" || value === null) return false;

  const request = value as { image?: unknown; model?: unknown };
  return (
    typeof request.image === "string" &&
    typeof request.model === "string" &&
    supportedModels.includes(request.model as EnhanceModel)
  );
}

function isSupportedImageData(value: string): boolean {
  return /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(
    value,
  );
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (!isEnhanceRequest(body)) {
      return NextResponse.json(
        { error: "Image data and a supported enhancement model are required" },
        { status: 400 },
      );
    }

    if (!isSupportedImageData(body.image) || body.image.length > 30_000_000) {
      return NextResponse.json(
        { error: "Image must be a supported base64-encoded photo under 30 MB" },
        { status: 400 },
      );
    }

    const pipeline = (() => {
      switch (body.model) {
        case "real-esrgan-4x":
          return "real-esrgan-4x";
        case "gfpgan-face":
          return "gfpgan-face";
        case "clarity-hd":
          return "clarity-hd";
      }
    })();

    return NextResponse.json({
      image: body.image,
      model: body.model,
      pipeline,
    });
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Unable to prepare image enhancement" },
      { status: 500 },
    );
  }
}
