import PocketBase from 'pocketbase';

const url = (import.meta as any).env.VITE_POCKETBASE_URL || 'https://materialcarga-imprensa.pockethost.io/';

// Garante que pb seja inicializado corretamente
const pb = new PocketBase(url);

// Desativa o auto-cancelamento globalmente para evitar erros de requisições abortadas
pb.autoCancellation(false);

export { pb };

// Helper para lidar com erros do PocketBase
export function handlePBError(error: any) {
  if (error?.isAbort) {
    console.warn('Requisição abortada pelo PocketBase (auto-cancelamento)');
    return;
  }
  console.error('PocketBase Error:', error);
  throw error;
}
