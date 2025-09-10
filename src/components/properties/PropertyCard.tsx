import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { type Property } from '@/lib/types';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';

type PropertyCardProps = {
  property: Property;
};

export function PropertyCard({ property }: PropertyCardProps) {
  return (
    <Card className="overflow-hidden transition-all hover:shadow-lg">
        <Link href={`/properties/${property.id}`} className="block">
            <Image
                src={property.imageUrl}
                alt={property.name}
                width={600}
                height={400}
                className="w-full h-48 object-cover"
                data-ai-hint="apartment building"
            />
        </Link>
        <CardHeader>
            <CardTitle className="font-headline">{property.name}</CardTitle>
            <CardDescription className="line-clamp-2 h-[40px]">
                {property.description}
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Button variant="outline" className="w-full" asChild>
                <Link href={`/properties/${property.id}`}>
                    Ver Detalles
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
            </Button>
        </CardContent>
    </Card>
  );
}
