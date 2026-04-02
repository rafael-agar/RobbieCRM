'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Palette, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
      } else if (data.session) {
        toast.success('Inicio de sesión exitoso');
        router.push('/');
      }
    } catch (error: any) {
      toast.error('Ocurrió un error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-black/20">
            <Palette className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900">ROBBY FLOW</h1>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Tattoo CRM</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:border-black focus:ring-0 transition-all outline-none"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:border-black focus:ring-0 transition-all outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-4 rounded-xl font-bold text-sm hover:bg-gray-800 transition-all disabled:bg-gray-200 disabled:text-gray-400 shadow-lg shadow-black/10 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
