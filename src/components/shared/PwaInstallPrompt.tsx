'use client';

import * as React from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    // Check if app is already running in standalone mode (already installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');

    if (isStandalone) {
      return;
    }

    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show the install banner
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // If the app was installed successfully, hide the prompt
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsVisible(false);
      console.log('PWA was installed successfully');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the browser's install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to PWA install prompt: ${outcome}`);
    
    // Clear prompt state
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Optionally, store the dismiss state in sessionStorage so we don't bug the user in the same session
    sessionStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  // Don't show if not visible or if dismissed in current session
  React.useEffect(() => {
    if (isVisible && sessionStorage.getItem('pwa-prompt-dismissed') === 'true') {
      setIsVisible(false);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:w-96 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <Card className="border border-primary/20 bg-background/95 backdrop-blur-md shadow-2xl relative overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-blue-600" />
        <CardContent className="p-5 flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Download className="h-5 w-5" />
          </div>
          
          <div className="flex-1 space-y-1 pr-6">
            <h4 className="font-semibold text-sm leading-none">Instalar Aplicación</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Instala "Gestiono Mis Cuentas" en tu dispositivo para acceder rápidamente y tener una mejor experiencia de uso.
            </p>
            <div className="pt-3 flex gap-2">
              <Button size="sm" onClick={handleInstallClick} className="text-xs h-8">
                Instalar ahora
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss} className="text-xs h-8 text-muted-foreground hover:text-foreground">
                Quizás más tarde
              </Button>
            </div>
          </div>

          <button 
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors rounded-full p-1 hover:bg-muted"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
