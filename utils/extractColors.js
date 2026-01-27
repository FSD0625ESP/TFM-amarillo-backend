import sharp from "sharp";

export async function extractColors(imageBuffer, colorCount = 1) {
  try {
    const resizedBuffer = await sharp(imageBuffer)
      .resize(100, 100, { fit: "cover" })
      .raw()
      .toBuffer();

    const pixelCount = resizedBuffer.length / 3;
    const sampleSize = Math.min(1000, pixelCount);
    const step = Math.max(1, Math.floor(pixelCount / sampleSize));

    const colorMap = new Map();

    for (let i = 0; i < resizedBuffer.length; i += step * 3) {
      if (i + 2 < resizedBuffer.length) {
        const r = resizedBuffer[i];
        const g = resizedBuffer[i + 1];
        const b = resizedBuffer[i + 2];

        const qR = Math.floor(r / 32) * 32;
        const qG = Math.floor(g / 32) * 32;
        const qB = Math.floor(b / 32) * 32;

        const colorKey = `${qR},${qG},${qB}`;
        colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
      }
    }

    const sortedColors = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, colorCount)
      .map(([colorKey]) => colorKey.split(",").map(Number));

    return sortedColors.length > 0 ? sortedColors : [[128, 128, 128]];
  } catch (error) {
    console.error("Color extraction error:", error);
    return [[128, 128, 128]];
  }
}
