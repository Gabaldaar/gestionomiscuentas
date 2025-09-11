
'use client';

import * as React from 'react';
import { Wallet, Landmark, CreditCard, Home, Briefcase, PiggyBank, type LucideIcon } from 'lucide-react';

export const walletIcons = {
    Wallet,
    Landmark,
    CreditCard,
    Home,
    Briefcase,
    PiggyBank,
} as const;

export type WalletIconName = keyof typeof walletIcons;

export const WalletIcon = ({ name, ...props }: { name: WalletIconName } & React.ComponentProps<LucideIcon>) => {
    const IconComponent = walletIcons[name];
    if (!IconComponent) return null;
    return <IconComponent {...props} />;
};
