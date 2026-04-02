import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from 'next/server';

// Usamos la clave proporcionada por el usuario
const apiKey = "AIzaSyApNwc6MxIDlKbCbhyNXNK5WYKmC0lyVe0";

export async function POST(req: Request) {
  try {
    const { description, size, zone, style, imageBase64 } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY no configurada en el servidor' }, { status: 500 });
    }

    // Preparar el contenido de la imagen si existe
    let imageParts: any[] = [];
    if (imageBase64) {
      try {
        // Extraer el tipo MIME y los datos base64 limpios
        // Formato esperado: "data:image/jpeg;base64,/9j/4AAQ..."
        const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const data = matches[2];
          
          imageParts = [{
            inlineData: {
              data: data,
              mimeType: mimeType
            }
          }];
        } else {
          // Fallback si no tiene el prefijo data:
          imageParts = [{
            inlineData: {
              data: imageBase64,
              mimeType: "image/jpeg" // Asumimos jpeg por defecto
            }
          }];
        }
      } catch (e) {
        console.error("Error procesando imagen para Gemini:", e);
        // Continuamos sin imagen si falla el procesamiento
      }
    }

    const genAI = new GoogleGenAI({ apiKey });
    
    let response;
    let retries = 3;
    
    for (let i = 0; i < retries; i++) {
      try {
        const model = genAI.models.generateContent({
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
                complexity: { type: Type.STRING, enum: ["Baja", "Media", "Alta"] },
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

        response = await model;
        break; // Si tiene éxito, salimos del bucle
      } catch (e: any) {
        const errMsg = e.message || '';
        // Si es un error de saturación (503), reintentamos
        if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE')) {
          if (i === retries - 1) throw e; // Si es el último intento, lanzamos el error
          console.warn(`Gemini saturado (503). Reintentando en ${1000 * (i + 1)}ms...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Esperar 1s, luego 2s...
        } else {
          throw e; // Si es otro error (ej. API Key inválida), no reintentamos
        }
      }
    }

    if (!response) {
      throw new Error('No se pudo obtener respuesta de la IA después de varios intentos.');
    }

    let text = response.text || '{}';
    
    // Limpiar formato markdown si Gemini lo incluye por error
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const result = JSON.parse(text);
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error en API de análisis:', error);
    return NextResponse.json({ error: error.message || 'Error desconocido en Gemini' }, { status: 500 });
  }
}
