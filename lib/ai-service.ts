import { AIAssessment } from "./types";

export async function analyzeTattooRequest(
  description: string,
  size: string,
  zone: string,
  style: string,
  imageBase64?: string
): Promise<AIAssessment> {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description,
        size,
        zone,
        style,
        imageBase64
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error en el servidor de análisis');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error calling analyze API:', error);
    throw error;
  }
}
