import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { pb } from '../lib/pb';
import { 
  LogOut, 
  Package, 
  LayoutDashboard, 
  ShieldCheck, 
  Key, 
  ClipboardList, 
  Users 
} from 'lucide-react';

export default function Sidebar() {
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    pb.authStore.clear();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  if (!user) return null;

  return (
    <aside className="w-64 bg-slate-900 flex flex-col shrink-0 h-screen sticky top-0">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Package className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold tracking-tight text-lg">GCM CONTROL</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest px-4 mb-2">Principal</div>
        
        <Link 
          to="/" 
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
            isActive('/') || isActive('/assessor') 
            ? 'bg-blue-600/10 text-blue-400 border-blue-600/20' 
            : 'text-slate-400 hover:text-white border-transparent'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="font-medium">Dashboard</span>
        </Link>

        {isAdmin && (
          <Link 
            to="/director" 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
              isActive('/director') 
              ? 'bg-blue-600/10 text-blue-400 border-blue-600/20' 
              : 'text-slate-400 hover:text-white border-transparent'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
            <span className="font-medium">Diretoria</span>
          </Link>
        )}

        <Link 
          to="/public-request" 
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
            isActive('/public-request') 
            ? 'bg-blue-600/10 text-blue-400 border-blue-600/20' 
            : 'text-slate-400 hover:text-white border-transparent'
          }`}
        >
          <ClipboardList className="w-5 h-5" />
          <span className="font-medium">Cautelas</span>
        </Link>

        {['director', 'subdirector', 'coordinator', 'assessor'].includes(profile?.role || '') && (
          <Link 
            to="/keys" 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
              isActive('/keys') 
              ? 'bg-blue-600/10 text-blue-400 border-blue-600/20' 
              : 'text-slate-400 hover:text-white border-transparent'
            }`}
          >
            <Key className="w-5 h-5" />
            <span className="font-medium">Controle de Chaves</span>
          </Link>
        )}

        <div className="pt-4 text-slate-500 text-[10px] font-bold uppercase tracking-widest px-4 mb-2">Administração</div>
        
        <Link 
          to="/profile-setup" 
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
            isActive('/profile-setup') 
            ? 'bg-blue-600/10 text-blue-400 border-blue-600/20' 
            : 'text-slate-400 hover:text-white border-transparent'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="font-medium">Perfil</span>
        </Link>
      </nav>

      <div className="p-4 mt-auto">
        <div className="bg-slate-800 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg">
              {profile?.warName?.[0] || user.email?.[0] || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-white text-xs font-semibold truncate">{profile?.warName || 'Usuário'}</p>
              <p className="text-slate-400 text-[10px] uppercase font-bold truncate">{profile?.role || 'Visitante'}</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all font-medium text-sm"
        >
          <LogOut className="w-5 h-5" />
          <span>Sair do Sistema</span>
        </button>
      </div>
    </aside>
  );
}
