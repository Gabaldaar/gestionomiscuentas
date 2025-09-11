
'use client';

import * as React from 'react';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle, MoreVertical, Pencil, Trash2, Loader, DollarSign, CircleDollarSign } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { type Wallet } from '@/lib/types';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { cn } from '@/lib/utils';
import { WalletIcon, type WalletIconName } from '@/lib/wallet-icons';


export default function WalletsSettingsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [deletingWallet, setDeletingWallet] = React.useState<Wallet | null>(null);


  const fetchWallets = React.useCallback(async () => {
    setLoading(true);
    try {
        const walletsCol = collection(db, 'wallets');
        const walletsSnapshot = await getDocs(walletsCol);
        const walletsList = walletsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Wallet));
        setWallets(walletsList);
    } catch (error) {
        console.error("Error fetching wallets: ", error);
        toast({ title: "Error", description: "No se pudieron cargar las billeteras.", variant: "destructive" });
    } finally {
        setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  const handleDeleteClick = (wallet: Wallet) => {
    setDeletingWallet(wallet);
  };

  const confirmDelete = async () => {
    if (!deletingWallet) return;
    try {
      // TODO: Check if wallet is used in any transaction before deleting
      await deleteDoc(doc(db, 'wallets', deletingWallet.id));
      toast({ title: "Billetera eliminada", description: `La billetera "${deletingWallet.name}" ha sido eliminada.`, variant: "destructive" });
      setDeletingWallet(null);
      fetchWallets(); // Refresh list
    } catch (error) {
      console.error("Error deleting wallet: ", error);
      toast({ title: "Error", description: "No se pudo eliminar la billetera.", variant: "destructive" });
    }
  };
  
  const renderIcon = (wallet: Wallet) => {
    if (wallet.icon) {
        return <WalletIcon name={wallet.icon as WalletIconName} className="h-6 w-6" />;
    }
    return wallet.currency === 'USD' ? <DollarSign className="h-6 w-6" /> : <CircleDollarSign className="h-6 w-6" />;
  };

  return (
    <>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <PageHeader title="Billeteras">
          <Button asChild>
            <Link href="/settings/wallets/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Añadir Billetera
            </Link>
          </Button>
        </PageHeader>
        
        {loading ? (
           <div className="flex justify-center items-center">
              <Loader className="h-8 w-8 animate-spin" />
           </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {wallets.map((wallet) => (
              <Card key={wallet.id}>
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 text-primary p-3 rounded-md">
                        {renderIcon(wallet)}
                      </div>
                      <div>
                          <CardTitle>{wallet.name}</CardTitle>
                          <CardDescription>{wallet.currency}</CardDescription>
                      </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => router.push(`/settings/wallets/${wallet.id}/edit`)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteClick(wallet)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                        </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent>
                  <div className={cn("text-2xl font-bold", {
                    'text-green-800 dark:text-green-400': wallet.currency === 'USD' && wallet.balance > 0,
                    'text-blue-800 dark:text-blue-400': wallet.currency === 'ARS' && wallet.balance > 0,
                    'text-red-500': wallet.balance < 0,
                  })}>
                      {new Intl.NumberFormat('es-AR', { style: 'currency', currency: wallet.currency, minimumFractionDigits: 2 }).format(wallet.balance)}
                  </div>
                  </CardContent>
              </Card>
              ))}
          </div>
        )}
      </div>

      <ConfirmDeleteDialog
        isOpen={!!deletingWallet}
        onOpenChange={() => setDeletingWallet(null)}
        onConfirm={confirmDelete}
        title="¿Eliminar Billetera?"
        description={`¿Estás seguro de que quieres eliminar la billetera "${deletingWallet?.name}"? Esta acción es permanente y no se puede deshacer.`}
      />
    </>
  );
}
