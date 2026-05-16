import React, { useEffect, useState } from 'react';
import { pb } from '../lib/pb';
import { useAuth } from '../context/AuthContext';
import { KeyControl, UserProfile } from '../types';
import { Key, User, Calendar, Loader2, Plus, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function KeysPage() {
  const { profile } = useAuth();
  const [keys, setKeys] = useState<KeyControl[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    currentHolderId: '',
    notes: ''
  });

  useEffect(() => {
    if (profile?.id) {
      setFormData(prev => ({ ...prev, currentHolderId: profile.id }));
    }
  }, [profile]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [keysRes, usersRes] = await Promise.all([
        pb.collection('keys_control').getFullList<KeyControl>({
          sort: '-updated',
        }),
        pb.collection('users').getFullList<UserProfile>().catch(() => [])
      ]);
      setKeys(keysRes);
      
      // Se não conseguiu buscar todos os usuários (provavelmente por permissão), 
      // garante que pelo menos o usuário logado esteja na lista para seleção.
      const finalUsers = usersRes.length > 0 ? usersRes : (profile ? [profile] : []);
      setUsers(finalUsers as any);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      console.log('KeysPage: Attempting to create key with:', formData);
      await pb.collection('keys_control').create(formData);
      console.log('KeysPage: Key created successfully');
      setIsModalOpen(false);
      setFormData({ name: '', currentHolderId: profile?.id || '', notes: '' });
      fetchData();
    } catch (error: any) {
      console.error('Error creating key:', error);
      alert(`Erro ao criar chave: ${error.message || 'Verifique se todos os campos estão preenchidos'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransfer = async (keyId: string, newHolderId: string) => {
    try {
      await pb.collection('keys_control').update(keyId, {
        currentHolderId: newHolderId
      });
      fetchData();
    } catch (error) {
      console.error('Error transferring key:', error);
      alert('Erro ao transferir chave.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2 tracking-tight">Controle de Chaves</h1>
          <p className="text-slate-500">Monitoramento em tempo real da posse das chaves da repartição.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
        >
          <Plus className="w-5 h-5" />
          <span>Cadastrar Chave</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {keys.map((key) => {
          const holder = users.find(u => u.id === key.currentHolderId);
          return (
            <motion.div
              layout
              key={key.id}
              className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                  <Key className="w-6 h-6 text-blue-600" />
                </div>
                <div className="bg-slate-50 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  ID: {key.id.slice(0, 5)}
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-4">{key.name}</h3>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                  <User className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Em posse de</p>
                    <p className="text-sm font-bold text-slate-700">{holder?.warName || 'Desconhecido'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-slate-400" />
                  <p className="text-xs text-slate-500">
                    Última movimentação: {new Date(key.updated).toLocaleDateString()}
                  </p>
                </div>

                {key.notes && (
                  <div className="flex items-start gap-3 p-3 border border-dashed border-slate-200 rounded-2xl">
                    <Info className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-slate-400 font-medium">{key.notes}</p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-slate-50">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-3">Transferir para</p>
                <select
                  value={key.currentHolderId}
                  onChange={(e) => handleTransfer(key.id, e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.warName} ({u.role})</option>
                  ))}
                </select>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Nova Chave</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Nome da Chave</label>
                  <input
                    required
                    type="text"
                    placeholder="Ex: Chave do Depósito Principal"
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 transition-all font-medium"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Detentor Inicial</label>
                  <select
                    required
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 transition-all font-medium"
                    value={formData.currentHolderId}
                    onChange={e => setFormData({ ...formData, currentHolderId: e.target.value })}
                  >
                    <option value="">Selecione um usuário...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.warName} ({u.role})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Observações</label>
                  <textarea
                    placeholder="Adicione detalhes extras..."
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 transition-all font-medium min-h-[100px]"
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-400 hover:bg-slate-100 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-blue-600 text-white px-6 py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                  >
                    {submitting ? 'Salvando...' : 'Cadastrar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
