'use client';

import * as React from 'react';
import { useAccount } from '@/components/context/AccountProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { type Property } from '@/lib/types';
import { Building2 } from 'lucide-react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';

export function AccountSelector() {
  const { activeAccountId, setActiveAccountId } = useAccount();
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [loading, setLoading] = React.useState(true);
  const pathname = usePathname();
  const router = useRouter();

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

  React.useEffect(() => {
    if (properties.length > 0) {
      const hasValidActive = properties.some(p => p.id === activeAccountId);
      if (!hasValidActive) {
        setActiveAccountId(properties[0].id);
      }
    }
  }, [properties, activeAccountId, setActiveAccountId]);
  
  const activeProperty = properties.find(p => p.id === activeAccountId);

  const handleAccountChange = (val: string) => {
    setActiveAccountId(val);
    if (pathname.startsWith('/properties/') && pathname !== '/properties/new') {
      router.push(`/properties/${val}`);
    }
  };

  if (loading) {
    return <div className="h-9 w-48 rounded-md bg-muted animate-pulse" />;
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={activeAccountId} onValueChange={handleAccountChange}>
        <SelectTrigger className="w-auto min-w-[180px] max-w-xs truncate border-none bg-transparent shadow-none focus:ring-0">
          <SelectValue asChild>
            <div className='flex items-center gap-2'>
              {activeProperty ? (
                <Image src={activeProperty.imageUrl} alt={activeProperty.name} width={24} height={24} className="rounded-sm object-cover" />
              ) : (
                <Building2 className="h-5 w-5 text-muted-foreground" />
              )}
              <span>{activeProperty?.name || 'Seleccionar Cuenta'}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
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
