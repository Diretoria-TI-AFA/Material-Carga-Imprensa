import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { pb } from '../lib/pb';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { UserCheck } from 'lucide-react';

export default function ProfileSetup() {
  const { profile, refreshProfile, isAdmin } = useAuth();
  const [entryNumber, setEntryNumber] = useState(profile?.entryNumber || '');
  const [warName, setWarName] = useState(profile?.warName || '');
  const [role, setRole] = useState(profile?.role || 'assessor');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Verifica se o cadastro já foi finalizado anteriormente (se já tem Nome de Guerra)
  const isInitialSetup = !profile?.warName;
  const [isEditing, setIsEditing] = useState(isInitialSetup);
  const canChangeRole = isInitialSetup || isAdmin;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    setLoading(true);
    try {
      await pb.collection('users').update(profile.id, {
        entryNumber,
        warName,
        role,
      });
      await refreshProfile();
      setIsEditing(false);
      if (isInitialSetup) {
        navigate('/');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <UserCheck className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold">Configuração de Perfil</h1>
          </div>
          {!isInitialSetup && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors"
            >
              Editar
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Número de Entrada (ex: 23/236 Felipe)
            </label>
            <input
              required
              disabled={!isEditing}
              type="text"
              value={entryNumber}
              onChange={(e) => setEntryNumber(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nome de Guerra
            </label>
            <input
              required
              disabled={!isEditing}
              type="text"
              value={warName}
              onChange={(e) => setWarName(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Função Desejada
            </label>
            <select
              disabled={!isEditing || !canChangeRole}
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="assessor">Assessor</option>
              <option value="director">Diretor</option>
              <option value="subdirector">Subdiretor</option>
              <option value="coordinator">Coordenador</option>
              <option value="public">Público (Terceiro)</option>
            </select>
            {!canChangeRole && isEditing && (
              <p className="mt-2 text-xs text-amber-600 font-bold flex items-center">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-2"></span>
                Apenas Diretores ou Coordenadores podem alterar a função após o cadastro inicial.
              </p>
            )}
            {canChangeRole && (
              <p className="mt-1 text-xs text-slate-400 font-medium">* Algumas funções exigem aprovação manual no sistema real (simulado aqui como auto-atribuição para fins de protótipo).</p>
            )}
          </div>

          {isEditing && (
            <div className="flex space-x-3">
              {!isInitialSetup && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEntryNumber(profile?.entryNumber || '');
                    setWarName(profile?.warName || '');
                    setRole(profile?.role || 'assessor');
                  }}
                  className="flex-1 py-4 border border-slate-200 rounded-xl font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button
                disabled={loading}
                type="submit"
                className="flex-[2] bg-blue-600 text-white p-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 flex items-center justify-center"
              >
                {loading ? 'Salvando...' : (isInitialSetup ? 'Finalizar Cadastro' : 'Salvar Alterações')}
              </button>
            </div>
          )}
        </form>
      </motion.div>
    </div>
  );
}
