'use client';

import * as React from 'react';
import { useAccount } from '@/components/context/AccountProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { type Property } from '@/lib/types';
import { Building2, CircleUser } from 'lucide-react';
import Image from 'next/image';

export function AccountSelector() {
  const { activeAccountId, setActiveAccountId } = useAccount();
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchProperties = async () => {
      setLoading(true);
      const propsQuery = query(collection(db, 'properties'), orderBy('order'));
      const propsSnap = await getDocs(propsQuery);
      const propsList = propsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
      setProperties(propsList);
      setLoading(false);
    };
    fetchProperties();
  }, []);
  
  const activeProperty = properties.find(p => p.id === activeAccountId);

  if (loading) {
    return <div className="h-9 w-48 rounded-md bg-muted animate-pulse" />;
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={activeAccountId} onValueChange={setActiveAccountId}>
        <SelectTrigger className="w-auto min-w-[180px] max-w-xs truncate border-none bg-transparent shadow-none focus:ring-0">
          <SelectValue asChild>
            <div className='flex items-center gap-2'>
              {activeProperty ? (
                <Image src={activeProperty.imageUrl} alt={activeProperty.name} width={24} height={24} className="rounded-sm object-cover" />
              ) : (
                <Building2 className="h-5 w-5 text-muted-foreground" />
              )}
              <span>{activeProperty?.name || 'Todas las Cuentas'}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <div className='flex items-center gap-2'>
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <span>Todas las Cuentas</span>
            </div>
          </SelectItem>
          {properties.map(prop => (
            <SelectItem key={prop.id} value={prop.id}>
              <div className='flex items-center gap-2'>
                <Image src={prop.imageUrl} alt={prop.name} width={24} height={24} className="rounded-sm object-cover" />
                <span>{prop.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
