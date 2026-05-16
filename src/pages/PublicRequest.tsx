import React, { useState, useEffect } from 'react';
import { pb } from '../lib/pb';
import { useAuth } from '../context/AuthContext';
import { Material, AccessRequest } from '../types';
import { motion } from 'motion/react';
import { Send, FileSearch, ShieldAlert, CheckCircle2, Clock } from 'lucide-react';

export default function PublicRequest() {
  const { user, profile } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [myRequests, setMyRequests] = useState<AccessRequest[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [requesterName, setRequesterName] = useState('');
  const [reason, setReason] = useState('');
  const [plannedDateTime, setPlannedDateTime] = useState('');
  const [thirdPartyNotes, setThirdPartyNotes] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isFinalized, setIsFinalized] = useState(false);

  const availableMaterials = materials.filter(m => m.status === 'available');

  const canPreFill = ['director', 'subdirector', 'coordinator', 'assessor'].includes(profile?.role || '');

  useEffect(() => {
    if (!profile?.warName) return;
    if (!canPreFill) {
      setRequesterName(profile.warName);
    }
  }, [profile, canPreFill]);

  useEffect(() => {
    // Busca inicial de materiais
    const fetchMaterials = async () => {
      try {
        console.log('Public view: Fetching materials...');
        const records = await pb.collection('materials').getFullList<Material>();
        setMaterials(records);
      } catch (err) {
        console.error('Error fetching materials:', err);
      }
    };

    // Busca inicial das minhas solicitações
    const fetchMyRequests = async () => {
      if (!profile?.warName) return;
      try {
        console.log('Public view: Fetching requests for:', profile.warName);
        const records = await pb.collection('access_requests').getFullList<AccessRequest>({
          filter: `requesterName = "${profile.warName}"`,
          sort: '-created'
        });
        setMyRequests(records);
      } catch (err) {
        console.error('Error fetching my requests:', err);
      }
    };

    fetchMaterials();
    fetchMyRequests();

    // Assinaturas real-time
    pb.collection('materials').subscribe('*', (e) => {
      if (e.action === 'create') setMaterials(prev => [...prev, e.record as unknown as Material]);
      if (e.action === 'update') setMaterials(prev => prev.map(m => m.id === e.record.id ? e.record as unknown as Material : m));
    });

    if (profile?.warName) {
      pb.collection('access_requests').subscribe('*', (e) => {
        if (e.record.requesterName !== profile.warName) return;
        if (e.action === 'create') setMyRequests(prev => [e.record as unknown as AccessRequest, ...prev]);
        if (e.action === 'update') setMyRequests(prev => prev.map(r => r.id === e.record.id ? e.record as unknown as AccessRequest : r));
      });
    }

    return () => {
      pb.collection('materials').unsubscribe();
      pb.collection('access_requests').unsubscribe();
    };
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMaterialIds.length === 0 || isFinalized) return;

    try {
      const promises = selectedMaterialIds.map(id => {
        const mat = materials.find(m => m.id === id);
        return pb.collection('access_requests').create({
          requesterName,
          materialId: id,
          materialName: mat?.name || 'Material',
          status: 'pending',
          isImmutable: true,
          notes: thirdPartyNotes,
          reason,
          plannedDateTime
        });
      });

      await Promise.all(promises);
      setStatus(`${selectedMaterialIds.length} cautela(s) registrada(s) com sucesso! Os dados agora são imutáveis.`);
      setIsFinalized(true);
      setSelectedMaterialIds([]);
      setReason('');
      setPlannedDateTime('');
      setThirdPartyNotes('');
    } catch (error: any) {
      console.error('Error submitting request:', error);
      const msg = error.data?.message || error.message || 'Erro desconhecido';
      alert(`Erro ao enviar solicitação: ${msg}\n\nIsso geralmente acontece quando as "API Rules" da coleção no PocketBase não permitem a criação por usuários comuns.`);
      setStatus('Erro ao enviar solicitação.');
    }
  };

  const toggleMaterial = (id: string) => {
    if (isFinalized) return;
    setSelectedMaterialIds(prev => 
      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">Formulário de Cautelas</h1>
        <p className="text-slate-500 max-w-xl mx-auto">
          {canPreFill 
            ? 'Registro de cautela para terceiros. Uma vez finalizado, os dados não podem ser alterados.' 
            : 'Utilize este formulário para solicitar a cautela temporária de materiais de carga.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Form */}
        <motion.section 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200"
        >
          <div className="flex items-center space-x-3 mb-8">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Send className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold">Novo Pedido</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">
                  {canPreFill ? 'Detentor do Material' : 'Seu Nome Completo'}
                </label>
                <input
                  required
                  disabled={isFinalized || (!canPreFill && !!profile?.warName)}
                  type="text"
                  value={requesterName}
                  onChange={e => setRequesterName(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50 font-medium"
                  placeholder="Nome ou identificação"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">
                  Data e Hora Prevista
                </label>
                <input
                  required
                  disabled={isFinalized}
                  type="datetime-local"
                  value={plannedDateTime}
                  onChange={e => setPlannedDateTime(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">Motivo da Cautela</label>
              <select
                required
                disabled={isFinalized}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50 font-medium"
                value={reason}
                onChange={e => setReason(e.target.value)}
              >
                <option value="">Selecione um motivo...</option>
                <option value="Serviço de Escala">Serviço de Escala</option>
                <option value="Instrução / Treinamento">Instrução / Treinamento</option>
                <option value="Operação / Missão">Operação / Missão</option>
                <option value="Uso Administrativo">Uso Administrativo</option>
                <option value="Outros">Outros (Especificar em Observações)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">Materiais Desejados (Selecione um ou mais)</label>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 max-h-72 overflow-y-auto space-y-4">
                {availableMaterials.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">Nenhum material disponível no momento.</p>
                ) : (
                  Object.entries(
                    availableMaterials.reduce((acc, m) => {
                      const cat = m.category || 'Outros';
                      if (!acc[cat]) acc[cat] = [];
                      acc[cat].push(m);
                      return acc;
                    }, {} as Record<string, Material[]>)
                  ).map(([category, items]) => (
                    <div key={category} className="space-y-2">
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-1">{category}</h3>
                      <div className="grid grid-cols-1 gap-1">
                        {(items as Material[]).map(m => (
                          <label 
                            key={m.id} 
                            className={`flex items-center space-x-3 p-2 rounded-xl transition-all cursor-pointer ${
                              selectedMaterialIds.includes(m.id) ? 'bg-blue-50 border-blue-100' : 'hover:bg-slate-100/50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={isFinalized}
                              checked={selectedMaterialIds.includes(m.id)}
                              onChange={() => toggleMaterial(m.id)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 transition-all"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-bold text-slate-700">{m.name}</p>
                              {m.description && <p className="text-[10px] text-slate-400 line-clamp-1">{m.description}</p>}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
              {selectedMaterialIds.length > 0 && (
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs font-bold text-blue-600">
                    {selectedMaterialIds.length} item(ns) selecionado(s)
                  </p>
                  <button 
                    type="button" 
                    onClick={() => setSelectedMaterialIds([])}
                    className="text-[10px] font-black text-red-400 uppercase hover:text-red-600"
                  >
                    Limpar Seleção
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">Observações Adicionais (Opcional)</label>
              <textarea
                disabled={isFinalized}
                placeholder="Detalhes adicionais sobre a cautela..."
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all h-24 text-sm disabled:opacity-50"
                value={thirdPartyNotes}
                onChange={e => setThirdPartyNotes(e.target.value)}
              />
            </div>

            {!isFinalized && (
              <button
                type="submit"
                disabled={selectedMaterialIds.length === 0}
                className="w-full bg-blue-600 text-white p-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center space-x-2 disabled:opacity-50 disabled:grayscale"
              >
                <span>Realizar Cautela</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            )}

            {status && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-green-50 border border-green-100 rounded-2xl text-green-700 text-sm font-medium flex items-center space-x-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{status}</span>
              </motion.div>
            )}
          </form>
        </motion.section>

        {/* Requests Status */}
        <motion.section 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-purple-50 rounded-lg">
              <FileSearch className="w-6 h-6 text-purple-600" />
            </div>
            <h2 className="text-xl font-bold">Status dos meus Pedidos</h2>
          </div>

          <div className="space-y-4">
            {myRequests.length === 0 && (
              <div className="p-8 border-2 border-dashed border-slate-100 rounded-3xl text-center">
                <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 text-sm font-medium">Nenhuma solicitação encontrada.</p>
              </div>
            )}
            {myRequests.map(req => (
              <div key={req.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-800">{req.materialName}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">Pedido em: {req.created ? new Date(req.created).toLocaleDateString() : '-'}</p>
                    {req.plannedDateTime && (
                      <p className="text-[10px] text-blue-500 font-bold uppercase tracking-tighter flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        Previsto: {new Date(req.plannedDateTime).toLocaleString()}
                      </p>
                    )}
                  </div>
                  {req.reason && <p className="text-xs text-slate-500 font-medium italic">Motivo: {req.reason}</p>}
                </div>
                <div className="flex flex-col items-end">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                    req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    req.status === 'approved' ? 'bg-green-100 text-green-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {req.status}
                  </span>
                  {req.status === 'vetoed' && (
                    <span className="text-[10px] text-red-500 font-bold mt-1 uppercase flex items-center space-x-1">
                      <ShieldAlert className="w-3 h-3" />
                      <span>Vetado pela Diretoria</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
