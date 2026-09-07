'use client';

import * as React from 'react';
import { useAuth } from '../auth/AuthProvider';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { type Property } from '@/lib/types';

type AccountContextType = {
  activeAccountId: string;
  setActiveAccountId: (accountId: string) => void;
  properties: Property[];
  loadingProperties: boolean;
};

const AccountContext = React.createContext<AccountContextType | undefined>(undefined);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeAccountId, setActiveAccountIdState] = React.useState<string>('all');
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [loadingProperties, setLoadingProperties] = React.useState(true);

  // Fetch properties centrally when user is authenticated
  React.useEffect(() => {
    if (!user) {
      setProperties([]);
      setLoadingProperties(false);
      return;
    }

    let isMounted = true;
    const fetchProps = async () => {
      try {
        setLoadingProperties(true);
        const propsQuery = query(collection(db, 'properties'), orderBy('order'));
        const propsSnap = await getDocs(propsQuery);
        const propsList = propsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
        if (isMounted) {
          setProperties(propsList);
          
          const storedAccountId = localStorage.getItem(`activeAccountId_${user.uid}`);
          if (storedAccountId && propsList.some(p => p.id === storedAccountId)) {
            setActiveAccountIdState(storedAccountId);
          } else if (propsList.length > 0) {
            setActiveAccountIdState(propsList[0].id);
            localStorage.setItem(`activeAccountId_${user.uid}`, propsList[0].id);
          }
        }
      } catch (error) {
        console.error("Error fetching properties in AccountProvider:", error);
      } finally {
        if (isMounted) {
          setLoadingProperties(false);
        }
      }
    };

    fetchProps();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const setActiveAccountId = React.useCallback((accountId: string) => {
    setActiveAccountIdState(accountId);
    if (user) {
      localStorage.setItem(`activeAccountId_${user.uid}`, accountId);
    }
  }, [user]);

  const value = React.useMemo(() => ({
    activeAccountId,
    setActiveAccountId,
    properties,
    loadingProperties,
  }), [activeAccountId, setActiveAccountId, properties, loadingProperties]);

  return (
    <AccountContext.Provider value={value}>
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
