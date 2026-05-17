import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pb } from '../lib/pb';
import { useAuth } from '../context/AuthContext';
import { Material, Caution, MaterialAlteration, AccessRequest, KeyControl } from '../types';
import { motion } from 'motion/react';
import {
  Package,
  History,
  FileText,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MapPin,
  Key,
  Clock,
  Search,
  UserRound,
  Users,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  BarChart3,
  ListChecks,
} from 'lucide-react';
import { format } from 'date-fns';

type DashboardTab = 'inventory' | 'keys' | 'history' | 'cautions' | 'alterations' | 'members';
type HistoryStatus = 'all' | 'active' | 'completed';

type DashboardSummary = {
  totalMaterials: number;
  availableMaterials: number;
  cautionedMaterials: number;
  activeCautions: number;
  pendingRequests: number;
  pendingAlterations: number;
};

type KeyRow = {
  key: KeyControl;
  holder: Caution | null;
};

const CATEGORIES = ['Informática', 'Comunicação', 'Armamento', 'Veículos', 'Mobiliário', 'Ferramentas', 'Outros'];
const MATERIALS_PER_PAGE = 10;
const HISTORY_PER_PAGE = 10;
const REQUESTS_LIMIT = 60;
const ALTERATIONS_LIMIT = 60;

const emptySummary: DashboardSummary = {
  totalMaterials: 0,
  availableMaterials: 0,
  cautionedMaterials: 0,
  activeCautions: 0,
  pendingRequests: 0,
  pendingAlterations: 0,
};

function useDebouncedValue<T>(value: T, delay = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function escapePbValue(value: string) {
  return value.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildContainsFilter(fields: string[], rawValue: string) {
  const value = escapePbValue(rawValue);

  if (!value) return '';

  return `(${fields.map(field => `${field} ~ '${value}'`).join(' || ')})`;
}

function joinFilters(filters: string[]) {
  return filters.filter(Boolean).join(' && ');
}

function buildPocketBaseOptions(options: {
  filter?: string;
  sort?: string;
  expand?: string;
}) {
  const finalOptions: Record<string, string> = {};

  if (options.filter?.trim()) {
    finalOptions.filter = options.filter;
  }

  if (options.sort?.trim()) {
    finalOptions.sort = options.sort;
  }

  if (options.expand?.trim()) {
    finalOptions.expand = options.expand;
  }

  return finalOptions;
}

function isCorsOrNetworkError(error: any) {
  return error?.status === 0 || error?.message === 'Something went wrong.';
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';

  try {
    return format(new Date(value), 'dd/MM/yyyy HH:mm');
  } catch {
    return '-';
  }
}

function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    active: 'Ativo',
    completed: 'Concluído',
    available: 'Disponível',
    cautioned: 'Cautelado',
    pending: 'Pendente',
    approved: 'Aprovado',
    rejected: 'Rejeitado',
    vetoed: 'Vetado',
  };

  return labels[status || ''] || status || '-';
}

function statusBadgeClass(status?: string) {
  if (status === 'active' || status === 'cautioned') {
    return 'bg-orange-100 text-orange-700 border-orange-200';
  }

  if (status === 'available' || status === 'approved' || status === 'completed') {
    return 'bg-green-100 text-green-700 border-green-200';
  }

  if (status === 'pending') {
    return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  }

  if (status === 'rejected' || status === 'vetoed') {
    return 'bg-red-100 text-red-700 border-red-200';
  }

  return 'bg-slate-100 text-slate-600 border-slate-200';
}

function renderPagination(
  page: number,
  totalPages: number,
  onChange: (page: number) => void,
) {
  if (totalPages <= 1) return null;

  const visiblePages = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter(pageNumber => {
      if (pageNumber === 1 || pageNumber === totalPages) return true;
      return Math.abs(pageNumber - page) <= 1;
    });

  return (
    <div className="flex items-center gap-2">
      <button
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {visiblePages.map((pageNumber, index) => {
        const previous = visiblePages[index - 1];
        const shouldShowDots = previous && pageNumber - previous > 1;

        return (
          <React.Fragment key={pageNumber}>
            {shouldShowDots && <span className="px-1 text-xs font-bold text-slate-400">...</span>}
            <button
              onClick={() => onChange(pageNumber)}
              className={`h-9 min-w-9 rounded-xl px-3 text-xs font-black transition-all ${page === pageNumber
                ? 'bg-slate-900 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
            >
              {pageNumber}
            </button>
          </React.Fragment>
        );
      })}

      <button
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function DirectorDashboard() {
  const { profile } = useAuth();
  const didBoot = useRef(false);

  const [activeTab, setActiveTab] = useState<DashboardTab>('inventory');
  const [initialLoading, setInitialLoading] = useState(true);

  const [summary, setSummary] = useState<DashboardSummary>(emptySummary);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialsTotal, setMaterialsTotal] = useState(0);
  const [materialsTotalPages, setMaterialsTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  const [keys, setKeys] = useState<KeyControl[]>([]);
  const [activeCautions, setActiveCautions] = useState<Caution[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [keySearch, setKeySearch] = useState('');

  const [history, setHistory] = useState<Caution[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatus, setHistoryStatus] = useState<HistoryStatus>('all');

  const [cautionRequests, setCautionRequests] = useState<AccessRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestApproval, setRequestApproval] = useState<AccessRequest | null>(null);
  const [approvalKey, setApprovalKey] = useState('');

  const [alterations, setAlterations] = useState<MaterialAlteration[]>([]);
  const [alterationsLoading, setAlterationsLoading] = useState(false);

  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [isEditingMaterial, setIsEditingMaterial] = useState<Material | null>(null);
  const [isRemovingMaterial, setIsRemovingMaterial] = useState<Material | null>(null);
  const [isDirectCautioning, setIsDirectCautioning] = useState<Material | null>(null);

  const [directCautionForm, setDirectCautionForm] = useState({
    person: '',
    keyId: '',
  });

  const [materialForm, setMaterialForm] = useState({
    name: '',
    description: '',
    currentLocation: 'Depósito Central',
    category: 'Outros',
  });

  const [alterationForm, setAlterationForm] = useState<{
    explanation: string;
    document: File | null;
  }>({
    explanation: '',
    document: null,
  });

  const debouncedMaterialSearch = useDebouncedValue(searchTerm);
  const debouncedHistorySearch = useDebouncedValue(historySearch);
  const debouncedKeySearch = useDebouncedValue(keySearch, 200);

  const canVeto = profile?.role === 'director';

  const keyRows = useMemo<KeyRow[]>(() => {
    const holdersByKey = new Map<string, Caution>();

    activeCautions.forEach(caution => {
      if (!caution.keyUsed || caution.keyUsed === 'A confirmar') return;

      const existing = holdersByKey.get(caution.keyUsed);

      if (!existing) {
        holdersByKey.set(caution.keyUsed, caution);
        return;
      }

      const existingDate = existing.cautionedAt ? new Date(existing.cautionedAt).getTime() : 0;
      const currentDate = caution.cautionedAt ? new Date(caution.cautionedAt).getTime() : 0;

      if (currentDate > existingDate) {
        holdersByKey.set(caution.keyUsed, caution);
      }
    });

    return keys.map(key => ({
      key,
      holder: holdersByKey.get(key.name) || null,
    }));
  }, [keys, activeCautions]);

  const availableKeys = useMemo(
    () => keyRows.filter(row => !row.holder),
    [keyRows],
  );

  const usedKeys = useMemo(
    () => keyRows.filter(row => row.holder),
    [keyRows],
  );

  const visibleKeyRows = useMemo(() => {
    const query = debouncedKeySearch.trim().toLowerCase();

    if (!query) return keyRows;

    return keyRows.filter(({ key, holder }) => {
      const keyName = key.name?.toLowerCase() || '';
      const holderName = holder?.userName?.toLowerCase() || '';
      const materialName = holder?.materialName?.toLowerCase() || '';

      return keyName.includes(query) || holderName.includes(query) || materialName.includes(query);
    });
  }, [keyRows, debouncedKeySearch]);



  const getCountSafe = async <T,>(
    collectionName: string,
    options?: {
      filter?: string;
      sort?: string;
    },
  ) => {
    try {
      const result = await pb
        .collection(collectionName)
        .getList<T>(1, 1, buildPocketBaseOptions(options || {}));

      return result.totalItems;
    } catch (error: any) {
      console.warn(`Não foi possível contar ${collectionName}:`, error);

      if (isCorsOrNetworkError(error)) {
        console.warn(
          'Possível bloqueio de CORS/rede no PocketHost. Verifique se http://localhost:3000 está autorizado ou teste em produção.',
        );
      }

      return 0;
    }
  };

  const loadDashboardSummary = useCallback(async () => {
    const totalMaterials = await getCountSafe<Material>('materials');

    const availableMaterials = await getCountSafe<Material>('materials', {
      filter: "status = 'available'",
    });

    const cautionedMaterials = await getCountSafe<Material>('materials', {
      filter: "status = 'cautioned'",
    });

    const activeCautionsCount = await getCountSafe<Caution>('cautions', {
      filter: "status = 'active'",
    });

    const pendingRequests = await getCountSafe<AccessRequest>('access_requests', {
      filter: "status = 'pending'",
    });

    let pendingAlterations = 0;

    try {
      pendingAlterations = await getCountSafe<MaterialAlteration>('alterations', {
        filter: "status = 'pending'",
      });
    } catch {
      pendingAlterations = 0;
    }

    setSummary({
      totalMaterials,
      availableMaterials,
      cautionedMaterials,
      activeCautions: activeCautionsCount,
      pendingRequests,
      pendingAlterations,
    });
  }, []);

  const loadMaterials = useCallback(async () => {
    try {
      setMaterialsLoading(true);

      const filters = [
        selectedCategory !== 'Todos' ? `category = '${escapePbValue(selectedCategory)}'` : '',
        buildContainsFilter(['name', 'description', 'currentLocation', 'category'], debouncedMaterialSearch),
      ];

      const filter = joinFilters(filters);

      const result = await pb.collection('materials').getList<Material>(
        currentPage,
        MATERIALS_PER_PAGE,
        buildPocketBaseOptions({
          filter,
          sort: 'name',
        }),
      );

      setMaterials(result.items);
      setMaterialsTotal(result.totalItems);
      setMaterialsTotalPages(result.totalPages || 1);
    } catch (error: any) {
      console.warn('Erro ao buscar materiais:', error);

      if (isCorsOrNetworkError(error)) {
        console.warn('Possível bloqueio de CORS/rede ao buscar materiais.');
      }
    } finally {
      setMaterialsLoading(false);
    }
  }, [currentPage, selectedCategory, debouncedMaterialSearch]);

  const loadKeysAndHolders = useCallback(async () => {
    try {
      setKeysLoading(true);

      const keysResult = await pb.collection('keys_control').getFullList<KeyControl>({
        sort: 'name',
      });

      setKeys(keysResult);

      const activeCautionsResult = await pb.collection('cautions').getFullList<Caution>({
        filter: "status = 'active'",
        sort: '-cautionedAt',
      });

      setActiveCautions(activeCautionsResult);
    } catch (error: any) {
      console.warn('Erro ao buscar chaves e detentores:', error);

      if (isCorsOrNetworkError(error)) {
        console.warn('Possível bloqueio de CORS/rede ao buscar chaves.');
      }
    } finally {
      setKeysLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);

      const filters = [
        historyStatus !== 'all' ? `status = '${historyStatus}'` : '',
        buildContainsFilter(['materialName', 'userName', 'keyUsed'], debouncedHistorySearch),
      ];

      const result = await pb.collection('cautions').getList<Caution>(
        historyPage,
        HISTORY_PER_PAGE,
        {
          filter: joinFilters(filters),
          sort: '-cautionedAt',
        },
      );

      setHistory(result.items);
      setHistoryTotal(result.totalItems);
      setHistoryTotalPages(result.totalPages || 1);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      alert('Erro ao buscar histórico.');
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage, historyStatus, debouncedHistorySearch]);

  const loadRequests = useCallback(async () => {
    try {
      setRequestsLoading(true);

      const result = await pb.collection('access_requests').getList<AccessRequest>(
        1,
        REQUESTS_LIMIT,
        buildPocketBaseOptions({
          sort: '-created',
        }),
      );

      setCautionRequests(result.items);
    } catch (error: any) {
      console.warn('Erro ao buscar solicitações:', error);

      if (isCorsOrNetworkError(error)) {
        console.warn('Possível bloqueio de CORS/rede ao buscar solicitações.');
      }
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  const loadAlterations = useCallback(async () => {
    try {
      setAlterationsLoading(true);

      const result = await pb.collection('alterations').getList<MaterialAlteration>(
        1,
        ALTERATIONS_LIMIT,
        buildPocketBaseOptions({
          sort: '-created',
        }),
      );

      setAlterations(result.items);
    } catch (error: any) {
      console.warn('Erro ao buscar alterações:', error);

      if (isCorsOrNetworkError(error)) {
        console.warn('Possível bloqueio de CORS/rede ao buscar alterações.');
      }
    } finally {
      setAlterationsLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      setUsersLoading(true);

      const result = await pb.collection('users').getFullList({
        sort: 'name',
      });

      setUsers(result);
    } catch (error) {
      console.error('Erro ao buscar membros:', error);
      alert('Erro ao buscar membros.');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const refreshMainData = useCallback(async () => {
    await loadMaterials();
    await loadKeysAndHolders();
    await loadDashboardSummary();
  }, [loadDashboardSummary, loadMaterials, loadKeysAndHolders]);

  useEffect(() => {
    if (didBoot.current) return;

    didBoot.current = true;

    const boot = async () => {
      try {
        setInitialLoading(true);

        await loadMaterials();
        await loadKeysAndHolders();
        await loadRequests();
        await loadDashboardSummary();
      } catch (error: any) {
        console.warn('Algumas informações do dashboard não puderam ser carregadas:', error);
      } finally {
        setInitialLoading(false);
      }
    };

    boot();
  }, [
    loadMaterials,
    loadKeysAndHolders,
    loadRequests,
    loadDashboardSummary,
  ]);

  useEffect(() => {
    if (!initialLoading) {
      loadMaterials();
    }
  }, [loadMaterials, initialLoading]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }

    if (activeTab === 'cautions') {
      loadRequests();
    }

    if (activeTab === 'alterations') {
      loadAlterations();
    }

    if (activeTab === 'members') {
      loadUsers();
    }

    if (activeTab === 'keys') {
      loadKeysAndHolders();
    }
  }, [
    activeTab,
    loadHistory,
    loadRequests,
    loadAlterations,
    loadUsers,
    loadKeysAndHolders,
  ]);

  useEffect(() => {
    let unsubscribers: Array<() => void> = [];
    let disposed = false;

    const setupSubscriptions = async () => {
      try {
        const refreshEverything = async () => {
          await refreshMainData();

          if (activeTab === 'history') await loadHistory();
          if (activeTab === 'cautions') await loadRequests();
          if (activeTab === 'alterations') await loadAlterations();
          if (activeTab === 'members') await loadUsers();
        };

        const materialsUnsubscribe = await pb.collection('materials').subscribe('*', refreshEverything);
        const cautionsUnsubscribe = await pb.collection('cautions').subscribe('*', refreshEverything);
        const requestsUnsubscribe = await pb.collection('access_requests').subscribe('*', async () => {
          await loadDashboardSummary();
          if (activeTab === 'cautions') await loadRequests();
        });
        const alterationsUnsubscribe = await pb.collection('alterations').subscribe('*', async () => {
          await loadDashboardSummary();
          if (activeTab === 'alterations') await loadAlterations();
        });
        const keysUnsubscribe = await pb.collection('keys_control').subscribe('*', loadKeysAndHolders);

        if (!disposed) {
          unsubscribers = [
            materialsUnsubscribe,
            cautionsUnsubscribe,
            requestsUnsubscribe,
            alterationsUnsubscribe,
            keysUnsubscribe,
          ];
        }
      } catch (error) {
        console.error('Erro ao configurar inscrições em tempo real:', error);
      }
    };

    setupSubscriptions();

    return () => {
      disposed = true;
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [
    activeTab,
    refreshMainData,
    loadDashboardSummary,
    loadHistory,
    loadRequests,
    loadAlterations,
    loadUsers,
    loadKeysAndHolders,
  ]);

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    try {
      await pb.collection('users').update(userId, { role: newRole });

      setUsers(previousUsers =>
        previousUsers.map(user =>
          user.id === userId ? { ...user, role: newRole } : user,
        ),
      );

      alert('Função do membro atualizada com sucesso.');
    } catch (error) {
      console.error('Erro ao atualizar função:', error);
      alert('Erro ao atualizar função do membro.');
    }
  };

  const handleAddMaterial = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      await pb.collection('materials').create({
        ...materialForm,
        status: 'available',
        lastUpdatedBy: profile?.warName,
      });

      setIsAddingMaterial(false);
      setMaterialForm({
        name: '',
        description: '',
        currentLocation: 'Depósito Central',
        category: 'Outros',
      });

      await refreshMainData();
    } catch (error) {
      console.error('Erro ao adicionar material:', error);
      alert('Erro ao adicionar material.');
    }
  };

  const handleUpdateMaterial = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isEditingMaterial || !alterationForm.document) {
      alert('O documento de alteração é obrigatório.');
      return;
    }

    try {
      const formData = new FormData();

      formData.append('materialId', isEditingMaterial.id);
      formData.append('explanation', alterationForm.explanation);
      formData.append('document', alterationForm.document);
      formData.append('type', 'update');
      formData.append('status', profile?.role === 'director' ? 'approved' : 'pending');
      formData.append('changedBy', profile?.warName || '');

      await pb.collection('alterations').create(formData);

      if (profile?.role === 'director') {
        await pb.collection('materials').update(isEditingMaterial.id, {
          ...materialForm,
          lastUpdatedBy: profile?.warName,
        });

        alert('Alteração realizada e aprovada com sucesso.');
      } else {
        alert('Solicitação de alteração enviada para aprovação do diretor.');
      }

      setIsEditingMaterial(null);
      setAlterationForm({
        explanation: '',
        document: null,
      });

      await refreshMainData();
      await loadAlterations();
    } catch (error) {
      console.error('Erro ao atualizar material:', error);
      alert('Erro ao atualizar material.');
    }
  };

  const handleApproveAlteration = async (alteration: MaterialAlteration) => {
    try {
      if (alteration.type === 'removal') {
        await pb.collection('materials').delete(alteration.materialId);
      }

      await pb.collection('alterations').update(alteration.id, {
        status: 'approved',
      });

      alert('Alteração aprovada.');

      await refreshMainData();
      await loadAlterations();
    } catch (error) {
      console.error('Erro ao aprovar alteração:', error);
      alert('Erro ao aprovar alteração.');
    }
  };

  const handleRemoveMaterial = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isRemovingMaterial || !alterationForm.document) {
      alert('O documento de remoção é obrigatório.');
      return;
    }

    try {
      const formData = new FormData();

      formData.append('materialId', isRemovingMaterial.id);
      formData.append('explanation', alterationForm.explanation);
      formData.append('document', alterationForm.document);
      formData.append('type', 'removal');
      formData.append('status', 'pending');
      formData.append('changedBy', profile?.warName || '');

      await pb.collection('alterations').create(formData);

      alert('Solicitação de remoção enviada para aprovação do diretor.');

      setIsRemovingMaterial(null);
      setAlterationForm({
        explanation: '',
        document: null,
      });

      await loadDashboardSummary();
      await loadAlterations();
    } catch (error) {
      console.error('Erro ao remover material:', error);
      alert('Erro ao solicitar remoção.');
    }
  };

  const handleCreateCaution = async (
    materialId: string,
    materialName: string,
    userId: string,
    userName: string,
  ) => {
    try {
      await pb.collection('cautions').create({
        materialId,
        materialName,
        userId,
        userName,
        keyUsed: '-',
        cautionedAt: new Date().toISOString(),
        status: 'active',
      });

      await pb.collection('materials').update(materialId, {
        status: 'cautioned',
        currentLocation: `Com ${userName}`,
      });

      alert('Material cautelado com sucesso.');

      await refreshMainData();
      if (activeTab === 'history') await loadHistory();
    } catch (error) {
      console.error('Erro ao criar cautela:', error);
      alert('Erro ao cautelar material.');
    }
  };

  const handleReturnMaterial = async (caution: Caution) => {
    try {
      await pb.collection('cautions').update(caution.id, {
        status: 'completed',
        returnedAt: new Date().toISOString(),
      });

      await pb.collection('materials').update(caution.materialId, {
        status: 'available',
        lastUpdatedBy: profile?.warName,
      });

      alert('Material devolvido com sucesso.');

      await refreshMainData();
      if (activeTab === 'history') await loadHistory();
    } catch (error) {
      console.error('Erro ao devolver material:', error);
      alert('Erro ao devolver material.');
    }
  };

  const handleRejectOrVetoRequest = async (
    id: string,
    status: 'rejected' | 'vetoed',
  ) => {
    console.log(`Iniciando ${status} para o pedido: ${id}`);
    try {
      const data: any = { status };

      if (status === 'vetoed') {
        data.vetoedBy = profile?.warName || 'Diretor';
      }

      await pb.collection('access_requests').update(id, data);
      console.log(`Pedido ${id} atualizado para ${status} com sucesso.`);

      alert(status === 'rejected' ? 'Pedido rejeitado com sucesso.' : 'Pedido vetado com sucesso.');

      await loadRequests();
      await loadDashboardSummary();
    } catch (error: any) {
      console.error(`Erro ao processar ${status}:`, error);
      const errorMsg = error.data?.message || error.message || 'Erro desconhecido';
      alert(`Erro ao atualizar solicitação: ${errorMsg}`);
    }
  };

  const handleApproveRequest = async () => {
    if (!requestApproval) return;

    const currentUserId = pb.authStore.model?.id || profile?.id;
    if (!currentUserId) {
      alert('Erro: ID do diretor não encontrado. Tente fazer login novamente.');
      return;
    }

    console.log('Iniciando aprovação do pedido:', requestApproval.id);

    try {
      const request = requestApproval;

      // 1. Atualizar a solicitação
      await pb.collection('access_requests').update(request.id, {
        status: 'approved',
        authorizedBy: profile?.warName || 'Diretor',
      });
      console.log('Solicitação marcada como aprovada.');

      // 2. Criar a cautela real
      await handleCreateCaution(
        request.materialId,
        request.materialName,
        currentUserId,
        request.requesterName,
      );

      console.log('Fluxo de aprovação concluído com sucesso.');
      setRequestApproval(null);

      // 3. Recarregar dados
      await loadRequests();
      await loadDashboardSummary();
    } catch (error: any) {
      console.error('Erro no fluxo de aprovação:', error);
      const errorMsg = error.data?.message || error.message || 'Erro desconhecido';
      alert(`Erro ao aprovar solicitação: ${errorMsg}`);
    }
  };

  const openEditMaterialModal = (material: Material) => {
    setIsEditingMaterial(material);
    setMaterialForm({
      name: material.name,
      description: material.description,
      currentLocation: material.currentLocation,
      category: material.category || 'Outros',
    });
  };

  const openRemoveMaterialModal = (material: Material) => {
    setIsRemovingMaterial(material);
    setAlterationForm({
      explanation: '',
      document: null,
    });
  };

  const openDirectCautionModal = (material: Material) => {
    setIsDirectCautioning(material);
    setDirectCautionForm({
      person: '',
      keyId: '',
    });
  };

  if (initialLoading) {
    return (
      <div className="mx-auto flex min-h-[420px] max-w-6xl items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-500 shadow-sm">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Carregando dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 pb-12">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-slate-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Painel do Diretor
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">
              Controle de Carga e Chaves
            </h1>

            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-300">
              Visão consolidada de materiais, cautelas, solicitações e posse atual das chaves cadastradas.
            </p>
          </div>

          <button
            onClick={refreshMainData}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white px-4 py-3 text-sm font-black text-slate-900 shadow-lg transition-all hover:bg-slate-100"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar dados
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Carga Total
            </p>
            <p className="mt-3 text-3xl font-black">{summary.totalMaterials}</p>
            <p className="mt-1 text-xs font-bold text-slate-400">materiais cadastrados</p>
          </div>

          <div className="rounded-3xl border border-green-400/20 bg-green-400/10 p-5 backdrop-blur">
            <p className="text-[10px] font-black uppercase tracking-widest text-green-300">
              Disponíveis
            </p>
            <p className="mt-3 text-3xl font-black text-green-300">{summary.availableMaterials}</p>
            <p className="mt-1 text-xs font-bold text-green-200/70">prontos para cautela</p>
          </div>

          <div className="rounded-3xl border border-orange-400/20 bg-orange-400/10 p-5 backdrop-blur">
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-300">
              Cautelados
            </p>
            <p className="mt-3 text-3xl font-black text-orange-300">{summary.cautionedMaterials}</p>
            <p className="mt-1 text-xs font-bold text-orange-200/70">fora do depósito</p>
          </div>

          <div className="rounded-3xl border border-blue-400/20 bg-blue-400/10 p-5 backdrop-blur">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">
              Solicitações
            </p>
            <p className="mt-3 text-3xl font-black text-blue-300">{summary.pendingRequests}</p>
            <p className="mt-1 text-xs font-bold text-blue-200/70">pendentes</p>
          </div>

          <div className="rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-5 backdrop-blur">
            <p className="text-[10px] font-black uppercase tracking-widest text-yellow-300">
              Alterações
            </p>
            <p className="mt-3 text-3xl font-black text-yellow-300">{summary.pendingAlterations}</p>
            <p className="mt-1 text-xs font-bold text-yellow-200/70">aguardando aprovação</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Chaves em posse
            </p>
            <p className="mt-3 text-3xl font-black">{usedKeys.length}</p>
            <p className="mt-1 text-xs font-bold text-slate-400">
              de {keyRows.length} cadastradas
            </p>
          </div>
        </div>
      </section>

      <header className="sticky top-3 z-30 rounded-3xl border border-slate-200 bg-white/90 p-2 shadow-sm backdrop-blur">
        <div className="flex gap-2 overflow-x-auto">
          {([
            { id: 'inventory', label: 'Inventário', Icon: Package },
            { id: 'keys', label: 'Chaves', Icon: Key },
            { id: 'history', label: 'Operações', Icon: History },
            { id: 'cautions', label: 'Cautelas', Icon: ListChecks },
            { id: 'alterations', label: 'Alterações', Icon: FileText },
            { id: 'members', label: 'Membros', Icon: Users },
          ] as Array<{ id: DashboardTab; label: string; Icon: any }>).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-wider transition-all ${activeTab === id
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'inventory' && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
                  <Package className="h-5 w-5 text-slate-400" />
                  Controle de Carga
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Busca e paginação feitas direto no PocketBase para evitar carregar todo o acervo.
                </p>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative md:w-80">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar nome, descrição ou localização..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-semibold outline-none transition-all focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                    value={searchTerm}
                    onChange={event => {
                      setSearchTerm(event.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>

                <button
                  onClick={() => setIsAddingMaterial(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white shadow-lg shadow-slate-200 transition-colors hover:bg-black"
                >
                  <Plus className="h-4 w-4" />
                  Novo Material
                </button>
              </div>
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
              {['Todos', ...CATEGORIES].map(category => (
                <button
                  key={category}
                  onClick={() => {
                    setSelectedCategory(category);
                    setCurrentPage(1);
                  }}
                  className={`shrink-0 rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-wider transition-all ${selectedCategory === category
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <p className="text-xs font-bold text-slate-500">
                {materialsLoading ? 'Buscando materiais...' : `${materialsTotal} material(is) encontrado(s)`}
              </p>
              {materialsLoading && <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-white">
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">
                      Material
                    </th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">
                      Descrição
                    </th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">
                      Localização
                    </th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-widest text-slate-500">
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {!materialsLoading && materials.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
                        Nenhum material encontrado.
                      </td>
                    </tr>
                  )}

                  {materials.map(material => (
                    <tr key={material.id} className="group transition-colors hover:bg-slate-50/80">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-800">{material.name}</span>
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            {material.category || 'Outros'}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <p className="max-w-xs truncate text-xs font-medium text-slate-500">
                          {material.description}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                          <MapPin className="h-3.5 w-3.5" />
                          {material.currentLocation}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${statusBadgeClass(
                            material.status,
                          )}`}
                        >
                          {statusLabel(material.status)}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                          <button
                            onClick={() => openEditMaterialModal(material)}
                            className="rounded-xl p-2 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => openRemoveMaterialModal(material)}
                            className="rounded-xl p-2 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
                            title="Remover"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>

                          {material.status === 'available' && (
                            <button
                              onClick={() => openDirectCautionModal(material)}
                              className="rounded-xl p-2 text-blue-500 transition-all hover:bg-blue-50 hover:text-blue-700"
                              title="Cautelar direto"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-semibold text-slate-500">
                Mostrando{' '}
                <span className="font-black text-slate-900">
                  {materials.length ? (currentPage - 1) * MATERIALS_PER_PAGE + 1 : 0}
                </span>{' '}
                a{' '}
                <span className="font-black text-slate-900">
                  {Math.min(materialsTotal, currentPage * MATERIALS_PER_PAGE)}
                </span>{' '}
                de <span className="font-black text-slate-900">{materialsTotal}</span>
              </div>

              {renderPagination(currentPage, materialsTotalPages, nextPage => {
                setCurrentPage(nextPage);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              })}
            </div>
          </div>
        </motion.section>
      )}

      {activeTab === 'keys' && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
                  <Key className="h-5 w-5 text-slate-400" />
                  Controle de Chaves
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Cada chave cadastrada exibe se está livre ou quem está em posse no momento.
                </p>
              </div>

              <div className="relative xl:w-96">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={keySearch}
                  onChange={event => setKeySearch(event.target.value)}
                  placeholder="Buscar chave, detentor ou material..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-semibold outline-none transition-all focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Chaves cadastradas
                </p>
                <p className="mt-2 text-3xl font-black text-slate-900">{keyRows.length}</p>
              </div>

              <div className="rounded-2xl bg-orange-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                  Em posse
                </p>
                <p className="mt-2 text-3xl font-black text-orange-600">{usedKeys.length}</p>
              </div>

              <div className="rounded-2xl bg-green-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-green-600">
                  Disponíveis
                </p>
                <p className="mt-2 text-3xl font-black text-green-700">{availableKeys.length}</p>
              </div>
            </div>
          </div>

          {keysLoading && (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-500 shadow-sm">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Atualizando chaves...
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleKeyRows.map(({ key, holder }) => (
              <div
                key={key.id}
                className={`rounded-3xl border p-5 shadow-sm transition-all ${holder
                  ? 'border-orange-200 bg-orange-50/60 hover:shadow-md'
                  : 'border-green-200 bg-white hover:shadow-md'
                  }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                      Chave
                    </p>
                    <h3 className="mt-1 text-2xl font-black text-slate-900">{key.name}</h3>
                  </div>

                  <span
                    className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${holder
                      ? 'border-orange-200 bg-orange-100 text-orange-700'
                      : 'border-green-200 bg-green-100 text-green-700'
                      }`}
                  >
                    {holder ? 'Em posse' : 'Livre'}
                  </span>
                </div>

                {holder ? (
                  <div className="mt-5 space-y-3">
                    <div className="flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-orange-100">
                      <UserRound className="mt-0.5 h-4 w-4 text-orange-500" />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Detentor atual
                        </p>
                        <p className="text-sm font-black text-slate-800">
                          {holder.userName || 'Não informado'}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white p-4 ring-1 ring-orange-100">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Material vinculado
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-800">
                        {holder.materialName || '-'}
                      </p>
                      <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                        <Clock className="h-3.5 w-3.5" />
                        Cautelado em {formatDateTime(holder.cautionedAt)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700">
                    Esta chave está disponível para nova cautela.
                  </div>
                )}
              </div>
            ))}
          </div>

          {!keysLoading && visibleKeyRows.length === 0 && (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-500 shadow-sm">
              Nenhuma chave encontrada para a busca informada.
            </div>
          )}
        </motion.section>
      )}

      {activeTab === 'history' && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
                  <History className="h-5 w-5 text-slate-400" />
                  Operações de Cautela
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Histórico paginado, com busca por material, pessoa ou chave.
                </p>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative md:w-80">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={historySearch}
                    onChange={event => {
                      setHistorySearch(event.target.value);
                      setHistoryPage(1);
                    }}
                    placeholder="Buscar material, pessoa ou chave..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-semibold outline-none transition-all focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                  />
                </div>

                <select
                  value={historyStatus}
                  onChange={event => {
                    setHistoryStatus(event.target.value as HistoryStatus);
                    setHistoryPage(1);
                  }}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-600 outline-none transition-all focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                >
                  <option value="all">Todos os status</option>
                  <option value="active">Somente ativos</option>
                  <option value="completed">Somente concluídos</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <p className="text-xs font-bold text-slate-500">
                {historyLoading ? 'Buscando operações...' : `${historyTotal} operação(ões) encontrada(s)`}
              </p>
              {historyLoading && <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-white">
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">
                      Material
                    </th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">
                      Pessoa
                    </th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">
                      Chave
                    </th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">
                      Cautela
                    </th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">
                      Devolução
                    </th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {!historyLoading && history.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
                        Nenhuma operação encontrada.
                      </td>
                    </tr>
                  )}

                  {history.map(caution => (
                    <tr key={caution.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-6 py-4 font-black text-slate-800">{caution.materialName}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-600">{caution.userName}</td>
                      <td className="px-6 py-4">
                        <span className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-black text-slate-600">
                          {caution.keyUsed === '-' ? 'N/A' : caution.keyUsed}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-500">
                        {formatDateTime(caution.cautionedAt)}
                      </td>
                      <td className="px-6 py-4">
                        {caution.status === 'active' ? (
                          <button
                            onClick={() => handleReturnMaterial(caution)}
                            className="rounded-xl bg-slate-900 px-3 py-1.5 text-[10px] font-black text-white transition-all hover:bg-black"
                          >
                            Devolver
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-slate-500">
                            {formatDateTime(caution.returnedAt)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${statusBadgeClass(
                            caution.status,
                          )}`}
                        >
                          {statusLabel(caution.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-semibold text-slate-500">
                Mostrando{' '}
                <span className="font-black text-slate-900">
                  {history.length ? (historyPage - 1) * HISTORY_PER_PAGE + 1 : 0}
                </span>{' '}
                a{' '}
                <span className="font-black text-slate-900">
                  {Math.min(historyTotal, historyPage * HISTORY_PER_PAGE)}
                </span>{' '}
                de <span className="font-black text-slate-900">{historyTotal}</span>
              </div>

              {renderPagination(historyPage, historyTotalPages, nextPage => {
                setHistoryPage(nextPage);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              })}
            </div>
          </div>
        </motion.section>
      )}

      {activeTab === 'cautions' && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">Solicitações de Cautela</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Aprove solicitações de materiais aqui.
              </p>
            </div>

            <div className="rounded-2xl bg-blue-50 px-4 py-3 text-xs font-black text-blue-700 ring-1 ring-blue-100">
              {requestsLoading
                ? 'Carregando solicitações...'
                : `${cautionRequests.filter(request => request.status === 'pending').length} pendente(s)`}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {cautionRequests.map(request => (
              <div key={request.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">{request.requesterName}</h3>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      Material: {request.materialName}
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${statusBadgeClass(
                      request.status,
                    )}`}
                  >
                    {statusLabel(request.status)}
                  </span>
                </div>

                {request.plannedDateTime && (
                  <p className="mt-4 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-blue-600">
                    <Clock className="h-3.5 w-3.5" />
                    Previsto: {new Date(request.plannedDateTime).toLocaleString('pt-BR')}
                  </p>
                )}

                {request.reason && (
                  <p className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs font-medium italic leading-5 text-slate-600">
                    “{request.reason}”
                  </p>
                )}

                {request.notes && (
                  <p className="mt-3 text-[11px] font-semibold text-slate-400">
                    OBS: {request.notes}
                  </p>
                )}

                {request.status === 'pending' && (
                  <div className="mt-5 flex gap-2">
                    <button
                      onClick={() => {
                        setRequestApproval(request);
                        setApprovalKey('');
                      }}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-green-600 py-3 text-sm font-black text-white transition-colors hover:bg-green-700"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Aprovar
                    </button>

                    <button
                      onClick={() => handleRejectOrVetoRequest(request.id, 'rejected')}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-red-500 py-3 text-sm font-black text-white transition-colors hover:bg-red-600"
                    >
                      <XCircle className="h-4 w-4" />
                      Rejeitar
                    </button>

                    {canVeto && (
                      <button
                        onClick={() => handleRejectOrVetoRequest(request.id, 'vetoed')}
                        className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-black"
                        title="Vetar apenas como diretor"
                      >
                        Veto
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {activeTab === 'alterations' && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
              <FileText className="h-5 w-5 text-slate-400" />
              Relatórios e Aprovações de Carga
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Últimas alterações carregadas sob demanda.
            </p>
          </div>

          {alterationsLoading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-bold text-slate-500 shadow-sm">
              Carregando alterações...
            </div>
          )}

          {!alterationsLoading && alterations.length === 0 && (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-500 shadow-sm">
              Nenhuma alteração registrada.
            </div>
          )}

          {alterations.map(alteration => (
            <div
              key={alteration.id}
              className={`rounded-3xl border bg-white p-6 shadow-sm ${alteration.status === 'approved'
                ? 'border-l-4 border-l-green-500'
                : 'border-l-4 border-l-yellow-500'
                }`}
            >
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${alteration.type === 'removal'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                        }`}
                    >
                      {alteration.type === 'removal' ? 'Remoção' : 'Atualização'}
                    </span>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${statusBadgeClass(
                        alteration.status,
                      )}`}
                    >
                      {statusLabel(alteration.status)}
                    </span>
                  </div>

                  <h3 className="font-black text-slate-800">
                    Material:{' '}
                    {materials.find(material => material.id === alteration.materialId)?.name ||
                      alteration.materialId ||
                      'N/A'}
                  </h3>

                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    Registrado em: {formatDateTime(alteration.created)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase text-slate-500">
                    Por: {alteration.changedBy}
                  </div>

                  {alteration.status === 'pending' && profile?.role === 'director' && (
                    <button
                      onClick={() => handleApproveAlteration(alteration)}
                      className="rounded-full bg-green-600 px-3 py-1 text-[10px] font-black text-white shadow-sm transition-all hover:bg-green-700"
                    >
                      Aprovar
                    </button>
                  )}
                </div>
              </div>

              <p className="mb-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm italic leading-6 text-slate-600">
                “{alteration.explanation}”
              </p>

              {alteration.document && (
                <a
                  href={pb.getFileUrl(alteration, alteration.document)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-black text-blue-600 underline"
                >
                  <FileText className="h-4 w-4" />
                  Ver Documento Oficial
                </a>
              )}
            </div>
          ))}
        </motion.section>
      )}

      {activeTab === 'members' && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
              <Users className="h-5 w-5 text-slate-400" />
              Gerenciamento de Membros
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Carregado apenas quando a aba é aberta.
            </p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">
                      Membro
                    </th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">
                      Nº Ordem
                    </th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">
                      Email
                    </th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">
                      Função Atual
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-widest text-slate-500">
                      Alterar Função
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {usersLoading && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-sm font-bold text-slate-500">
                        Carregando membros...
                      </td>
                    </tr>
                  )}

                  {!usersLoading &&
                    users.map(user => (
                      <tr key={user.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-black text-slate-800">{user.name || user.username}</span>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                              {user.warName || 'Sem nome de guerra'}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-sm font-semibold text-slate-500">
                          {user.entryNumber || '-'}
                        </td>

                        <td className="px-6 py-4 text-sm font-semibold text-slate-500">
                          {user.email}
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${user.role === 'director'
                              ? 'bg-purple-100 text-purple-700'
                              : user.role === 'assessor'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-slate-100 text-slate-700'
                              }`}
                          >
                            {user.role}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <select
                            className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-black text-slate-600 outline-none transition-all focus:ring-4 focus:ring-blue-50"
                            value={user.role}
                            onChange={event => handleUpdateUserRole(user.id, event.target.value)}
                          >
                            <option value="assessor">Assessor</option>
                            <option value="director">Diretor</option>
                            <option value="subdirector">Subdiretor</option>
                            <option value="coordinator">Coordenador</option>
                            <option value="public">Público</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.section>
      )}

      {isAddingMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"
          >
            <h2 className="text-2xl font-black text-slate-900">Novo Material Carga</h2>

            <form onSubmit={handleAddMaterial} className="mt-6 space-y-4">
              <select
                required
                className="w-full rounded-2xl border border-slate-200 p-3 outline-none focus:ring-4 focus:ring-blue-50"
                value={materialForm.category}
                onChange={event => setMaterialForm({ ...materialForm, category: event.target.value })}
              >
                {CATEGORIES.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <input
                required
                placeholder="Nome do Material"
                className="w-full rounded-2xl border border-slate-200 p-3 outline-none focus:ring-4 focus:ring-blue-50"
                value={materialForm.name}
                onChange={event => setMaterialForm({ ...materialForm, name: event.target.value })}
              />

              <textarea
                required
                placeholder="Descrição técnica"
                className="h-24 w-full rounded-2xl border border-slate-200 p-3 outline-none focus:ring-4 focus:ring-blue-50"
                value={materialForm.description}
                onChange={event => setMaterialForm({ ...materialForm, description: event.target.value })}
              />

              <input
                required
                placeholder="Localização inicial"
                className="w-full rounded-2xl border border-slate-200 p-3 outline-none focus:ring-4 focus:ring-blue-50"
                value={materialForm.currentLocation}
                onChange={event => setMaterialForm({ ...materialForm, currentLocation: event.target.value })}
              />

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddingMaterial(false)}
                  className="flex-1 rounded-2xl border border-slate-200 py-3 font-black text-slate-500 transition-colors hover:bg-slate-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="flex-1 rounded-2xl bg-slate-900 py-3 font-black text-white transition-colors hover:bg-black"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isEditingMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl"
          >
            <h2 className="text-2xl font-black text-slate-900">Alterar Material Carga</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              Toda alteração de material carga requer uma justificativa oficial.
            </p>

            <form onSubmit={handleUpdateMaterial} className="mt-6 space-y-6">
              <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-5">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Novos Dados
                </h3>

                <select
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:ring-4 focus:ring-blue-50"
                  value={materialForm.category}
                  onChange={event => setMaterialForm({ ...materialForm, category: event.target.value })}
                >
                  {CATEGORIES.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <input
                  required
                  placeholder="Nome"
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:ring-4 focus:ring-blue-50"
                  value={materialForm.name}
                  onChange={event => setMaterialForm({ ...materialForm, name: event.target.value })}
                />

                <textarea
                  required
                  placeholder="Descrição"
                  className="h-20 w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:ring-4 focus:ring-blue-50"
                  value={materialForm.description}
                  onChange={event => setMaterialForm({ ...materialForm, description: event.target.value })}
                />

                <input
                  required
                  placeholder="Localização"
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:ring-4 focus:ring-blue-50"
                  value={materialForm.currentLocation}
                  onChange={event => setMaterialForm({ ...materialForm, currentLocation: event.target.value })}
                />
              </div>

              <div className="space-y-4">
                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                  Justificativa e Documento
                </h3>

                <textarea
                  required
                  placeholder="Explique detalhadamente o motivo da alteração da carga..."
                  className="h-32 w-full rounded-2xl border border-blue-100 bg-blue-50/30 p-4 outline-none focus:ring-4 focus:ring-blue-50"
                  value={alterationForm.explanation}
                  onChange={event => setAlterationForm({ ...alterationForm, explanation: event.target.value })}
                />

                <input
                  type="file"
                  required
                  className="w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:ring-4 focus:ring-blue-50"
                  onChange={event =>
                    setAlterationForm({
                      ...alterationForm,
                      document: event.target.files?.[0] || null,
                    })
                  }
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditingMaterial(null)}
                  className="flex-1 rounded-2xl border border-slate-200 py-3 font-black text-slate-500 transition-colors hover:bg-slate-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="flex-1 rounded-2xl bg-blue-600 py-3 font-black text-white shadow-lg shadow-blue-100 transition-colors hover:bg-blue-700"
                >
                  Registrar
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isDirectCautioning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"
          >
            <h2 className="text-2xl font-black text-slate-900">
              Cautelar: {isDirectCautioning.name}
            </h2>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Quem está recebendo?
                </label>
                <input
                  required
                  placeholder="Nome do detentor"
                  className="w-full rounded-2xl border border-slate-200 p-3 outline-none focus:ring-4 focus:ring-blue-50"
                  value={directCautionForm.person}
                  onChange={event => setDirectCautionForm({ ...directCautionForm, person: event.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsDirectCautioning(null)}
                  className="flex-1 rounded-2xl border border-slate-200 py-3 font-black text-slate-500 transition-colors hover:bg-slate-50"
                >
                  Cancelar
                </button>

                <button
                  onClick={() => {
                    if (directCautionForm.person) {
                      handleCreateCaution(
                        isDirectCautioning.id,
                        isDirectCautioning.name,
                        pb.authStore.model?.id,
                        directCautionForm.person,
                      );
                      setIsDirectCautioning(null);
                    }
                  }}
                  className="flex-1 rounded-2xl bg-blue-600 py-3 font-black text-white shadow-lg shadow-blue-100 transition-colors hover:bg-blue-700"
                >
                  Finalizar
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {requestApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"
          >
            <h2 className="text-2xl font-black text-slate-900">Aprovar cautela</h2>

            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Material solicitado
              </p>
              <p className="mt-1 font-black text-slate-900">{requestApproval.materialName}</p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setRequestApproval(null);
                }}
                className="flex-1 rounded-2xl border border-slate-200 py-3 font-black text-slate-500 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                onClick={handleApproveRequest}
                className="flex-1 rounded-2xl bg-green-600 py-3 font-black text-white shadow-lg shadow-green-100 transition-colors hover:bg-green-700"
              >
                Aprovar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {isRemovingMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl"
          >
            <h2 className="text-2xl font-black text-slate-900">Remover Material da Carga</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              A remoção definitiva requer aprovação do diretor e documento anexado.
            </p>

            <form onSubmit={handleRemoveMaterial} className="mt-6 space-y-6">
              <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <p className="text-sm font-black text-red-700">
                  Removendo: {isRemovingMaterial.name}
                </p>
              </div>

              <textarea
                required
                placeholder="Explique o motivo da baixa do material..."
                className="h-32 w-full rounded-2xl border border-slate-200 p-4 outline-none focus:ring-4 focus:ring-blue-50"
                value={alterationForm.explanation}
                onChange={event => setAlterationForm({ ...alterationForm, explanation: event.target.value })}
              />

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">
                  Documento de baixa
                </label>
                <input
                  type="file"
                  required
                  className="w-full rounded-2xl border border-slate-200 p-3"
                  onChange={event =>
                    setAlterationForm({
                      ...alterationForm,
                      document: event.target.files?.[0] || null,
                    })
                  }
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsRemovingMaterial(null)}
                  className="flex-1 rounded-2xl border border-slate-200 py-3 font-black text-slate-500 transition-colors hover:bg-slate-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="flex-1 rounded-2xl bg-red-600 py-3 font-black text-white transition-colors hover:bg-red-700"
                >
                  Solicitar Remoção
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}