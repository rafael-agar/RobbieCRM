import type {Metadata} from 'next';
import { Toaster } from 'sonner';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'TattooFlow CRM',
  description: 'Gestión inteligente para artistas del tatuaje',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="es">
      <body suppressHydrationWarning>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
