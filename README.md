# 🖋️ TattooFlow CRM

TattooFlow CRM es una aplicación web diseñada específicamente para artistas del tatuaje y gestores de estudios. Su objetivo principal es optimizar el embudo de ventas (funnel) desde que un cliente potencial hace el primer contacto (lead) hasta que el tatuaje es completado.

Centraliza la información del cliente, los detalles del diseño, las imágenes de referencia, las estimaciones de precio/tiempo, el registro de pagos y la agenda de citas en una única plataforma intuitiva.

## ✨ Características Principales

*   **Tablero Kanban (Pipeline):** Visualiza y mueve a tus clientes a través de diferentes etapas: *Nuevo Lead, Cotización, Pago Pendiente, Agendado, Completado*, etc.
*   **Canal de Origen:** Rastrea si el lead proviene de tu sitio web, Instagram, WhatsApp, etc.
*   **Formulario Público de Cotización:** Un enlace que puedes compartir en tu Instagram o web para que los clientes envíen sus ideas, zonas del cuerpo, tamaños y suban imágenes de referencia.
*   **Agendamiento Inteligente:** 
    *   Los clientes pueden elegir su fecha y hora basándose en tu disponibilidad real.
    *   **Prevención de Solapamiento:** El sistema calcula la duración del tatuaje y bloquea los horarios ocupados para evitar reservas dobles.
    *   **Horarios Dinámicos:** Configura tus días laborales, hora de inicio/fin y el intervalo entre citas.
*   **Gestión de Pagos:** Registra señas (depósitos) y pagos finales. Mantén un historial financiero claro por cada cliente.
*   **Panel de Detalles del Cliente:** Toda la información en un solo lugar: datos de contacto, detalles del proyecto, historial de mensajes, citas y pagos.
*   **Configuración Personalizada:** Ajusta tus horarios de trabajo y preferencias directamente desde la interfaz.

## 🛠️ Stack Tecnológico

*   **Frontend:** [Next.js 15+](https://nextjs.org/) (App Router), React, TypeScript.
*   **Estilos:** [Tailwind CSS](https://tailwindcss.com/).
*   **Componentes y Animaciones:** [Framer Motion](https://www.framer.com/motion/), [Lucide React](https://lucide.dev/) (Iconos), [Sonner](https://sonner.emilkowal.ski/) (Notificaciones).
*   **Backend & Base de Datos:** [Supabase](https://supabase.com/) (PostgreSQL, Storage para imágenes).
*   **Fechas:** `date-fns` para la manipulación y formateo de fechas.

## 📂 Estructura del Proyecto

```text
├── app/
│   ├── agendar/[id]/   # Página pública para que el cliente agende su cita
│   ├── cotizar/        # Formulario público para nuevos leads
│   ├── pago/[id]/      # Página pública para que el cliente reporte su pago
│   ├── layout.tsx      # Layout principal de Next.js
│   └── page.tsx        # Página principal (Dashboard del Artista)
├── components/
│   ├── CalendarView.tsx      # Vista de calendario interno
│   ├── ClientDetailPanel.tsx # Panel lateral con toda la info del cliente
│   ├── ClientsList.tsx       # Tabla con paginación de todos los clientes
│   ├── Dashboard.tsx         # Contenedor principal de la app
│   ├── KanbanBoard.tsx       # Tablero drag-and-drop
│   ├── LeadForm.tsx          # Formulario interno para crear leads
│   ├── PaymentModal.tsx      # Modal para registrar pagos finales
│   └── SettingsView.tsx      # Panel de configuración de horarios
├── lib/
│   ├── supabase.ts     # Cliente de conexión a Supabase
│   └── types.ts        # Definiciones de interfaces TypeScript
└── supabase-schema.sql # Script SQL para crear la base de datos
```

## 🚀 Instalación y Configuración

### 1. Requisitos Previos
*   Node.js (v18 o superior)
*   Una cuenta en [Supabase](https://supabase.com/)

### 2. Clonar el repositorio e instalar dependencias
```bash
npm install
```

### 3. Configurar Variables de Entorno
Crea un archivo `.env.local` en la raíz del proyecto y añade tus credenciales de Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
```

### 4. Configurar la Base de Datos (Supabase)
Ve al **SQL Editor** en tu panel de Supabase y ejecuta el contenido del archivo `supabase-schema.sql`. Esto creará las siguientes tablas y políticas de seguridad (RLS):
*   `clients`: Almacena los leads y proyectos (incluyendo el campo `channel`).
*   `appointments`: Registra las citas agendadas.
*   `messages`: Historial de comunicaciones.
*   `payments`: Historial de transacciones (señas y pagos finales).
*   `settings`: Configuraciones del sistema (horarios del artista).

Si ya tenías la base de datos creada, asegúrate de añadir la columna `channel` ejecutando:
```sql
ALTER TABLE clients ADD COLUMN channel TEXT DEFAULT 'Manual';
```

*Nota: Asegúrate de que el bucket de Storage llamado `references` esté creado y configurado como público para que las imágenes de referencia funcionen correctamente.*

### 5. Iniciar el Servidor de Desarrollo
```bash
npm run dev
```
Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la aplicación.

## 📱 Flujo de Uso Típico

1.  **Captura de Lead:** El cliente llena el formulario en `/cotizar`.
2.  **Revisión:** El artista ve el nuevo lead en la columna "Nuevo Lead" del Kanban.
3.  **Cotización:** El artista revisa la idea, establece un precio y mueve la tarjeta a "Cotización IA" o "Revisada".
4.  **Pago de Seña:** Se envía el link de pago al cliente (`/pago/[id]`). Una vez pagado, el cliente pasa a "Pago Confirmado".
5.  **Agendamiento:** Se envía el link de agenda al cliente (`/agendar/[id]`). El cliente elige un horario disponible. El estado cambia a "Agendado".
6.  **Tatuaje y Pago Final:** El día de la cita, tras terminar el tatuaje, el artista mueve la tarjeta a "Completado", lo que abre el modal para registrar el pago restante.

---
*Desarrollado para optimizar el arte y el negocio del tatuaje.* 🖤
