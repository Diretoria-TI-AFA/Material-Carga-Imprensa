import React, { useEffect, useState } from 'react';
import { pb } from '../lib/pb';
import { useAuth } from '../context/AuthContext';
import { KeyControl, Material, Caution } from '../types';
import { motion } from 'motion/react';
import { Key, Package, Clock, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';

export default function AssessorDashboard() {
  const { profile } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [myCautions, setMyCautions] = useState<Caution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  const CATEGORIES = ['Todos', 'Informática', 'Comunicação', 'Armamento', 'Veículos', 'Mobiliário', 'Ferramentas', 'Outros'];

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          m.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  useEffect(() => {
    // Busca inicial de dados
    const fetchData = async () => {
      try {
        console.log('Assessor: Fetching materials and keys...');
        const matsRes = await pb.collection('materials').getFullList<Material>();
        console.log('Assessor: Materials ok');
        
        setMaterials(matsRes);
      } catch (err) {
        console.error('Error fetching data in Assessor:', err);
      } finally {
        setLoading(false);
      }
    };

    // Busca inicial das minhas cautelas
    const fetchCautions = async () => {
      if (!profile?.id) return;
      try {
        console.log('Fetching cautions for user:', profile.id);
        const records = await pb.collection('cautions').getFullList<Caution>({
          filter: `userId = "${profile.id}" && status = "active"`
        });
        setMyCautions(records);
      } catch (err) {
        console.error('Error fetching cautions:', err);
      }
    };

    fetchData();
    fetchCautions();

    // Inscreve para atualizações em tempo real
    pb.collection('materials').subscribe('*', (e) => {
      if (e.action === 'create') setMaterials(prev => [...prev, e.record as unknown as Material]);
      if (e.action === 'update') setMaterials(prev => prev.map(m => m.id === e.record.id ? e.record as unknown as Material : m));
      if (e.action === 'delete') setMaterials(prev => prev.filter(m => m.id !== e.record.id));
    });

    pb.collection('cautions').subscribe('*', (e) => {
      if (e.record.userId !== profile?.id) return;
      if (e.action === 'create' && e.record.status === 'active') setMyCautions(prev => [...prev, e.record as unknown as Caution]);
      if (e.action === 'update') {
        if (e.record.status === 'completed') {
          setMyCautions(prev => prev.filter(c => c.id !== e.record.id));
        } else {
          setMyCautions(prev => prev.map(c => c.id === e.record.id ? e.record as unknown as Caution : c));
        }
      }
    });

    return () => {
      pb.collection('materials').unsubscribe();
      pb.collection('cautions').unsubscribe();
    };
  }, [profile]);

  const handleCaution = async () => {
    if (!selectedMaterial || !profile) return;

    try {
      // 1. Criar registro de cautela
      await pb.collection('cautions').create({
        materialId: selectedMaterial.id,
        materialName: selectedMaterial.name,
        userId: profile.id,
        userName: profile.warName,
        cautionedAt: new Date().toISOString(),
        keyUsed: '-',
        status: 'active'
      });

      // 2. Atualizar status do material
      await pb.collection('materials').update(selectedMaterial.id, {
        status: 'cautioned',
        lastUpdatedBy: profile.warName,
      });

      setSelectedMaterial(null);
    } catch (error: any) {
      console.error('Error cautioning material:', error);
      const msg = error.data?.message || error.message || 'Erro desconhecido';
      alert(`Erro ao realizar cautela: ${msg}\n\nVerifique se as permissões (API Rules) no PocketBase estão liberadas para usuários autenticados.`);
    }
  };

  const handleReturn = async (caution: Caution) => {
    try {
      // 1. Marcar cautela como concluída
      await pb.collection('cautions').update(caution.id, {
        status: 'completed',
        returnedAt: new Date().toISOString(),
      });

      // 2. Marcar material como disponível
      await pb.collection('materials').update(caution.materialId, {
        status: 'available',
        lastUpdatedBy: profile?.warName,
      });
    } catch (error: any) {
      console.error('Error returning material:', error);
      alert(`Erro ao devolver material: ${error.message}`);
    }
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Carga de Material</h1>
          <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Gerencie suas cautelas e utilize as chaves autorizadas</p>
        </div>
      </div>

      {myCautions.length > 0 && (
        <section>
          <div className="flex items-center space-x-2 mb-4">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Minhas Cautelas em Aberto</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myCautions.map(caution => (
              <div key={caution.id} className="bg-gradient-to-r from-blue-50 to-white border-2 border-blue-200 rounded-3xl p-6 shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group hover:border-blue-500 transition-all">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-black text-blue-500 tracking-wider">Cautela Ativa</span>
                    <p className="text-lg font-black text-slate-800">{caution.materialName}</p>
                    <p className="text-xs font-semibold text-slate-500 mt-1">Retirado em: {format(new Date(caution.cautionedAt), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleReturn(caution)}
                  className="w-full sm:w-auto bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-black hover:bg-black hover:scale-105 transition-all shadow-xl shadow-slate-200/50"
                >
                  Confirmar Devolução
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center space-x-2">
            <Package className="w-5 h-5 text-slate-800" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Inventário Disponível</h2>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 grow max-w-2xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar material pelo nome ou descrição..." 
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex bg-white p-1 border border-slate-200 rounded-xl overflow-x-auto no-scrollbar">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                    selectedCategory === cat ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Material / Categoria</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Descrição</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMaterials.map(material => (
                  <tr key={material.id} className={`hover:bg-slate-50/50 transition-colors group ${material.status !== 'available' ? 'opacity-50 grayscale select-none' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{material.name}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{material.category || 'Outros'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-slate-500 line-clamp-1 max-w-xs">{material.description}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full ${
                        material.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {material.status === 'available' ? 'Disponível' : 'Indisponível'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {material.status === 'available' ? (
                        <button
                          onClick={() => setSelectedMaterial(material)}
                          className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-blue-700 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                        >
                          Realizar Cautela
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold">Indisponível</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Caution Modal */}
      {selectedMaterial && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl"
          >
            <h2 className="text-2xl font-bold mb-2">Cautelar Material</h2>
            <p className="text-slate-500 mb-6">Confirme os detalhes da cautela para <span className="font-semibold text-slate-900">{selectedMaterial.name}</span>.</p>
            
            <div className="space-y-6">
              <div className="pt-4 flex space-x-3">
                <button 
                  onClick={() => setSelectedMaterial(null)}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleCaution}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
