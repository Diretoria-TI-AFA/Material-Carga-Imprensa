import { useAuth } from '../context/AuthContext';
import { Bell, Search } from 'lucide-react';

export default function Header() {
  const { profile } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 sticky top-0 z-40">
      <div>
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">
          Painel de Gestão de Ativos
        </h1>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
          Visão em tempo real do material carga · AFA
        </p>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center bg-slate-100 rounded-lg px-3 py-1.5 border border-slate-200">
          <Search className="w-4 h-4 text-slate-400 mr-2" />
          <input 
            type="text" 
            placeholder="Buscar material..." 
            className="bg-transparent border-none text-xs outline-none w-48 text-slate-600 font-medium"
          />
        </div>

        <div className="flex items-center gap-3 pl-4 border-l border-slate-100">
          <div className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase">
            Sistema Online
          </div>
          <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 rounded-lg border border-slate-200">
            <Bell className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
