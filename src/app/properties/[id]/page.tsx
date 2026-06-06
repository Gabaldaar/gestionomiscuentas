
'use client';

import { PropertyDetail } from "@/components/properties/PropertyDetail";
import { useParams } from "next/navigation";

export default function PropertyDetailPage() {
  const params = useParams();
  const id = params.id as string;

  // Render the client component and pass the ID
  return <PropertyDetail id={id} />;
}
