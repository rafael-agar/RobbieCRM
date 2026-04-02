export async function sendEmail(clientId: string, type: 'quote' | 'welcome' | 'confirmation' | 'scheduling' | 'followup', customPrice?: number) {
  try {
    const response = await fetch('/api/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clientId, type, customPrice }),
    });

    // Intentar parsear como JSON, si falla, lanzar error con el texto
    let data;
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('Respuesta no-JSON del servidor:', text);
      throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
    }

    if (!response.ok) {
      // Si es el error de Resend de dominio no verificado, lo lanzamos con un mensaje específico
      if (data.error === 'RESTRICTED_RECIPIENT') {
        throw new Error('RESTRICTED_RECIPIENT');
      }
      throw new Error(data.error || data.message || 'Error al enviar el email');
    }
    
    return data;
  } catch (error) {
    console.error('Email service error:', error);
    throw error;
  }
}
