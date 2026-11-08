export async function shrinkPhoto(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob)
  try {
    return await jpegDataUrl(bitmap, 1280, 0.7)
  } finally {
    bitmap.close()
  }
}

async function jpegDataUrl(bitmap: ImageBitmap, maxEdge: number, quality: number): Promise<string> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext("2d")
  if (!context) throw new Error("The picture could not be prepared.")
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const next = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
  if (!next) throw new Error("The picture could not be prepared.")
  if (next.size > 1_200_000 && quality > 0.45) return jpegDataUrl(bitmap, Math.round(maxEdge * 0.75), quality - 0.15)
  return blobToDataUrl(next)
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("The picture could not be prepared."))
    reader.readAsDataURL(blob)
  })
}
