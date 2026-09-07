"use client";

import { useEffect, useRef, useState } from "react";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";

type Tab = "Generator" | "Enhancer" | "Pro Editor" | "History";
const tabs: Tab[] = ["Generator", "Enhancer", "Pro Editor", "History"];
const ratios = ["1:1", "4:5", "16:9", "9:16"];
const aspectClasses: Record<string, string> = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "16:9": "aspect-[16/9]",
  "9:16": "aspect-[9/16]",
};
const models = [
  { value: "deepxai-vision", label: "DeepXAI Vision", detail: "Creative v2.4" },
  {
    value: "dall-e-3",
    label: "DALL-E 3 (OpenAI)",
    detail: "OpenAI image model",
  },
  {
    value: "imagen-3",
    label: "Google Imagen (Gemini)",
    detail: "Google image model",
  },
] as const;
const enhancerModels = [
  { value: "real-esrgan-4x", label: "Real-ESRGAN (Ultra-Sharp 4K)" },
  {
    value: "gfpgan-face",
    label: "GFPGAN / CodeFormer (Face Restoration)",
  },
  { value: "clarity-hd", label: "Clarity HD (Balanced Detail)" },
] as const;
type EnhancerModel = (typeof enhancerModels)[number]["value"];
const editorRatios = ["1:1", "4:5", "9:16"];
const presets = [
  "Gym & Fitness · Dark Moody Shred",
  "Gym & Fitness · High-Contrast Pump",
  "Gym & Fitness · Neon Beast",
  "Gym & Fitness · Shadow Sculpt",
  "Aesthetic & Vibe · Old Money 2000s Flash",
  "Aesthetic & Vibe · Golden Hour Radiance",
  "Aesthetic & Vibe · Tokyo Cyber Neon",
  "Aesthetic & Vibe · 90s Vintage Matte",
  "Aesthetic & Vibe · Cinematic Teal & Orange",
  "Natural & Portrait · Soft Porcelain Skin",
  "Natural & Portrait · Clean Commercial Studio",
  "Natural & Portrait · Natural Sun-Kissed",
  "Natural & Portrait · Crisp HDR Daylight",
  "Natural & Portrait · Editorial Film Bloom",
  "Gym & Fitness · Electric Lime Flash",
  "Aesthetic & Vibe · Studio Tungsten",
  "Moody Film Noir",
  "Vintage Warmth (Kodak 35mm)",
  "Cyberpunk Neon",
  "Soft Aesthetic Pastel",
];
const presetFilters = [
  "brightness(0.78) contrast(1.5) saturate(0.72) sepia(0.12)",
  "brightness(0.96) contrast(1.65) saturate(1.32)",
  "brightness(0.9) contrast(1.35) saturate(1.8) hue-rotate(285deg)",
  "brightness(0.7) contrast(1.7) saturate(0.55) hue-rotate(350deg)",
  "brightness(1.08) contrast(1.18) saturate(0.58) sepia(0.22)",
  "brightness(1.12) contrast(1.12) saturate(1.4) sepia(0.12) hue-rotate(-6deg)",
  "brightness(0.92) contrast(1.4) saturate(1.65) hue-rotate(155deg)",
  "brightness(1.02) contrast(0.92) saturate(0.72) sepia(0.3)",
  "brightness(0.96) contrast(1.32) saturate(1.22) hue-rotate(330deg)",
  "brightness(1.08) contrast(1.08) saturate(0.76) sepia(0.08)",
  "brightness(1.08) contrast(1.28) saturate(0.92)",
  "brightness(1.1) contrast(1.12) saturate(1.22) sepia(0.08)",
  "brightness(1.04) contrast(1.5) saturate(1.18)",
  "brightness(1.06) contrast(1.04) saturate(0.9) sepia(0.16)",
  "brightness(0.94) contrast(1.55) saturate(1.72) hue-rotate(58deg)",
  "brightness(1.02) contrast(1.24) saturate(1.28) sepia(0.18) hue-rotate(-18deg)",
  "brightness(0.72) contrast(1.5) saturate(0.18) grayscale(0.72)",
  "brightness(1.08) contrast(1.08) saturate(0.9) sepia(0.38) hue-rotate(-8deg)",
  "brightness(0.9) contrast(1.5) saturate(1.9) hue-rotate(285deg)",
  "brightness(1.08) contrast(0.94) saturate(0.72) sepia(0.08) hue-rotate(18deg)",
];
type HistoryItem = {
  id: string;
  imageUrl: string;
  title: string;
  detail: string;
  timestamp: string;
};

const creditPlans = [
  {
    name: "Weekly Pass",
    price: "₹59",
    credits: 50,
    badge: "Starter",
    features: ["HD downloads", "Fast processing", "Personal use rights"],
  },
  {
    name: "Monthly Pro",
    price: "₹299",
    credits: 300,
    badge: "Most Popular",
    features: ["HD downloads", "Priority processing", "Commercial rights"],
  },
  {
    name: "Yearly Ultra",
    price: "₹2,999",
    credits: 4000,
    badge: "Best Value",
    features: [
      "Ultra HD downloads",
      "Priority processing",
      "Commercial rights",
    ],
  },
];

const historyStorageKey = (userId: string) => `deepxai-history-${userId}`;
const creditsStorageKey = (userId: string) => `deepxai-credits-${userId}`;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Unable to save image history"));
    reader.onerror = () => reject(new Error("Unable to save image history"));
    reader.readAsDataURL(blob);
  });
}
const sharpenKernel = [-1, -1, -1, -1, 9, -1, -1, -1, -1];
const comparisonOriginals = new Map<string, string>();

function sharpenImage(imageData: ImageData): ImageData {
  const { width, height, data } = imageData;
  const source = new Uint8ClampedArray(data);
  const output = new Uint8ClampedArray(data.length);
  const indexAt = (x: number, y: number) => (y * width + x) * 4;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const target = indexAt(x, y);
      let red = 0;
      let green = 0;
      let blue = 0;
      let kernelIndex = 0;

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const sampleX = Math.min(width - 1, Math.max(0, x + offsetX));
          const sampleY = Math.min(height - 1, Math.max(0, y + offsetY));
          const sample = indexAt(sampleX, sampleY);
          const weight = sharpenKernel[kernelIndex];
          red += source[sample] * weight;
          green += source[sample + 1] * weight;
          blue += source[sample + 2] * weight;
          kernelIndex += 1;
        }
      }

      output[target] = Math.max(0, Math.min(255, red));
      output[target + 1] = Math.max(0, Math.min(255, green));
      output[target + 2] = Math.max(0, Math.min(255, blue));
      output[target + 3] = source[target + 3];
    }
  }

  return new ImageData(output, width, height);
}

function stretchContrast(imageData: ImageData): void {
  const { data } = imageData;
  const minimum = [255, 255, 255];
  const maximum = [0, 0, 0];

  for (let index = 0; index < data.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      minimum[channel] = Math.min(minimum[channel], data[index + channel]);
      maximum[channel] = Math.max(maximum[channel], data[index + channel]);
    }
  }

  for (let index = 0; index < data.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const range = Math.max(1, maximum[channel] - minimum[channel]);
      data[index + channel] = Math.max(
        0,
        Math.min(
          255,
          ((data[index + channel] - minimum[channel]) * 255) / range,
        ),
      );
    }
  }
}

function boostMicroContrast(imageData: ImageData): void {
  const { width, height, data } = imageData;
  const source = new Uint8ClampedArray(data);
  const indexAt = (x: number, y: number) => (y * width + x) * 4;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = indexAt(x, y);
      const red = source[index];
      const green = source[index + 1];
      const blue = source[index + 2];
      const skinTone =
        red > 70 &&
        green > 35 &&
        blue > 20 &&
        red > green * 1.12 &&
        green > blue * 1.18;
      if (!skinTone) continue;

      let neighborLuminance = 0;
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;
          const neighbor = indexAt(x + offsetX, y + offsetY);
          neighborLuminance +=
            source[neighbor] * 0.299 +
            source[neighbor + 1] * 0.587 +
            source[neighbor + 2] * 0.114;
        }
      }

      const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
      const detail = (luminance - neighborLuminance / 8) * 0.32;
      data[index] = Math.max(0, Math.min(255, red + detail));
      data[index + 1] = Math.max(0, Math.min(255, green + detail));
      data[index + 2] = Math.max(0, Math.min(255, blue + detail));
    }
  }
}

function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function Artwork({
  variant = "warm",
  blur = 0,
  imageSrc,
  fit = "contain",
}: {
  variant?: string;
  blur?: number;
  imageSrc?: string;
  fit?: "contain" | "cover";
}) {
  if (imageSrc) {
    return (
      <div
        className={`art art-${variant} uploaded-art`}
        style={{
          filter: `blur(${blur}px)`,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
        aria-label="Uploaded image preview"
      >
        <img
          className="uploaded-image"
          src={imageSrc}
          alt="Uploaded preview"
          style={{
            position: "relative",
            inset: "auto",
            display: "block",
            width: "100%",
            height: "100%",
            maxWidth: "100%",
            maxHeight: "100%",
            margin: "0 auto",
            objectFit: fit,
          }}
        />
      </div>
    );
  }

  return (
    <div className="empty-upload-zone" aria-label="Upload an image to begin">
      <span>Upload an image to begin</span>
    </div>
  );
}

function jumpToComparison(value: number): void {
  const range = document.querySelector<HTMLInputElement>(".compare-range");
  if (!range) return;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(range, String(value));
  range.dispatchEvent(new Event("input", { bubbles: true }));
}

function Compare({
  position,
  imageSrc,
  beforeImageSrc,
}: {
  position: number;
  imageSrc?: string;
  beforeImageSrc?: string;
}) {
  const rawImage = imageSrc
    ? (beforeImageSrc ?? comparisonOriginals.get(imageSrc) ?? imageSrc)
    : undefined;
  if (!imageSrc || !rawImage) {
    return (
      <div
        className="empty-upload-zone compare-empty"
        aria-label="Upload an image to compare"
      >
        <span>Upload an image to compare</span>
      </div>
    );
  }

  return (
    <div className="compare">
      <img className="compare-image after-image" src={imageSrc} alt="After" />
      <div
        className="before"
        style={{
          clipPath: `polygon(0 0, ${position}% 0, ${position}% 100%, 0 100%)`,
        }}
      >
        <img className="compare-image" src={rawImage} alt="Before" />
      </div>
      <div className="compare-handle" style={{ left: `${position}%` }}>
        <b>↔</b>
      </div>
      <span className="before-label">BEFORE</span>
      <span className="after-label">AFTER</span>
      <div className="comparison-toggle-row">
        <button
          type="button"
          className={
            position >= 100 ? "comparison-toggle active" : "comparison-toggle"
          }
          onClick={() => jumpToComparison(100)}
        >
          Before
        </button>
        <button
          type="button"
          className={
            position <= 0 ? "comparison-toggle active" : "comparison-toggle"
          }
          onClick={() => jumpToComparison(0)}
        >
          After
        </button>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  max,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="slider">
      <span>
        {label}
        <output>
          {value}
          {unit}
        </output>
      </span>
      <input
        type="range"
        min="0"
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export default function Page() {
  const [tab, setTab] = useState<Tab>("Generator");
  const { isLoaded, isSignedIn, user } = useUser();
  const [prompt, setPrompt] = useState(
    "A quiet alpine lake at first light, cinematic and serene",
  );
  const [ratio, setRatio] = useState("4:5");
  const [model, setModel] = useState("deepxai-vision");
  const [editorRatio, setEditorRatio] = useState("4:5");
  const [position, setPosition] = useState(52);
  const [sharpness, setSharpness] = useState(76);
  const [clarity, setClarity] = useState(64);
  const [bokeh, setBokeh] = useState(7);
  const [preset, setPreset] = useState(0);
  const [generated, setGenerated] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [enhancerImage, setEnhancerImage] = useState<string | null>(null);
  const [editorImage, setEditorImage] = useState<string | null>(null);
  const [enhancedImage, setEnhancedImage] = useState<string | null>(null);
  const [enhancerModel, setEnhancerModel] =
    useState<EnhancerModel>("real-esrgan-4x");
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [enhancerProcessing, setEnhancerProcessing] = useState(false);
  const [editorProcessing, setEditorProcessing] = useState(false);
  const [enhancerError, setEnhancerError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [credits, setCredits] = useState(5);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [authPrompt, setAuthPrompt] = useState<"signin" | "upgrade" | null>(
    null,
  );
  const [pricingOpen, setPricingOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const enhancerFileInputRef = useRef<HTMLInputElement>(null);
  const editorFileInputRef = useRef<HTMLInputElement>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement>(null);
  const enhancerUploadVersionRef = useRef(0);
  const editorUploadVersionRef = useRef(0);
  const surprises = [
    "A glass greenhouse floating above a misty forest",
    "Sunlit terracotta rooftops after summer rain",
    "A lunar garden blooming in a quiet desert",
  ];
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) {
      return undefined;
    }
    let active = true;
    const hydrate = window.setTimeout(() => {
      if (!active) return;
      const storedCredits = Number(
        sessionStorage.getItem(creditsStorageKey(user.id)),
      );
      const storedHistory = sessionStorage.getItem(historyStorageKey(user.id));
      setCredits(
        Number.isFinite(storedCredits) && storedCredits >= 0
          ? storedCredits
          : 5,
      );
      if (!storedCredits && storedCredits !== 0)
        sessionStorage.setItem(creditsStorageKey(user.id), "5");
      try {
        setHistory(
          storedHistory ? (JSON.parse(storedHistory) as HistoryItem[]) : [],
        );
      } catch {
        setHistory([]);
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(hydrate);
    };
  }, [isLoaded, isSignedIn, user]);

  useEffect(() => {
    if (!user || !isSignedIn) return;
    sessionStorage.setItem(creditsStorageKey(user.id), String(credits));
    sessionStorage.setItem(historyStorageKey(user.id), JSON.stringify(history));
  }, [credits, history, isSignedIn, user]);

  const consumeCredit = (): boolean => {
    if (!isLoaded || !isSignedIn) {
      setAuthPrompt("signin");
      return false;
    }
    if (credits < 1) {
      setAuthPrompt("upgrade");
      return false;
    }
    setCredits((current) => current - 1);
    return true;
  };

  const openPricing = () => {
    if (!isSignedIn) {
      setAuthPrompt("signin");
      return;
    }
    setPricingOpen(true);
  };

  const choosePlan = (plan: (typeof creditPlans)[number]) => {
    if (!isSignedIn) {
      setPricingOpen(false);
      setAuthPrompt("signin");
      return;
    }
    setCredits((current) => current + plan.credits);
    setPricingOpen(false);
    setAuthPrompt(null);
    setToast(
      `${plan.name} added ${plan.credits.toLocaleString()} credits to your balance.`,
    );
    window.setTimeout(() => setToast(null), 4200);
  };

  const saveHistory = (imageUrl: string, title: string, detail: string) => {
    if (!user || !isSignedIn) return;
    setHistory((current) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        imageUrl,
        title,
        detail,
        timestamp: new Date().toLocaleString(),
      },
      ...current,
    ]);
  };
  const surprise = () =>
    setPrompt(surprises[(surprises.indexOf(prompt) + 1) % surprises.length]);
  const openFilePicker = () => {
    const target = tab === "Enhancer" ? "enhancer" : "editor";
    (target === "enhancer"
      ? enhancerFileInputRef
      : editorFileInputRef
    ).current?.click();
  };
  const handleImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    target: "enhancer" | "editor",
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (target === "enhancer") enhancerUploadVersionRef.current += 1;
    else editorUploadVersionRef.current += 1;
    const reader = new FileReader();
    reader.onload = () => {
      const imageData =
        typeof reader.result === "string" ? reader.result : null;
      if (target === "enhancer") {
        setEnhancerImage(imageData);
        setEnhancedImage(null);
        setEnhancerProcessing(false);
        setEnhancerError(null);
      } else {
        setEditorImage(imageData);
        setProcessedImage(null);
        setEditorProcessing(false);
        setEditorError(null);
      }
      setPosition(52);
      setExportOpen(false);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };
  const handleEnhance = async () => {
    const sourceImage = enhancerImage;
    if (!sourceImage || !processingCanvasRef.current) return;
    if (!sourceImage.startsWith("data:image/")) {
      setEnhancerError("This photo has an invalid image format.");
      setToast("This photo could not be enhanced.");
      return;
    }
    if (!consumeCredit()) return;

    const requestVersion = enhancerUploadVersionRef.current;
    setEnhancerProcessing(true);
    setEnhancerError(null);
    const failEnhancement = () => {
      if (requestVersion !== enhancerUploadVersionRef.current) return;
      setEnhancerProcessing(false);
      setEnhancerError("This photo could not be enhanced.");
      setToast("This photo could not be enhanced.");
    };
    try {
      const response = await fetch("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: sourceImage, model: enhancerModel }),
      });
      const result: unknown = await response.json();
      if (
        !response.ok ||
        typeof result !== "object" ||
        result === null ||
        !("image" in result) ||
        typeof result.image !== "string"
      ) {
        throw new Error("Enhancement service unavailable");
      }

      const image = new Image();
      image.onload = () => {
        if (requestVersion !== enhancerUploadVersionRef.current) return;
        try {
        const canvas = processingCanvasRef.current;
        const context = canvas?.getContext("2d", { willReadFrequently: true });
        if (
          !canvas ||
          !context ||
          image.naturalWidth === 0 ||
          image.naturalHeight === 0
        ) {
          failEnhancement();
          return;
        }

        canvas.width = image.naturalWidth * 2;
        canvas.height = image.naturalHeight * 2;
        context.filter = "none";
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        let enhancedPixels = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        );
        const sharpenPasses =
          enhancerModel === "real-esrgan-4x"
            ? 3
            : enhancerModel === "gfpgan-face"
              ? 1
              : 2;
        for (let pass = 0; pass < sharpenPasses; pass += 1) {
          enhancedPixels = sharpenImage(enhancedPixels);
        }
        stretchContrast(enhancedPixels);
        if (enhancerModel !== "gfpgan-face") {
          boostMicroContrast(enhancedPixels);
        }
        context.putImageData(enhancedPixels, 0, 0);
        const enhancedDataUrl = canvas.toDataURL("image/jpeg", 0.95);
        comparisonOriginals.set(enhancedDataUrl, sourceImage);
        setEnhancedImage(enhancedDataUrl);
        saveHistory(
          enhancedDataUrl,
          "HD Enhancement",
          `${sharpness}% sharpness · ${clarity}% clarity · ${bokeh}px bokeh`,
        );
        setEnhancerProcessing(false);
        } catch {
          failEnhancement();
        }
      };
      image.onerror = failEnhancement;
      image.src = result.image;
    } catch {
      failEnhancement();
    }
  };
  const handleColorGrade = () => {
    if (!editorImage || !processingCanvasRef.current || !consumeCredit())
      return;
    const requestVersion = editorUploadVersionRef.current;
    setEditorProcessing(true);
    setEditorError(null);
    const image = new Image();
    image.onload = () => {
      if (requestVersion !== editorUploadVersionRef.current) return;
      const canvas = processingCanvasRef.current;
      const context = canvas?.getContext("2d");
      if (
        !canvas ||
        !context ||
        image.naturalWidth === 0 ||
        image.naturalHeight === 0
      ) {
        setEditorProcessing(false);
        setEditorError("This image could not be processed.");
        return;
      }

      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.filter = presetFilters[preset];
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const gradedDataUrl = canvas.toDataURL("image/jpeg", 0.92);
      comparisonOriginals.set(gradedDataUrl, editorImage);
      setProcessedImage(gradedDataUrl);
      saveHistory(gradedDataUrl, "Pro Color Grade", presets[preset]);
      setEditorProcessing(false);
    };
    image.onerror = () => {
      if (requestVersion !== editorUploadVersionRef.current) return;
      setEditorProcessing(false);
      setEditorError("This image could not be processed.");
    };
    image.src = editorImage;
  };
  const handleGenerate = async () => {
    if (!consumeCredit()) return;
    if (generatedImage) URL.revokeObjectURL(generatedImage);
    setGeneratedImage(null);
    setGenerated(false);
    setGenerating(true);
    setGenerationError(null);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          width: 1024,
          height: ratio === "1:1" ? 1024 : 1280,
        }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorBody?.error || "Unable to generate image");
      }

      const imageBlob = await response.blob();
      const imageUrl = URL.createObjectURL(imageBlob);
      saveHistory(await blobToDataUrl(imageBlob), "AI Generation", prompt);
      if (generatedImage) URL.revokeObjectURL(generatedImage);
      setGeneratedImage(imageUrl);
      setGenerated(true);
    } catch (error: unknown) {
      setGenerationError(
        error instanceof Error ? error.message : "Unable to generate image",
      );
    } finally {
      setGenerating(false);
    }
  };
  const handleDownloadArt = async () => {
    if (!generatedImage) return;

    try {
      const response = await fetch(generatedImage);
      if (!response.ok)
        throw new Error("Unable to prepare the generated image");
      const imageBlob = await response.blob();
      const downloadUrl = URL.createObjectURL(imageBlob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = "deepxai-generated-art-full-hd.jpg";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (error: unknown) {
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Unable to download the generated image",
      );
    }
  };
  const uploadedImage = tab === "Enhancer" ? enhancerImage : editorImage;
  const processing = tab === "Enhancer" ? enhancerProcessing : editorProcessing;
  const processingError = tab === "Enhancer" ? enhancerError : editorError;
  const enhancerDownload = enhancedImage ?? enhancerImage;
  const editorDownload = processedImage ?? editorImage;
  const editorDownloadName = `deepxai-${processedImage ? "graded" : "photo"}-${editorRatio.replace(":", "x")}.jpg`;
  const selectedModel =
    models.find((item) => item.value === model) ?? models[0];

  return (
    <main className="studio">
      <input
        ref={enhancerFileInputRef}
        className="file-input"
        type="file"
        accept="image/*"
        onChange={(event) => handleImageUpload(event, "enhancer")}
        aria-label="Upload an image for Enhancer"
      />
      <input
        ref={editorFileInputRef}
        className="file-input"
        type="file"
        accept="image/*"
        onChange={(event) => handleImageUpload(event, "editor")}
        aria-label="Upload an image for Pro Editor"
      />
      <canvas
        ref={processingCanvasRef}
        className="processing-canvas"
        style={{ display: "none" }}
        aria-hidden="true"
      />
      <header className="topbar">
        <div className="brand">
          <Mark /> DeepXAI <span>Studio</span>
        </div>
        <nav>
          {tabs.map((item) => (
            <button
              key={item}
              className={tab === item ? "active" : ""}
              onClick={() => setTab(item)}
            >
              <i className={`dot dot-${item[0]}`} />
              {item}
            </button>
          ))}
        </nav>
        <div className="account">
          {isSignedIn ? (
            <>
              <button
                className="credit-badge"
                type="button"
                onClick={openPricing}
              >
                ✦ {credits} credits <span>Get Credits</span>
              </button>
              <UserButton />
            </>
          ) : (
            <>
              <SignInButton mode="modal">
                <button className="auth-button" type="button">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="auth-button auth-primary" type="button">
                  Sign up
                </button>
              </SignUpButton>
            </>
          )}
        </div>
      </header>
      <div className="page">
        <div className="heading">
          <div>
            <small>DEEPXAI / {tab.toUpperCase()}</small>
            <h1>
              {tab === "Generator"
                ? "Make something remarkable."
                : tab === "Enhancer"
                  ? "Bring every detail forward."
                  : "Finish with intention."}
            </h1>
          </div>
          <span className="saved">● All changes saved</span>
        </div>

        {tab === "Generator" && (
          <div className="layout">
            <section className="panel controls">
              <h2>
                <small>01</small> Describe your image
              </h2>
              <label className="label" htmlFor="prompt">
                Prompt
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
              />
              <div className="prompt-meta">
                <span>{prompt.length} / 500</span>
                <button onClick={surprise}>✧ Surprise Me</button>
              </div>
              <hr />
              <label className="label">Aspect ratio</label>
              <div className="ratios">
                {ratios.map((item) => (
                  <button
                    key={item}
                    className={ratio === item ? "selected" : ""}
                    onClick={() => setRatio(item)}
                  >
                    <i className={`ratio ratio-${item.replace(":", "-")}`} />
                    {item}
                  </button>
                ))}
              </div>
              <label className="label model-label" htmlFor="model">
                Model <small>BETA</small>
              </label>
              <div className="model">
                <i />
                <select
                  id="model"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  aria-label="Image generation model"
                >
                  {models.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <strong>⌄</strong>
              </div>
              <button
                className="primary"
                type="button"
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
              >
                {generating ? (
                  <>
                    <span className="loading-spinner" aria-hidden="true" />{" "}
                    Generating image…
                  </>
                ) : (
                  "Generate image"
                )}{" "}
                {!generating && <b>↗</b>}
              </button>
              {generationError && (
                <p className="generation-error" role="alert">
                  {generationError}
                </p>
              )}
              <p className="note">
                Estimated cost <b>12 credits</b> · approx. 8 sec
              </p>
            </section>
            <section className="panel preview">
              <header>
                CREATIVE CANVAS <span>{ratio} · 1024 × 1280</span>
              </header>
              <div className={`canvas generated-canvas ${aspectClasses[ratio]}`}>
                <Artwork
                  variant={generated ? "fresh" : "warm"}
                  imageSrc={generatedImage ?? undefined}
                  fit="cover"
                />
                <div className="caption">
                  <b>
                    {generating
                      ? "Generating your image"
                      : generated
                        ? "Image generated"
                        : "Your image appears here"}
                  </b>
                  <small>
                    {generating
                      ? `${selectedModel.label} · working now`
                      : generated
                        ? `${selectedModel.label} · just now`
                        : "A live preview of your creation"}
                  </small>
                </div>
              </div>
              <footer>
                <span>
                  ●{" "}
                  {generating
                    ? "Generating"
                    : generated
                      ? "Ready to use"
                      : "Ready to create"}
                </span>
                <span>Drag to reposition · Scroll to zoom</span>
              </footer>
              <button
                className="primary download-button"
                type="button"
                onClick={handleDownloadArt}
                disabled={!generatedImage || generating}
              >
                ⬇ Download Art (Full HD)
              </button>
            </section>
          </div>
        )}

        {tab === "Enhancer" && (
          <div className="layout">
            <section className="panel controls">
              <h2>
                <small>01</small> Fine-tune your image
              </h2>
              <div className="upload">
                <b>↑</b>
                <strong>
                  {uploadedImage ? "Image ready" : "Drop an image here"}
                </strong>
                <span>
                  {uploadedImage
                    ? "Choose another image to replace it"
                    : "or browse from your device"}
                </span>
                <button type="button" onClick={openFilePicker}>
                  {uploadedImage ? "Change image" : "Upload Blurry Photo"}
                </button>
              </div>
              <hr />
              <Slider
                label="Edge sharpness"
                value={sharpness}
                max={100}
                onChange={setSharpness}
              />
              <Slider
                label="Clarity"
                value={clarity}
                max={100}
                onChange={setClarity}
              />
              <Slider
                label="Bokeh blur"
                value={bokeh}
                max={16}
                unit=" px"
                onChange={setBokeh}
              />
              <label className="label model-label" htmlFor="enhancer-model">
                Enhancement model
              </label>
              <select
                id="enhancer-model"
                className="enhancer-model"
                value={enhancerModel}
                onChange={(event) =>
                  setEnhancerModel(event.target.value as EnhancerModel)
                }
              >
                {enhancerModels.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <button
                className="primary"
                type="button"
                onClick={handleEnhance}
                disabled={!uploadedImage || processing}
              >
                {processing ? "Upscaling and sharpening…" : "Enhance image"}{" "}
                <b>↗</b>
              </button>
              {processingError && (
                <p className="generation-error" role="alert">
                  {processingError}
                </p>
              )}
              <p className="note">
                2x HD upscaling · multi-pass detail recovery
              </p>
            </section>
            <section className="panel preview">
              <header>
                BEFORE / AFTER <span>Drag the handle to compare</span>
              </header>
              <div className="canvas">
                <Compare
                  position={position}
                  imageSrc={enhancedImage ?? uploadedImage ?? undefined}
                />
              </div>
              <input
                className="compare-range"
                type="range"
                min="0"
                max="100"
                value={position}
                onChange={(event) => setPosition(Number(event.target.value))}
                aria-label="Before and after comparison"
              />
              <footer>
                <span>
                  ●{" "}
                  {enhancedImage
                    ? "HD enhanced preview"
                    : uploadedImage
                      ? "Uploaded preview"
                      : "Enhanced preview"}
                </span>
                <span>Bokeh blur {bokeh}px</span>
              </footer>
              {enhancerDownload && (
                <a
                  className="primary download-button"
                  href={enhancerDownload}
                  download="deepxai-enhanced-photo.jpg"
                >
                  Download HD Enhanced Photo <b>↓</b>
                </a>
              )}
            </section>
          </div>
        )}

        {tab === "Pro Editor" && (
          <div className="layout">
            <section className="panel controls">
              <h2>
                <small>01</small> Color grade
              </h2>
              <div className="upload editor-upload">
                <b>↑</b>
                <strong>
                  {uploadedImage ? "Image ready" : "Add an image to edit"}
                </strong>
                <span>
                  {uploadedImage
                    ? "Choose another image to replace it"
                    : "Upload a photo to start editing"}
                </span>
                <button type="button" onClick={openFilePicker}>
                  {uploadedImage ? "Change image" : "Upload Photo"}
                </button>
              </div>
              <hr />
              <div className="preset-grid">
                {presets.map((item, index) => (
                  <button
                    key={item}
                    className={preset === index ? "preset chosen" : "preset"}
                    onClick={() => setPreset(index)}
                  >
                    <i
                      style={{
                        background: `linear-gradient(135deg, hsl(${index * 34 + 70} 45% 70%), #293d37)`,
                      }}
                    />
                    {item}
                    {preset === index && <b>✓</b>}
                  </button>
                ))}
              </div>
              <button
                className="primary"
                type="button"
                onClick={handleColorGrade}
                disabled={!uploadedImage || processing}
              >
                {processing ? "Applying color grade…" : "Apply Color Grade"}{" "}
                <b>↗</b>
              </button>
              {processingError && (
                <p className="generation-error" role="alert">
                  {processingError}
                </p>
              )}
              <hr />
              <label className="label">Canvas ratio</label>
              <div className="ratios editor-ratios">
                {editorRatios.map((item) => (
                  <button
                    key={item}
                    className={editorRatio === item ? "selected" : ""}
                    onClick={() => setEditorRatio(item)}
                  >
                    <i className={`ratio ratio-${item.replace(":", "-")}`} />
                    {item}
                  </button>
                ))}
              </div>
              <button
                className="primary"
                onClick={() => setExportOpen(!exportOpen)}
              >
                Export project <b>↗</b>
              </button>
              {exportOpen && (
                <div className="export-menu">
                  <strong>Export as</strong>
                  <button>
                    PNG <span>Lossless · 12.4 MB</span>
                  </button>
                  <button>
                    JPG <span>High quality · 4.8 MB</span>
                  </button>
                  <button>
                    WebP <span>Web optimized · 2.1 MB</span>
                  </button>
                </div>
              )}
            </section>
            <section className="panel preview">
              <header>
                PRO EDITOR <mark>PRO</mark>
                <span>{editorRatio} · 2400 × 3000</span>
              </header>
              <div className="canvas">
                <Compare
                  position={position}
                  imageSrc={processedImage ?? uploadedImage ?? undefined}
                />
              </div>
              <input
                className="compare-range"
                type="range"
                min="0"
                max="100"
                value={position}
                onChange={(event) => setPosition(Number(event.target.value))}
                aria-label="Editor before and after comparison"
              />
              <footer>
                <span>
                  Preset: <b>{presets[preset]}</b>
                  {processedImage ? " · Applied" : ""}
                </span>
                <span className="badge">
                  <Mark /> Exported with DeepXAI · {editorRatio}
                </span>
              </footer>
              {editorDownload && (
                <a
                  className="primary download-button"
                  href={editorDownload}
                  download={editorDownloadName}
                >
                  Download Full-Resolution Graded Image <b>↓</b>
                </a>
              )}
            </section>
          </div>
        )}
        {tab === "History" && (
          <section className="history-panel">
            {!isSignedIn ? (
              <div className="history-alert" role="alert">
                Please sign in to view your history.
              </div>
            ) : (
              <>
                <div className="history-toolbar">
                  <div>
                    <small>YOUR WORKSPACE</small>
                    <h2>Personal History</h2>
                  </div>
                  {history.length > 0 && (
                    <button
                      className="clear-history"
                      type="button"
                      onClick={() => setHistory([])}
                    >
                      Clear history
                    </button>
                  )}
                </div>
                {history.length === 0 ? (
                  <div className="history-empty">
                    Your generated and edited images will appear here.
                  </div>
                ) : (
                  <div className="history-grid">
                    {history.map((item) => (
                      <article className="history-card" key={item.id}>
                        <img src={item.imageUrl} alt={item.title} />
                        <div>
                          <strong>{item.title}</strong>
                          <small>{item.detail}</small>
                          <time>{item.timestamp}</time>
                          <a
                            className="history-download"
                            href={item.imageUrl}
                            download={`deepxai-${item.id}.jpg`}
                          >
                            ⬇ Download
                          </a>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>

      {authPrompt === "signin" && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setAuthPrompt(null)}
        >
          <div
            className="auth-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setAuthPrompt(null)}
            >
              ×
            </button>
            <span className="modal-kicker">DEEPXAI STUDIO</span>
            <h2>Sign in to keep creating.</h2>
            <p>
              Create an account to receive 5 free credits and save your personal
              history.
            </p>
            <div className="modal-actions">
              <SignInButton mode="modal">
                <button className="primary" type="button">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="auth-button auth-primary" type="button">
                  Create account
                </button>
              </SignUpButton>
            </div>
          </div>
        </div>
      )}
      {(pricingOpen || authPrompt === "upgrade") && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => {
            setPricingOpen(false);
            setAuthPrompt(null);
          }}
        >
          <div
            className="pricing-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close pricing-close"
              type="button"
              onClick={() => {
                setPricingOpen(false);
                setAuthPrompt(null);
              }}
            >
              ×
            </button>
            <span className="modal-kicker">DEEPXAI CREDITS</span>
            <h2>Keep your ideas moving.</h2>
            <p className="pricing-subtitle">
              Choose a plan and get back to making remarkable images.
            </p>
            <div className="plan-grid">
              {creditPlans.map((plan, index) => (
                <article
                  className={`plan-card ${index === 1 ? "plan-featured" : ""}`}
                  key={plan.name}
                >
                  <span className="plan-badge">{plan.badge}</span>
                  <h3>{plan.name}</h3>
                  <strong className="plan-price">{plan.price}</strong>
                  <span className="plan-credit-count">
                    / {plan.credits.toLocaleString()} credits
                  </span>
                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}>✓ {feature}</li>
                    ))}
                  </ul>
                  <button
                    className="plan-button"
                    type="button"
                    onClick={() => choosePlan(plan)}
                  >
                    Choose Plan
                  </button>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="success-toast" role="status">
          ✓ {toast}
        </div>
      )}

      <style jsx global>{`
        .loading-spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid #657268;
          border-top-color: #d8ef70;
          border-radius: 50%;
          animation: spin 0.75s linear infinite;
          vertical-align: -2px;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        .comparison-toggle-row {
          position: absolute;
          z-index: 5;
          left: 50%;
          bottom: 16px;
          display: flex;
          gap: 4px;
          padding: 3px;
          border: 1px solid #ffffff80;
          border-radius: 4px;
          background: #18211ecc;
          transform: translateX(-50%);
          backdrop-filter: blur(8px);
        }
        .comparison-toggle {
          border: 0;
          border-radius: 2px;
          background: transparent;
          color: #dce4dc;
          padding: 6px 12px;
          font-size: 10px;
          letter-spacing: 0.04em;
        }
        .comparison-toggle.active,
        .comparison-toggle:hover {
          background: #d8ef70;
          color: #18211e;
        }
        .empty-upload-zone {
          width: 100%;
          height: 100%;
          min-height: 260px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px dashed #cbd5c4;
          background: #fbfcf9;
          color: #8b978e;
          font-size: 11px;
          letter-spacing: 0.04em;
        }
        .compare-empty {
          min-height: 500px;
        }
        .canvas:has(.empty-upload-zone) .caption {
          display: none;
        }
        .compare-image {
          display: block;
          width: 100%;
          height: auto;
          object-fit: contain;
        }
        .download-button {
          font-size: 0;
          text-decoration: none;
          text-align: center;
        }
        .download-button::after {
          content: "⬇ Download Graded Photo";
          font-size: 12px;
        }
      `}</style>
      <style jsx global>{`
        :root {
          --ink: #18211e;
          --muted: #7e8981;
          --line: #dfe5df;
          --paper: #f5f7f2;
          --lime: #d8ef70;
        }
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          background: var(--paper);
          color: var(--ink);
          font-family: var(--font-geist-sans), Arial, sans-serif;
        }
        button,
        textarea,
        input {
          font: inherit;
        }
        button {
          cursor: pointer;
        }
        .studio {
          min-height: 100vh;
          background:
            radial-gradient(circle at 82% 5%, #e8f2ca, transparent 25%),
            var(--paper);
        }
        .topbar {
          min-height: 76px;
          border-bottom: 1px solid var(--line);
          background: #ffffffb8;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          padding: 0 4vw;
        }
        .brand {
          font-weight: 650;
          letter-spacing: -0.05em;
          font-size: 18px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .brand > span {
          font-weight: 400;
          color: #89938b;
        }
        .mark {
          display: inline-flex;
          gap: 2px;
          align-items: end;
          height: 19px;
          width: 21px;
        }
        .mark i {
          display: block;
          width: 5px;
          border-radius: 4px;
          background: var(--ink);
          transform: skew(-18deg);
        }
        .mark i:first-child {
          height: 10px;
        }
        .mark i:nth-child(2) {
          height: 17px;
          background: #aaca48;
        }
        .mark i:last-child {
          height: 13px;
        }
        nav {
          display: flex;
          height: 100%;
          gap: 5px;
        }
        nav button {
          position: relative;
          border: 0;
          background: none;
          color: #89928c;
          padding: 0 18px;
          font-size: 13px;
        }
        nav button.active {
          color: var(--ink);
          font-weight: 600;
        }
        nav button.active:after {
          content: "";
          height: 2px;
          background: var(--ink);
          position: absolute;
          left: 18px;
          right: 18px;
          bottom: -1px;
        }
        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
          margin-right: 8px;
        }
        .dot-G {
          background: #eaa1b2;
        }
        .dot-E {
          background: #d2bd62;
        }
        .dot-P {
          background: #83aecb;
        }
        .account {
          display: flex;
          justify-content: end;
          align-items: center;
          gap: 16px;
          color: #69766d;
          font-size: 12px;
        }
        .account b {
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #e6ece3;
          font-size: 12px;
          font-weight: 500;
        }
        .page {
          width: min(1360px, 92vw);
          margin: auto;
          padding: 57px 0 70px;
        }
        .heading {
          display: flex;
          align-items: end;
          justify-content: space-between;
          margin-bottom: 34px;
        }
        .heading small {
          font-size: 10px;
          letter-spacing: 0.16em;
          color: #99a39b;
          font-weight: 650;
        }
        .heading h1 {
          font-size: clamp(30px, 3.5vw, 48px);
          font-weight: 450;
          letter-spacing: -0.07em;
          line-height: 1;
          margin: 12px 0 0;
        }
        .saved {
          font-size: 11px;
          color: #849087;
        }
        .layout {
          display: grid;
          grid-template-columns: minmax(310px, 390px) 1fr;
          gap: 18px;
        }
        .panel {
          border: 1px solid var(--line);
          border-radius: 5px;
          background: #fff;
        }
        .controls {
          padding: 28px;
          position: relative;
        }
        .controls h2 {
          font-size: 16px;
          margin: 0 0 31px;
          font-weight: 600;
        }
        .controls h2 small {
          color: #a6b76c;
          font:
            11px var(--font-geist-mono),
            monospace;
          margin-right: 12px;
        }
        .label {
          display: block;
          color: #748078;
          font-weight: 600;
          font-size: 11px;
          margin-bottom: 10px;
        }
        .controls textarea {
          width: 100%;
          height: 124px;
          resize: vertical;
          background: #fbfcfa;
          border: 1px solid var(--line);
          border-radius: 3px;
          padding: 13px;
          color: var(--ink);
          line-height: 1.55;
          font-size: 13px;
          outline: 0;
        }
        .controls textarea:focus {
          border-color: #adc261;
          box-shadow: 0 0 0 3px #edf4d5;
        }
        .prompt-meta {
          display: flex;
          justify-content: space-between;
          color: #a0aaa2;
          font-size: 10px;
          margin-top: 8px;
        }
        .prompt-meta button {
          border: 0;
          background: none;
          color: #718b2d;
          font-size: 11px;
          padding: 0;
        }
        hr {
          border: 0;
          border-top: 1px solid var(--line);
          margin: 27px 0;
        }
        .ratios {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
        }
        .ratios button {
          min-height: 61px;
          border: 1px solid var(--line);
          border-radius: 3px;
          background: #fff;
          color: #7d8980;
          font-size: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 7px;
        }
        .ratios button.selected {
          border-color: #abc05b;
          background: #f3f8e5;
          color: var(--ink);
        }
        .ratio {
          border: 1px solid currentColor;
          display: block;
        }
        .ratio-1-1 {
          width: 15px;
          height: 15px;
        }
        .ratio-4-5 {
          width: 14px;
          height: 17px;
        }
        .ratio-16-9 {
          width: 19px;
          height: 12px;
        }
        .ratio-9-16 {
          width: 11px;
          height: 18px;
        }
        .model-label {
          margin-top: 27px;
        }
        .model-label small {
          background: #eff6d8;
          color: #87a23c;
          padding: 3px 5px;
          font-size: 8px;
          margin-left: 4px;
        }
        .model {
          width: 100%;
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 3px;
          display: flex;
          align-items: center;
          text-align: left;
          padding: 9px;
          gap: 10px;
          color: var(--ink);
        }
        .model > i {
          width: 25px;
          height: 25px;
          border-radius: 50%;
          background: linear-gradient(135deg, #d9ef75, #49653c);
        }
        .model select {
          min-width: 0;
          flex: 1;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--ink);
          font-size: 11px;
        }
        .model span b,
        .model span small {
          display: block;
        }
        .model span b {
          font-size: 11px;
        }
        .model span small {
          color: #99a39b;
          font-size: 10px;
          margin-top: 3px;
        }
        .model strong {
          margin-left: auto;
          color: #8d978f;
        }
        .primary {
          display: flex;
          justify-content: space-between;
          width: 100%;
          border: 0;
          border-radius: 3px;
          background: var(--ink);
          color: #fff;
          padding: 15px 16px;
          margin-top: 28px;
          font-size: 12px;
        }
        .primary b {
          color: var(--lime);
          font-size: 18px;
        }
        .note {
          text-align: center;
          color: #a2aba4;
          font-size: 10px;
          margin: 12px 0 0;
        }
        .note b {
          color: #71832d;
        }
        .preview {
          padding: 13px;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .preview header,
        .preview footer {
          height: 34px;
          color: #99a49c;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 9px;
          letter-spacing: 0.13em;
        }
        .preview header span,
        .preview footer span {
          letter-spacing: 0;
          font-size: 10px;
        }
        .preview header mark {
          background: #eff6d8;
          color: #87a23c;
          padding: 3px 5px;
          font-size: 8px;
          margin-left: 5px;
        }
        .canvas {
          position: relative;
          overflow: hidden;
          flex: 1;
          min-height: 0;
          border-radius: 0;
          background: transparent;
        }
        .preview:has(.generated-canvas) {
          padding: 0;
        }
        .generated-canvas {
          min-height: 0;
          flex: none;
          width: 100%;
          border-radius: 0;
          background: transparent;
        }
        .generated-canvas + footer,
        .generated-canvas ~ .download-button {
          margin-left: 13px;
          margin-right: 13px;
        }
        .caption {
          position: absolute;
          left: 22px;
          bottom: 20px;
          color: white;
          text-shadow: 0 1px 10px #20372e;
        }
        .caption b,
        .caption small {
          display: block;
        }
        .caption b {
          font-size: 14px;
        }
        .caption small {
          font-size: 10px;
          opacity: 0.75;
          margin-top: 6px;
        }
        .art {
          position: absolute;
          inset: 0;
          overflow: hidden;
          background: linear-gradient(
            155deg,
            #cddfae 0%,
            #f2c88a 42%,
            #62817a 43%,
            #234d51 100%
          );
        }
        .art-before {
          background: linear-gradient(
            155deg,
            #c7ccb9 0%,
            #c9a985 40%,
            #6c7772 41%,
            #344747 100%
          );
        }
        .art-fresh {
          background: linear-gradient(
            155deg,
            #b4d3c1,
            #efb778 43%,
            #537d74 44%,
            #173f46
          );
        }
        .art-cobalt {
          background: linear-gradient(
            155deg,
            #a4cad8,
            #c5a982 42%,
            #456d83 43%,
            #253e59
          );
        }
        .art-noir {
          filter: grayscale(1);
        }
        .art-saffron {
          background: linear-gradient(
            155deg,
            #ede5b3,
            #e3a467 43%,
            #9b6a45 44%,
            #4b4037
          );
        }
        .art-violet {
          background: linear-gradient(
            155deg,
            #c5c4df,
            #d9a899 42%,
            #665e8c 43%,
            #302c56
          );
        }
        .sun {
          position: absolute;
          width: 32%;
          aspect-ratio: 1;
          top: 15%;
          right: 19%;
          border-radius: 50%;
          background: #ffe5a9;
          box-shadow: 0 0 55px 22px #ffd78b8c;
        }
        .mountain {
          position: absolute;
          bottom: 13%;
          width: 95%;
          height: 53%;
          clip-path: polygon(0 100%, 32% 35%, 44% 55%, 65% 12%, 100% 100%);
        }
        .far {
          right: -12%;
          background: #527474;
          opacity: 0.78;
        }
        .near {
          left: -14%;
          background: #254f53;
          height: 50%;
        }
        .haze {
          position: absolute;
          bottom: 0;
          height: 38%;
          width: 100%;
          background: linear-gradient(0deg, #0c2f31ad, transparent);
        }
        .person {
          position: absolute;
          bottom: 18%;
          left: 43%;
          width: 18%;
          height: 48%;
        }
        .person:before {
          content: "";
          display: block;
          width: 29%;
          aspect-ratio: 1;
          margin: auto;
          background: #252d2b;
          border-radius: 50%;
        }
        .person b {
          display: block;
          width: 100%;
          height: 68%;
          margin-top: 5px;
          background: #252d2b;
          border-radius: 48% 48% 8% 8%;
          clip-path: polygon(34% 0, 66% 0, 100% 100%, 0 100%);
        }
        .upload {
          border: 1px dashed #cbd5c4;
          background: #fbfcf9;
          min-height: 180px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #99a39c;
        }
        .upload > b {
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          border: 1px solid #bfd180;
          border-radius: 50%;
          font-size: 20px;
          color: #9eb650;
        }
        .upload strong {
          color: #69756d;
          font-size: 12px;
          margin: 10px 0 5px;
        }
        .upload span {
          font-size: 10px;
        }
        .upload button {
          margin-top: 15px;
          border: 1px solid var(--line);
          background: #fff;
          color: #5c6b62;
          font-size: 10px;
          padding: 8px 13px;
          border-radius: 3px;
        }
        .slider {
          display: block;
          margin: 22px 0;
          color: #707b73;
          font-size: 11px;
        }
        .slider > span {
          display: flex;
          justify-content: space-between;
        }
        .slider output {
          font:
            11px var(--font-geist-mono),
            monospace;
        }
        .slider input {
          width: 100%;
          margin-top: 13px;
          accent-color: #a5bd4d;
        }
        .compare {
          position: relative;
          width: 100%;
          overflow: hidden;
          line-height: 0;
          background: transparent;
        }
        .before {
          position: absolute;
          inset: 0;
          overflow: hidden;
          z-index: 2;
        }
        .before .compare-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .compare-handle {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background: white;
          box-shadow: 0 0 5px #34483b;
          z-index: 3;
        }
        .compare-handle b {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: grid;
          place-items: center;
          width: 27px;
          height: 27px;
          border-radius: 50%;
          background: white;
          color: #647269;
        }
        .before-label,
        .after-label {
          position: absolute;
          top: 18px;
          color: white;
          font-size: 9px;
          letter-spacing: 0.14em;
          text-shadow: 0 1px 5px #32443c;
        }
        .before-label {
          left: 18px;
        }
        .after-label {
          right: 18px;
        }
        .compare-range {
          width: calc(100% - 16px);
          margin: 15px 8px 2px;
          accent-color: #9db445;
        }
        .enhancer-model {
          width: 100%;
          border: 1px solid var(--line);
          border-radius: 3px;
          background: #fff;
          color: var(--ink);
          padding: 10px 11px;
          font-size: 11px;
        }
        .preset-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px;
        }
        .preset {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid transparent;
          background: #fafbf9;
          color: #758078;
          padding: 7px;
          font-size: 10px;
          text-align: left;
          border-radius: 3px;
        }
        .preset.chosen {
          border-color: #bdcd86;
          background: #f3f7e9;
          color: var(--ink);
        }
        .preset i {
          width: 27px;
          height: 27px;
          border-radius: 2px;
        }
        .preset b {
          margin-left: auto;
          color: #8da63d;
        }
        .editor-ratios {
          grid-template-columns: repeat(3, 1fr);
        }
        .export-menu {
          position: absolute;
          z-index: 3;
          left: 28px;
          right: 28px;
          bottom: 82px;
          padding: 10px;
          border: 1px solid var(--line);
          background: #fff;
          box-shadow: 0 10px 30px #18211e1f;
        }
        .export-menu strong {
          display: block;
          padding: 4px 7px 8px;
          font-size: 10px;
        }
        .export-menu button {
          display: flex;
          justify-content: space-between;
          width: 100%;
          border: 0;
          border-top: 1px solid #eef0ec;
          background: #fff;
          padding: 9px 7px;
          text-align: left;
          font-size: 11px;
        }
        .export-menu span {
          color: #9ba49e;
          font-size: 9px;
        }
        .badge {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #76827a;
        }
        .badge .mark {
          transform: scale(0.7);
          transform-origin: right center;
        }
        .file-input {
          display: none;
        }
        .uploaded-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 2;
        }
        @media (max-width: 800px) {
          .topbar {
            grid-template-columns: 1fr auto;
            padding: 0 5vw;
          }
          .topbar nav {
            grid-column: 1/-1;
            grid-row: 2;
            height: 48px;
            justify-content: space-between;
          }
          .topbar nav button {
            padding: 12px 7px 14px;
          }
          .account {
            font-size: 0;
          }
          .page {
            padding-top: 38px;
          }
          .heading {
            align-items: start;
            flex-direction: column;
            gap: 15px;
          }
          .layout {
            grid-template-columns: 1fr;
          }
          .controls {
            padding: 22px;
          }
          .canvas {
            min-height: 390px;
          }
        }
        @media (max-width: 430px) {
          .topbar nav button {
            font-size: 11px;
            padding-left: 2px;
            padding-right: 2px;
          }
          .heading h1 {
            font-size: 34px;
          }
          .canvas {
            min-height: 330px;
          }
        }
      `}</style>
      <style jsx global>{`
        .preview:has(.compare) {
          padding: 0;
        }
      `}</style>
      <style jsx global>{`
        .credit-badge {
          padding: 7px 10px;
          border: 1px solid #dfe5df;
          border-radius: 999px;
          background: #f3f8e5;
          color: #71852f;
          font-size: 11px;
        }
        .auth-button {
          border: 1px solid #dfe5df;
          border-radius: 3px;
          background: #fff;
          color: #536159;
          padding: 8px 12px;
          font-size: 11px;
        }
        .auth-primary {
          background: #18211e;
          color: #fff;
          border-color: #18211e;
        }
        .history-panel {
          border: 1px solid var(--line);
          border-radius: 5px;
          background: #fff;
          padding: 28px;
          min-height: 420px;
        }
        .history-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: end;
          margin-bottom: 24px;
        }
        .history-toolbar small {
          color: #99a39b;
          font-size: 10px;
          letter-spacing: 0.14em;
        }
        .history-toolbar h2 {
          margin: 10px 0 0;
          font-size: 24px;
          font-weight: 500;
          letter-spacing: -0.05em;
        }
        .clear-history {
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 3px;
          padding: 9px 12px;
          color: #68756c;
          font-size: 11px;
        }
        .history-alert {
          border: 1px solid #efd5bd;
          background: #fff8f0;
          color: #925c32;
          padding: 16px;
          font-size: 13px;
        }
        .history-empty {
          display: grid;
          min-height: 270px;
          place-items: center;
          border: 1px dashed #cbd5c4;
          color: #89958d;
          font-size: 12px;
        }
        .history-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
          gap: 14px;
        }
        .history-card {
          overflow: hidden;
          border: 1px solid var(--line);
          border-radius: 4px;
          background: #fbfcfa;
        }
        .history-card > img {
          display: block;
          width: 100%;
          height: 190px;
          object-fit: contain;
          background: #eef2ed;
        }
        .history-card > div {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 13px;
        }
        .history-card strong {
          font-size: 12px;
        }
        .history-card small,
        .history-card time {
          color: #89958d;
          font-size: 10px;
        }
        .history-download {
          display: block;
          margin-top: 5px;
          border-radius: 3px;
          background: var(--ink);
          color: #fff;
          padding: 9px;
          text-align: center;
          text-decoration: none;
          font-size: 11px;
        }
        .modal-backdrop {
          position: fixed;
          z-index: 20;
          inset: 0;
          display: grid;
          place-items: center;
          background: #18211e80;
          padding: 20px;
        }
        .auth-modal {
          position: relative;
          width: min(410px, 100%);
          padding: 30px;
          border-radius: 5px;
          background: #fff;
          box-shadow: 0 22px 70px #18211e33;
        }
        .modal-close {
          position: absolute;
          top: 12px;
          right: 12px;
          border: 0;
          background: none;
          color: #78857c;
          font-size: 22px;
        }
        .modal-kicker {
          color: #93aa43;
          font-size: 10px;
          letter-spacing: 0.15em;
        }
        .auth-modal h2 {
          margin: 12px 0 8px;
          font-size: 25px;
          letter-spacing: -0.05em;
          font-weight: 500;
        }
        .auth-modal p {
          color: #77837b;
          font-size: 13px;
          line-height: 1.5;
        }
        .modal-actions {
          display: flex;
          gap: 8px;
          margin-top: 22px;
        }
        .modal-actions > * {
          flex: 1;
        }
        .modal-actions .primary {
          margin-top: 0;
        }
        @media (max-width: 800px) {
          .history-toolbar {
            align-items: start;
            gap: 14px;
            flex-direction: column;
          }
          .history-panel {
            padding: 20px;
          }
        }
      `}</style>
      <style jsx global>{`
        .credit-badge {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          border: 1px solid #dfe5df;
          border-radius: 999px;
          background: #f3f8e5;
          color: #71852f;
          padding: 7px 10px;
          font-size: 11px;
        }
        .credit-badge span {
          color: #65734f;
          font-size: 9px;
        }
        .pricing-modal {
          position: relative;
          width: min(1000px, 100%);
          max-height: 90vh;
          overflow: auto;
          border: 1px solid #3a463e;
          border-radius: 8px;
          background: #151c19;
          color: #edf3ec;
          padding: 34px;
          box-shadow: 0 28px 90px #0009;
        }
        .pricing-modal h2 {
          margin: 12px 0 8px;
          font-size: 34px;
          letter-spacing: -0.06em;
          font-weight: 500;
        }
        .pricing-subtitle {
          margin: 0 0 26px;
          color: #a7b5aa;
          font-size: 13px;
        }
        .plan-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        .plan-card {
          position: relative;
          display: flex;
          min-height: 315px;
          flex-direction: column;
          padding: 22px;
          border: 1px solid #344139;
          border-radius: 6px;
          background: #1c2620;
        }
        .plan-featured {
          border-color: #c8e75f;
          box-shadow: 0 0 0 1px #c8e75f40;
        }
        .plan-badge {
          align-self: flex-start;
          border-radius: 999px;
          background: #2b382d;
          color: #cde968;
          padding: 5px 8px;
          font-size: 9px;
          letter-spacing: 0.06em;
        }
        .plan-card h3 {
          margin: 22px 0 14px;
          font-size: 17px;
          font-weight: 500;
        }
        .plan-price {
          font-size: 29px;
          letter-spacing: -0.05em;
        }
        .plan-credit-count {
          margin-top: 3px;
          color: #a7b5aa;
          font-size: 11px;
        }
        .plan-card ul {
          display: grid;
          gap: 10px;
          margin: 24px 0;
          padding: 0;
          list-style: none;
          color: #b9c5bb;
          font-size: 11px;
        }
        .plan-card li::first-letter {
          color: #d8ef70;
        }
        .plan-button {
          width: 100%;
          margin-top: auto;
          border: 0;
          border-radius: 3px;
          background: #d8ef70;
          color: #18211e;
          padding: 12px;
          font-size: 11px;
          font-weight: 650;
        }
        .plan-button:hover {
          background: #e7fb92;
        }
        .success-toast {
          position: fixed;
          z-index: 30;
          right: 24px;
          bottom: 24px;
          border: 1px solid #b9d650;
          border-radius: 4px;
          background: #18211e;
          color: #e4f48f;
          padding: 13px 16px;
          box-shadow: 0 12px 30px #18211e33;
          font-size: 12px;
        }
        .pricing-close {
          color: #d7e5d8;
        }
        @media (max-width: 800px) {
          .pricing-modal {
            padding: 24px;
          }
          .plan-grid {
            grid-template-columns: 1fr;
          }
          .pricing-modal h2 {
            font-size: 28px;
          }
          .success-toast {
            right: 16px;
            bottom: 16px;
            left: 16px;
          }
        }
      `}</style>
    </main>
  );
}
