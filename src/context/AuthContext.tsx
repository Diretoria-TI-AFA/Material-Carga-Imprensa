import React, { createContext, useContext, useEffect, useState } from 'react';
import { pb } from '../lib/pb';
import { UserProfile } from '../types';

interface AuthContextType {
  user: any;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(pb.authStore.model);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthContext: Initializing...', { hasModel: !!pb.authStore.model });
    
    // Escuta mudanças na autenticação
    const unsubscribe = pb.authStore.onChange((token, model) => {
      console.log('AuthContext: AuthStore changed', { modelId: model?.id });
      setUser(model);
      if (model) {
        setProfile(model as unknown as UserProfile);
      } else {
        setProfile(null);
      }
    }, true);

    if (pb.authStore.model) {
      console.log('AuthContext: Setting initial profile from model');
      setProfile(pb.authStore.model as unknown as UserProfile);
    }
    
    setLoading(false);
    return () => unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (pb.authStore.model) {
      const freshModel = await pb.collection('users').getOne(pb.authStore.model.id);
      setProfile(freshModel as unknown as UserProfile);
    }
  };

  const isAdmin = profile?.role === 'director' || profile?.role === 'subdirector' || profile?.role === 'coordinator';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
