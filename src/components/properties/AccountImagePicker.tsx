'use client';

import * as React from 'react';
import Image from 'next/image';
import { Upload, ImagePlus, Loader, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { compressAndResizeImage } from '@/lib/image-compression';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface AccountImagePickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function AccountImagePicker({ value, onChange }: AccountImagePickerProps) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const isPresetImage = PlaceHolderImages.some((img) => img.imageUrl === value);
  const isCustomImage = Boolean(value && !isPresetImage);

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
        title: 'Imagen procesada',
        description: 'La foto se ha optimizado y cargado correctamente.',
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

  const handleClearCustomImage = () => {
    onChange('');
  };

  return (
    <div className="space-y-4">
      {/* Upload button & dropzone */}
      <div className="flex flex-col gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {isCustomImage ? (
          <div className="flex items-center gap-4 p-3 rounded-lg border bg-muted/40">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border shadow-sm">
              <Image
                src={value}
                alt="Foto personalizada"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                  <Check className="h-3 w-3 mr-1" /> Foto propia
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                Foto optimizada guardada para la cuenta.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
                Cambiar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearCustomImage}
                disabled={isProcessing}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5 text-center",
              isProcessing && "opacity-60 pointer-events-none"
            )}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center gap-2">
                <Loader className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm font-medium">Optimizando y reduciendo imagen...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="p-3 bg-primary/10 text-primary rounded-full">
                  <ImagePlus className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Subir mi propia foto
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    JPG, PNG o WebP desde tu dispositivo (se optimiza automáticamente)
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preset images gallery */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          O elige una imagen de la galería
        </span>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {PlaceHolderImages.map((image) => {
            const isSelected = value === image.imageUrl;
            return (
              <button
                type="button"
                key={image.id || image.imageUrl}
                onClick={() => onChange(image.imageUrl)}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-md border text-left transition-all hover:scale-105 focus:outline-none",
                  isSelected
                    ? "ring-2 ring-primary ring-offset-2 border-primary"
                    : "ring-1 ring-border opacity-85 hover:opacity-100"
                )}
              >
                <Image
                  src={image.imageUrl}
                  alt={image.description}
                  fill
                  className="object-cover"
                  unoptimized
                />
                {isSelected && (
                  <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5 shadow">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
