import React, { useState, useEffect } from 'react';
import { pb } from '../lib/pb';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    console.log('Login: checking user state', { hasUser: !!user });
    if (user) {
      console.log('Login: User detected, navigating to /');
      navigate('/');
    }
  }, [user, navigate]);

  // Form states
const [formData, setFormData] = useState({
    name: '',
    entryNumber: '',
    email: '',
    password: '',
    passwordConfirm: '',
  });

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    console.log('Login: handleAuth started', { isRegistering });

    try {
      if (isRegistering) {
        // Validation
        if (formData.password !== formData.passwordConfirm) {
          throw new Error('As senhas não coincidem');
        }

        if (!formData.entryNumber) {
          throw new Error('O Número de Ordem é obrigatório');
        }

        console.log('Login: Creating user...');
        // Create user
        await pb.collection('users').create({
          email: formData.email,
          password: formData.password,
          passwordConfirm: formData.passwordConfirm,
          name: formData.name,
          entryNumber: formData.entryNumber,
          role: 'public', // Default role
        });
        console.log('Login: User created, logging in...');

        // Auto login after registration
        await pb.collection('users').authWithPassword(formData.email, formData.password);
      } else {
        // Standard login
        console.log('Login: Standard login attempt with:', formData.email);
        await pb.collection('users').authWithPassword(formData.email, formData.password);
      }
      console.log('Login: authWithPassword success. User model:', pb.authStore.model?.id);
    } catch (err: any) {
      console.error('Login: Auth error:', err);
      setError(err.message || 'Erro na autenticação. Verifique os dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-vh-screen bg-slate-50 p-4 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-100"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-blue-500 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-100 mb-6">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">GCM AFA</h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Controle de Materiais de Carga</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold flex items-center shadow-sm">
            <div className="w-2 h-2 bg-red-500 rounded-full mr-3 animate-pulse"></div>
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <AnimatePresence mode="wait">
            {isRegistering && (
              <motion.div
                key="register-fields"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 overflow-hidden"
              >
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    required
                    type="text"
                    placeholder="Nome Completo"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:bg-white outline-none transition-all text-sm font-medium"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="relative">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    required
                    type="text"
                    placeholder="Número de Ordem"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:bg-white outline-none transition-all text-sm font-medium"
                    value={formData.entryNumber}
                    onChange={e => setFormData({ ...formData, entryNumber: e.target.value })}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              required
              type="email"
              placeholder="E-mail"
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:bg-white outline-none transition-all text-sm font-medium"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              required
              type="password"
              placeholder="Senha"
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:bg-white outline-none transition-all text-sm font-medium"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          {isRegistering && (
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                required
                type="password"
                placeholder="Confirmar Senha"
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:bg-white outline-none transition-all text-sm font-medium"
                value={formData.passwordConfirm}
                onChange={e => setFormData({ ...formData, passwordConfirm: e.target.value })}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                <span>{isRegistering ? 'Criar Conta' : 'Entrar'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-widest"
          >
            {isRegistering ? 'Já tem uma conta? Entre aqui' : 'Não tem conta? Registre-se'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
