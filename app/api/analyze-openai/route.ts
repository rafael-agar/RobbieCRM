import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { description, size, zone, style, imageBase64 } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY no configurada en el servidor' }, { status: 500 });
    }

    const messages: any[] = [
      {
        role: "system",
        content: `Eres un asistente experto para un estudio de tatuajes. Analiza la siguiente solicitud de tatuaje y proporciona una estimación técnica.
        
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
      }
    ];

    if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "Aquí está la imagen de referencia." },
          { type: "image_url", image_url: { url: imageBase64 } }
        ]
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error en API de análisis con OpenAI:', error);
    return NextResponse.json({ error: error.message || 'Error desconocido en OpenAI' }, { status: 500 });
  }
}
