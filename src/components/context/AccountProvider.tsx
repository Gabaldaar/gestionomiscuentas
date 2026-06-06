
'use client';

import * as React from 'react';
import { useAuth } from '../auth/AuthProvider';

type AccountContextType = {
  activeAccountId: string; // 'all' or a property ID
  setActiveAccountId: (accountId: string) => void;
};

const AccountContext = React.createContext<AccountContextType | undefined>(undefined);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeAccountId, setActiveAccountIdState] = React.useState<string>('all');
  const [isInitialized, setIsInitialized] = React.useState(false);

  // Load from localStorage on initial mount
  React.useEffect(() => {
    if (user) {
      const storedAccountId = localStorage.getItem(`activeAccountId_${user.uid}`);
      if (storedAccountId) {
        setActiveAccountIdState(storedAccountId);
      }
    }
    setIsInitialized(true);
  }, [user]);

  const setActiveAccountId = (accountId: string) => {
    setActiveAccountIdState(accountId);
    if (user) {
      localStorage.setItem(`activeAccountId_${user.uid}`, accountId);
    }
  };
  
  if (!isInitialized) {
    return null; // Or a loader, but the main loader is in AuthProvider
  }

  return (
    <AccountContext.Provider value={{ activeAccountId, setActiveAccountId }}>
      {children}
    </AccountContext.Provider>
  );
}

export const useAccount = () => {
  const context = React.useContext(AccountContext);
  if (context === undefined) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
};
