import { GoogleGenAI, Type } from "@google/genai";
import { AIAssessment } from "./types";

export async function analyzeTattooRequest(
  description: string,
  size: string,
  zone: string,
  style: string,
  imageBase64?: string
): Promise<AIAssessment> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY! });

    let imageParts: any[] = [];
    if (imageBase64) {
      const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        imageParts = [{
          inlineData: {
            data: matches[2],
            mimeType: matches[1]
          }
        }];
      } else {
        imageParts = [{
          inlineData: {
            data: imageBase64,
            mimeType: "image/jpeg"
          }
        }];
      }
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              text: `Eres un asistente experto para un estudio de tatuajes. Analiza la siguiente solicitud de tatuaje y proporciona una estimación técnica.
              
              Descripción: ${description}
              Tamaño: ${size}
              Zona del cuerpo: ${zone}
              Estilo solicitado: ${style}
              
              Tabulador de precios de referencia:
              - Linework simple: $80-150/hr
              - Blackwork: $120-200/hr
              - Realismo: $150-300/hr
              - Piezas grandes (mangas): Paquetes fijos (estima horas totales).
              
              Devuelve un JSON con:
              - complexity: "Baja", "Media" o "Alta"
              - estimated_hours: número de horas
              - price_range: string (ej: "$300 - $450")
              - recommended_price: número (ej: 380)
              - notes: breve explicación técnica
              - style_detected: el estilo que detectas (ej: "Blackwork", "Minimalista")`
            },
            ...imageParts
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            complexity: { type: Type.STRING },
            estimated_hours: { type: Type.NUMBER },
            price_range: { type: Type.STRING },
            recommended_price: { type: Type.NUMBER },
            notes: { type: Type.STRING },
            style_detected: { type: Type.STRING }
          },
          required: ["complexity", "estimated_hours", "price_range", "recommended_price", "notes", "style_detected"]
        }
      }
    });

    const text = response.text || '{}';
    return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
  } catch (error: any) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}
