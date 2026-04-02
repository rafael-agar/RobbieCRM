import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Detectar si es un Webhook de Supabase o una llamada manual
    // Supabase envía: { type: 'INSERT'|'UPDATE', record: { ... }, ... }
    // Manual envía: { clientId: '...', type: '...' }
    
    let clientId = body.clientId;
    let emailType = body.type;
    let customPrice = body.customPrice;

    if (body.record && body.record.id) {
      clientId = body.record.id;
      // Lógica automática: si el estado cambia a 'payment_pending', enviar cotización
      if (body.record.status === 'payment_pending') {
        emailType = 'quote';
      } else if (body.type === 'INSERT') {
        emailType = 'welcome';
      } else {
        return NextResponse.json({ message: 'No action needed for this webhook event' });
      }
    }

    if (!clientId || !emailType) {
      return NextResponse.json({ error: 'Missing clientId or emailType' }, { status: 400 });
    }

    // 1. Obtener datos del cliente
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    let subject = '';
    let html = '';

    // 2. Definir plantillas según el tipo
    switch (emailType) {
      case 'quote':
        subject = `🎨 Cotización de tu Tatuaje - Robby Flow`;
        html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; padding: 20px;">
            <h1 style="color: #000;">¡Hola ${client.nombre}!</h1>
            <p>Robby ha revisado tu solicitud para el tatuaje en <strong>${client.zona}</strong>.</p>
            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h2 style="margin-top: 0;">Detalles de la Cotización</h2>
              <p><strong>Precio Final:</strong> $${customPrice || client.price_artist || client.ai_suggested_price}</p>
              <p><strong>Duración Estimada:</strong> ${client.appointment_duration || client.ai_estimated_time} horas</p>
            </div>
            <p>Para confirmar tu cita, por favor revisa y acepta la cotización.</p>
            <a href="${process.env.APP_URL}/pago/${client.id}" style="display: inline-block; background: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ver y Aceptar Cotización</a>
            <p style="margin-top: 30px; font-size: 12px; color: #888;">Si tienes dudas, puedes responder a este email o contactarnos por Instagram.</p>
          </div>
        `;
        break;

      case 'welcome':
        subject = `🔥 ¡Recibimos tu idea! - Robby Flow`;
        html = `<h1>¡Hola ${client.nombre}!</h1><p>Gracias por enviarnos tu idea para un tatuaje. Robby la está revisando y pronto recibirás una cotización.</p>`;
        break;

      case 'confirmation':
        subject = `✅ ¡Reserva Confirmada! - Robby Flow`;
        html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; padding: 20px;">
            <h1 style="color: #000;">¡Hola ${client.nombre}!</h1>
            <p>Hemos recibido tus datos de pago correctamente. Tu reserva está en proceso de revisión.</p>
            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h2 style="margin-top: 0;">Resumen de tu Reserva</h2>
              <p><strong>Idea:</strong> ${client.idea_tatuaje}</p>
              <p><strong>Zona:</strong> ${client.zona}</p>
              <p><strong>Precio Total:</strong> $${client.price_artist || client.ai_suggested_price}</p>
              <p><strong>Seña Registrada:</strong> $${client.deposit_amount || 100}</p>
              <p><strong>Referencia de Pago:</strong> ${client.payment_reference || 'N/A'}</p>
            </div>
            <p>Robby revisará el pago. Mientras tanto, ya puedes elegir la fecha y hora para tu sesión:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_URL}/agendar/${client.id}" style="display: inline-block; background: #000; color: #fff; padding: 15px 30px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px;">📅 Agendar mi Cita</a>
            </div>
            <p style="margin-top: 30px; font-size: 12px; color: #888;">Si tienes dudas, puedes responder a este email o contactarnos por Instagram.</p>
          </div>
        `;
        break;

      case 'scheduling':
        subject = `📅 ¡Agenda tu sesión de tatuaje! - Robby Flow`;
        html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; padding: 20px;">
            <h1 style="color: #000;">¡Buenas noticias, ${client.nombre}!</h1>
            <p>Tu pago ha sido confirmado. Ahora es momento de elegir la fecha y hora para tu tatuaje.</p>
            <div style="background: #f9f9f9; padding: 20px; border-radius: 12px; margin: 25px 0; text-align: center;">
              <h2 style="margin-top: 0; color: #000;">Reserva tu Cita</h2>
              <p style="color: #666; margin-bottom: 20px;">Haz clic en el botón de abajo para ver la disponibilidad de Robby y agendar tu sesión.</p>
              <a href="${process.env.APP_URL}/agendar/${client.id}" style="display: inline-block; background: #000; color: #fff; padding: 15px 30px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px;">📅 Agendar mi Cita</a>
            </div>
            <p style="color: #666;">Recuerda que la sesión durará aproximadamente <strong>${client.appointment_duration || client.ai_estimated_time} horas</strong>.</p>
            <p style="margin-top: 30px; font-size: 12px; color: #888;">Si tienes problemas para agendar, contáctanos por Instagram.</p>
          </div>
        `;
        break;

      case 'appointment_confirmed':
        const dateObj = new Date(client.appointment_date + 'T00:00:00');
        const formattedDate = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        const calendarLink = `https://www.google.com/calendar/render?action=TEMPLATE&text=Tatuaje+con+Robby+Flow&dates=${client.appointment_date?.replace(/-/g, '')}T${client.appointment_time?.replace(':', '')}00/${client.appointment_date?.replace(/-/g, '')}T${Math.min(23, parseInt(client.appointment_time?.split(':')[0] || '0') + Number(client.appointment_duration || 2)).toString().padStart(2, '0')}${client.appointment_time?.split(':')[1] || '00'}00&details=Sesión+de+tatuaje+agendada+con+Robby+Flow.+Idea:+${encodeURIComponent(client.idea_tatuaje)}&location=Robby+Flow+Studio&sf=true&output=xml`;

        subject = `✅ ¡Cita Confirmada! - Robby Flow`;
        html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; padding: 20px;">
            <h1 style="color: #000;">¡Cita Confirmada!</h1>
            <p>Tu sesión de tatuaje ha sido agendada. Recibirás un recordatorio por email antes de la cita.</p>
            <div style="background: #f9f9f9; padding: 20px; border-radius: 12px; margin: 25px 0;">
              <p style="margin: 5px 0; font-size: 16px;"><strong>Fecha confirmada:</strong> <span style="text-transform: capitalize;">${formattedDate}</span></p>
              <p style="margin: 5px 0; font-size: 16px;"><strong>Hora confirmada:</strong> ${client.appointment_time} hs</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${calendarLink}" style="display: inline-block; background: #4285F4; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">📅 Añadir a mi Google Calendar</a>
            </div>
            <p style="margin-top: 30px; font-size: 14px; color: #666;">Si necesitas reprogramar, por favor contacta a Robby directamente.</p>
          </div>
        `;
        break;

      case 'followup':
        subject = '¿Sigues interesado en tu tatuaje? 🎨';
        html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; padding: 20px;">
            <h2 style="color: #000;">¡Hola ${client.nombre}! Robby por aquí 🎨</h2>
            <p>Hace unos días te enviamos la cotización para tu tatuaje de <strong>${client.idea_tatuaje}</strong>.</p>
            <p>Solo quería pasar a saludarte y ver si tenías alguna duda sobre el diseño, el precio o el proceso.</p>
            <p>Si todavía estás interesado, ¡avísame! Me encantaría que hiciéramos este proyecto realidad.</p>
            <div style="margin-top: 30px; padding: 20px; background-color: #f9f9f9; border-radius: 10px;">
              <p style="margin: 0; font-weight: bold;">Detalles del proyecto:</p>
              <p style="margin: 5px 0;">Zona: ${client.zona}</p>
              <p style="margin: 5px 0;">Tamaño: ${client.tamano_cm} cm</p>
            </div>
            <p style="margin-top: 30px;">Puedes responder a este correo o contactarnos por Instagram si prefieres.</p>
            <p style="margin-top: 30px; font-size: 12px; color: #888;">¡Espero que tengas un gran día!</p>
          </div>
        `;
        break;

      default:
        return NextResponse.json({ error: 'Tipo de email no válido' }, { status: 400 });
    }

    // 3. Enviar con Resend
    const { data, error } = await resend.emails.send({
      from: 'Robby Flow <onboarding@resend.dev>',
      to: [client.email],
      subject: subject,
      html: html,
    });

    if (error) {
      // Manejar el error de dominio no verificado de Resend
      if (error.message?.includes('To send emails to other recipients')) {
        return NextResponse.json({ 
          error: 'RESTRICTED_RECIPIENT',
          message: `Resend está en modo prueba. Solo puedes enviar emails a i.t.rafaelagar@gmail.com. Para enviar a ${client.email}, debes verificar tu dominio en resend.com.`,
          emailPreview: html
        }, { status: 403 });
      }
      throw error;
    }

    // 4. Registrar en la tabla de mensajes
    const contentMap: Record<string, string> = {
      welcome: 'Email de bienvenida enviado automáticamente al recibir el lead.',
      quote: `Cotización enviada por un monto de $${customPrice || client.price_artist || client.ai_suggested_price || '0'}.`,
      confirmation: 'Email de confirmación de pago recibido enviado.',
      scheduling: 'Email con link de agendamiento enviado al cliente.',
      followup: 'Email de seguimiento (Follow-up) enviado automáticamente.',
    };

    await supabase.from('messages').insert({
      client_id: clientId,
      message_type: emailType,
      channel: 'Email',
      content: contentMap[emailType] || `Email de ${emailType} enviado exitosamente.`,
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
