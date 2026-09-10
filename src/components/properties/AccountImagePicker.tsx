'use client';

import * as React from 'react';
import Image from 'next/image';
import { Upload, ImagePlus, Loader, Check, Trash2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { compressAndResizeImage } from '@/lib/image-compression';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface AccountImagePickerProps {
  value?: string;
  onChange: (value: string) => void;
}

export function AccountImagePicker({ value, onChange }: AccountImagePickerProps) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const hasImage = Boolean(value && value.trim().length > 0);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input value so the same file can be chosen again if needed
    e.target.value = '';

    setIsProcessing(true);
    try {
      // Compress to max 256x256 px JPEG at 0.8 quality (~10-20KB)
      const compressedDataUrl = await compressAndResizeImage(file, 256, 256, 0.8);
      onChange(compressedDataUrl);
      toast({
        title: 'Imagen cargada',
        description: 'La foto se ha optimizado y asignado correctamente.',
      });
    } catch (error: any) {
      console.error('Error compressing image:', error);
      toast({
        title: 'Error al procesar imagen',
        description: error?.message || 'No se pudo cargar la imagen seleccionada.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearImage = () => {
    onChange('');
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {hasImage ? (
        <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-lg border bg-muted/30">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md border-2 border-primary/20 shadow-sm bg-background">
            <Image
              src={value!}
              alt="Foto de la cuenta"
              fill
              className="object-cover"
              unoptimized
            />
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left space-y-1">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                <Check className="h-3 w-3 mr-1" /> Foto subida por el usuario
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Esta foto identificará a la cuenta en los selectores, tarjetas y reportes.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1.5" />}
              Cambiar foto
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearImage}
              disabled={isProcessing}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Quitar foto"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-all hover:border-primary/60 hover:bg-primary/5 text-center group",
            isProcessing && "opacity-60 pointer-events-none"
          )}
        >
          {isProcessing ? (
            <div className="flex flex-col items-center gap-2">
              <Loader className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm font-medium">Optimizando y reduciendo imagen...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-primary/10 text-primary rounded-full group-hover:scale-110 transition-transform">
                <ImagePlus className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Subir foto para esta cuenta
                </p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG o WebP desde tu computadora o celular (se optimiza automáticamente)
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" className="mt-1 pointer-events-none">
                <Upload className="h-3.5 w-3.5 mr-1.5" /> Seleccionar imagen
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
