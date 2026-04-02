import LeadForm from '@/components/LeadForm';
import { Palette } from 'lucide-react';

export default function CotizarPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto mb-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-black rounded-2xl mb-6 shadow-xl">
          <Palette className="text-white w-8 h-8" />
        </div>
        <h1 className="text-4xl font-black tracking-tight text-gray-900 mb-2">ROBBY FLOW</h1>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Tattoo Studio & Art</p>
      </div>
      
      <LeadForm />
      
      <footer className="mt-16 text-center text-gray-400 text-xs font-medium">
        <p>© 2026 Robby Flow. Todos los derechos reservados.</p>
        <p className="mt-1">Potenciado por Robby IA</p>
      </footer>
    </div>
  );
}
