'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import AuthModal from './AuthModal';

type AuthModalContextType = {
  openAuthModal: (type?: 'login' | 'signup' | 'reset', redirectTo?: string) => void;
  closeAuthModal: () => void;
  isAuthModalOpen: boolean;
};

const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined);

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (context === undefined) {
    throw new Error('useAuthModal must be used within an AuthModalProvider');
  }
  return context;
}

type AuthModalProviderProps = {
  children: ReactNode;
};

export function AuthModalProvider({ children }: AuthModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [authType, setAuthType] = useState<'login' | 'signup' | 'reset'>('login');
  const [redirectTo, setRedirectTo] = useState<string | undefined>();

  const openAuthModal = (type: 'login' | 'signup' | 'reset' = 'login', redirect?: string) => {
    setAuthType(type);
    setRedirectTo(redirect);
    setIsOpen(true);
  };

  const closeAuthModal = () => {
    setIsOpen(false);
    setRedirectTo(undefined);
  };

  return (
    <AuthModalContext.Provider 
      value={{ 
        openAuthModal, 
        closeAuthModal, 
        isAuthModalOpen: isOpen 
      }}
    >
      {children}
      <AuthModal
        isOpen={isOpen}
        onClose={closeAuthModal}
        initialType={authType}
        redirectTo={redirectTo}
      />
    </AuthModalContext.Provider>
  );
}