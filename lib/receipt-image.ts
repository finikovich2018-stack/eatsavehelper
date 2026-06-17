type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

export function parseImageDataUrl(image: string): { mediaType: ImageMediaType; base64Data: string } {
  const match = image.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/i);
  if (match) {
    return {
      mediaType: match[1].toLowerCase() as ImageMediaType,
      base64Data: match[2],
    };
  }

  return {
    mediaType: 'image/jpeg',
    base64Data: image.includes(',') ? image.split(',')[1] : image,
  };
}

export function buildVisionMessage(base64Data: string, mediaType: ImageMediaType, prompt: string) {
  return {
    role: 'user' as const,
    content: [
      {
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: mediaType, data: base64Data },
      },
      { type: 'text' as const, text: prompt },
    ],
  };
}

export type { ImageMediaType };
