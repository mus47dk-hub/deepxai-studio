import { NextResponse } from "next/server";

type GenerateRequest = {
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
};

const supportedModels = ["deepxai-vision", "dall-e-3", "imagen-3"] as const;
type SupportedModel = (typeof supportedModels)[number];
const qualitySuffix =
  "masterpiece, ultra-detailed 8k resolution, crisp focus, studio lighting, photorealistic";
const negativePrompt =
  "blurry, low quality, distorted anatomy, pixelated, washed out colors, noisy, artifacts, deformed";

function isGenerateRequest(value: unknown): value is GenerateRequest {
  if (typeof value !== "object" || value === null || !("prompt" in value)) {
    return false;
  }

  const request = value as { prompt: unknown; model?: unknown; width?: unknown; height?: unknown };
  const dimensionsAreValid = [request.width, request.height].every(
    (dimension) => dimension === undefined || (typeof dimension === "number" && Number.isInteger(dimension)),
  );
  const modelIsValid = request.model === undefined || (typeof request.model === "string" && supportedModels.includes(request.model as SupportedModel));

  return typeof request.prompt === "string" && dimensionsAreValid && modelIsValid;
}

function isValidDimension(value: number): boolean {
  return value >= 256 && value <= 2048;
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();

    if (!isGenerateRequest(body)) {
      return NextResponse.json({ error: "Request body must include a string prompt" }, { status: 400 });
    }

    const prompt = body.prompt.trim();
    const model = body.model ?? "deepxai-vision";
    const width = body.width ?? 1024;
    const height = body.height ?? 1024;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    if (!isValidDimension(width) || !isValidDimension(height)) {
      return NextResponse.json(
        { error: "Width and height must be integers between 256 and 2048" },
        { status: 400 },
      );
    }

    const providerModel = (() => {
      switch (model) {
        case "dall-e-3":
          return "dall-e-3";
        case "imagen-3":
          return "imagen-3";
        case "deepxai-vision":
        default:
          return "flux";
      }
    })();
    const qualityPrompt = `${prompt}, ${qualitySuffix}`;
    const seed = Math.floor(Math.random() * 1000000);
    const query = new URLSearchParams({
      model: providerModel,
      seed: String(seed),
      width: String(Math.min(width, 2048)),
      height: String(Math.min(height, 2048)),
      nologo: "true",
      negative_prompt: negativePrompt,
      quality: "hd",
    });
    const targetUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(qualityPrompt)}?${query.toString()}`;

    const response = await fetch(targetUrl, {
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "AI image generation failed" }, { status: 502 });
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type")?.split(";", 1)[0] || "image/jpeg";

    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "AI provider returned an invalid image" }, { status: 502 });
    }

    return new Response(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }

    if (error instanceof DOMException && error.name === "TimeoutError") {
      return NextResponse.json({ error: "AI image generation timed out" }, { status: 504 });
    }

    return NextResponse.json({ error: "Unable to generate image" }, { status: 500 });
  }
}
