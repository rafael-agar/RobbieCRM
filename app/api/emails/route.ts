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

    // 1.1 Obtener la cotización más reciente
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const activeQuote = quote || {};

    let subject = '';
    let html = '';

    // 2. Definir plantillas según el tipo
    const baseUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const currency = activeQuote.currency || client.currency || 'USD';
    const currencySymbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
    
    switch (emailType) {
      case 'quote':
        subject = `🎨 Cotización de tu Tatuaje - Robby Flow`;
        html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; padding: 20px;">
            <h1 style="color: #000;">¡Hola ${client.nombre}!</h1>
            <p>Robby ha revisado tu solicitud para el tatuaje en <strong>${client.zona}</strong>.</p>
            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h2 style="margin-top: 0;">Detalles de la Cotización</h2>
              <p><strong>Precio Final:</strong> ${currencySymbol} ${customPrice || activeQuote.price_artist || activeQuote.ai_suggested_price || 0}</p>
              <p><strong>Sesiones Estimadas:</strong> ${activeQuote.total_sessions || 1}</p>
              <p><strong>Duración Estimada:</strong> ${client.appointment_duration || activeQuote.ai_estimated_time || 0} horas por sesión</p>
              ${activeQuote.ai_notes ? `<p style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; font-style: italic; color: #555;"><strong>Notas del Artista:</strong> "${activeQuote.ai_notes}"</p>` : ''}
            </div>
            <p>Para confirmar tu cita, por favor revisa y acepta la cotización.</p>
            <a href="${baseUrl}/pago/${client.id}" style="display: inline-block; background: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ver y Aceptar Cotización</a>
            
            <div style="margin-top: 30px; font-size: 14px; color: #333; line-height: 1.6;">
              <p>Please note that this may vary if any changes are made on the day of the session, such as adjusting the size or adding more elements. I always encourage creative flexibility so I can adapt your ideas to your skin in the best way possible, both aesthetically and technically.</p>
              <p>Keep in mind that I normally create the design together with you in person on the day of your appointment. That way we can properly discuss everything and adjust any details before we start tattooing.</p>
              <p>I honestly believe this is the best way to work, and I’m confident you’ll be really happy with the final result. On the day of the appointment, we’ll have a full day dedicated to designing and tattooing your piece.</p>
              <p>I'm really excited about this project and can’t wait to bring your idea to life!</p>
              <p>Let me know if you’d like to move forward, and I’ll send you the details for making the deposit and setting the dates.</p>
              <p>Best,<br>Robbie</p>
              <p style="font-size: 12px; color: #888; margin-top: 20px;">Copyright © 2026 Robbieflaviani, All rights reserved.</p>
            </div>
            
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
            <p>Thanks for your interest in booking an appointment, here’s how it works:</p>
            <p>To secure your spot, a small deposit is required, which will be deducted from the total price.</p>
            <p>To book your appointment please enter here, select your date and pay the deposit.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/agendar/${client.id}" style="display: inline-block; background: #000; color: #fff; padding: 15px 30px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px;">📅 Agendar mi Cita</a>
            </div>
            <p>Keep in mind that the design will be prepared on the day of your appointment and created together with you in person. This allows us to carefully go through every detail and refine the piece before we start tattooing, ensuring the final design is perfectly tailored to you.</p>
            <p>I honestly believe this is the best way to work, and I’m confident you’ll be really happy with the final result. On the day of the appointment, we’ll have a full day dedicated to designing and tattooing your piece.</p>
            
            <h3>What to Expect:</h3>
            <p><strong>Day of the tattoo Session</strong> – The session will start at the selected time, we recommend keeping your schedule flexible for the day.</p>
            
            <h3>Before Your Appointment:</h3>
            <ul>
              <li>Avoid energy drinks or excessive coffee, as they can affect your nervous system and make it harder to relax during the session.</li>
              <li>Bring some food, preferably something salty like sandwiches, to keep your energy levels stable.</li>
              <li>Avoid shaving the tattoo area yourself—I will shave the area on the day of the appointment to ensure proper preparation.</li>
            </ul>
            
            <h3>On the Day of Your Tattoo Session:</h3>
            <ul>
              <li>Wear comfortable clothing that allows easy access to the tattoo area. Loose, relaxed clothing is recommended.</li>
              <li>Wear dark or old clothes (preferably black) that you don’t mind getting stained with ink. Ink can sometimes spill, especially in large tattoos, and it may not come out of light-colored fabrics.</li>
              <li>Robbie will provide you with a complimentary healing cream to help with the aftercare process.</li>
            </ul>
            
            <p>Our studio, Nest of Thorns, is located at:</p>
            <p>📍 200 Bath St, Glasgow G2 4HG</p>
            
            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h2 style="margin-top: 0;">Resumen de tu Reserva</h2>
              <p><strong>Idea:</strong> ${client.idea_tatuaje}</p>
              <p><strong>Zona:</strong> ${client.zona}</p>
              <p><strong>Sesiones:</strong> ${activeQuote.total_sessions || 1}</p>
              <p><strong>Precio Total:</strong> ${currencySymbol} ${activeQuote.price_artist || activeQuote.ai_suggested_price || 0}</p>
              <p><strong>Seña Registrada:</strong> ${currencySymbol} ${client.deposit_amount || 100}</p>
              <p><strong>Referencia de Pago:</strong> ${client.payment_reference || 'N/A'}</p>
              ${activeQuote.ai_notes ? `<p style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; font-style: italic; color: #555;"><strong>Notas del Artista:</strong> "${activeQuote.ai_notes}"</p>` : ''}
            </div>
            
            <h3>Terms & Conditions – Tattoo Appointments</h3>
            <ol>
              <li><strong>Deposit & Booking</strong>: A deposit is required to secure your appointment. This will be deducted from the final price of your tattoo.</li>
              <li><strong>Cancellations & Rescheduling</strong>: If you need to reschedule or cancel your appointment, you must notify us at least 48 hours in advance. Deposits are non-refundable if you cancel or reschedule within 48 hours of your appointment.</li>
              <li><strong>Design & Changes</strong>: For large-scale tattoos (full sleeves, full back, chest, or leg pieces), a 3-hour design & discussion session (£300) is required before the first tattoo session. Any major changes to the design on the day of the session may affect pricing. Before starting the tattoo, you will be required to sign a document confirming your approval of the final design.</li>
              <li><strong>Health & Safety</strong>: You must be 18 or older to get tattooed (valid ID required). Please do not consume alcohol or drugs before your session. If you have any medical conditions or any wound in the skin that may affect the procedure, please inform us in advance. The use of any anesthetic/numbing creams before the session is strictly prohibited, as they may affect the tattooing process and cause allergic reactions. Fake tans are not allowed as they can interfere with the tattooing process. Please do not shave the area yourself before your appointment, as shaving may cause irritation. I will shave the area on the day of your session to ensure the best results.</li>
              <li><strong>Healing & Aftercare</strong>: Once the tattoo is completed, the healing process is 100% your responsibility. Proper aftercare is crucial— I will provide detailed instructions on the day of your appointment. Failure to follow these guidelines may affect the final result.</li>
              <li><strong>Payment</strong>: Payment must be made in full on the day of your appointment. We accept bank transfer, cash, debit and credit cards.</li>
              <li><strong>Late Arrivals</strong>: Please arrive on time for your appointment. If you are more than 2 hours late, your session may be canceled, and your deposit forfeited.</li>
            </ol>
            <p>By paying the deposit, you agree to these terms.</p>
            
            <p>Let us know if you have any questions,</p>
            <p>Looking forward to hearing from you!</p>
            <p>Best,<br>Robbie</p>
            <p style="margin-top: 30px; font-size: 12px; color: #888;">Copyright © 2026 Robbieflaviani, All rights reserved.</p>
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
              <p style="color: #000; font-weight: bold; margin-bottom: 20px;">Total de sesiones a agendar: ${activeQuote.total_sessions || 1}</p>
              <a href="${baseUrl}/agendar/${client.id}" style="display: inline-block; background: #000; color: #fff; padding: 15px 30px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px;">📅 Agendar mi Cita</a>
            </div>
            <p style="color: #666;">Recuerda que cada sesión durará aproximadamente <strong>${client.appointment_duration || activeQuote.ai_estimated_time || 2} horas</strong>.</p>
            
            <h3>What to Expect:</h3>
            <p><strong>Day of the tattoo Session</strong> – The session will start at the selected time, we recommend keeping your schedule flexible for the day.</p>
            
            <h3>Before Your Appointment:</h3>
            <ul>
              <li>Avoid energy drinks or excessive coffee, as they can affect your nervous system and make it harder to relax during the session.</li>
              <li>Bring some food, preferably something salty like sandwiches, to keep your energy levels stable.</li>
              <li>Avoid shaving the tattoo area yourself—I will shave the area on the day of the appointment to ensure proper preparation.</li>
            </ul>
            
            <h3>On the Day of Your Tattoo Session:</h3>
            <ul>
              <li>Wear comfortable clothing that allows easy access to the tattoo area. Loose, relaxed clothing is recommended.</li>
              <li>Wear dark or old clothes (preferably black) that you don’t mind getting stained with ink. Ink can sometimes spill, especially in large tattoos, and it may not come out of light-colored fabrics.</li>
              <li>Robbie will provide you with a complimentary healing cream to help with the aftercare process.</li>
            </ul>
            
            <p>Our studio, Nest of Thorns, is located at:</p>
            <p>📍 200 Bath St, Glasgow G2 4HG</p>
            
            <h3>Terms & Conditions – Tattoo Appointments</h3>
            <ol>
              <li><strong>Deposit & Booking</strong>: A deposit is required to secure your appointment. This will be deducted from the final price of your tattoo.</li>
              <li><strong>Cancellations & Rescheduling</strong>: If you need to reschedule or cancel your appointment, you must notify us at least 48 hours in advance. Deposits are non-refundable if you cancel or reschedule within 48 hours of your appointment.</li>
              <li><strong>Design & Changes</strong>: For large-scale tattoos (full sleeves, full back, chest, or leg pieces), a 3-hour design & discussion session (£300) is required before the first tattoo session. Any major changes to the design on the day of the session may affect pricing. Before starting the tattoo, you will be required to sign a document confirming your approval of the final design.</li>
              <li><strong>Health & Safety</strong>: You must be 18 or older to get tattooed (valid ID required). Please do not consume alcohol or drugs before your session. If you have any medical conditions or any wound in the skin that may affect the procedure, please inform us in advance. The use of any anesthetic/numbing creams before the session is strictly prohibited, as they may affect the tattooing process and cause allergic reactions. Fake tans are not allowed as they can interfere with the tattooing process. Please do not shave the area yourself before your appointment, as shaving may cause irritation. I will shave the area on the day of your session to ensure the best results.</li>
              <li><strong>Healing & Aftercare</strong>: Once the tattoo is completed, the healing process is 100% your responsibility. Proper aftercare is crucial— I will provide detailed instructions on the day of your appointment. Failure to follow these guidelines may affect the final result.</li>
              <li><strong>Payment</strong>: Payment must be made in full on the day of your appointment. We accept bank transfer, cash, debit and credit cards.</li>
              <li><strong>Late Arrivals</strong>: Please arrive on time for your appointment. If you are more than 2 hours late, your session may be canceled, and your deposit forfeited.</li>
            </ol>
            <p>By paying the deposit, you agree to these terms.</p>
            
            <p>Let us know if you have any questions,</p>
            <p>Looking forward to hearing from you!</p>
            <p>Best,<br>Robbie</p>
            <p style="margin-top: 30px; font-size: 12px; color: #888;">Copyright © 2026 Robbieflaviani, All rights reserved.</p>
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
      quote: `Cotización enviada por un monto de ${currencySymbol}${customPrice || activeQuote.price_artist || activeQuote.ai_suggested_price || '0'}.`,
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
