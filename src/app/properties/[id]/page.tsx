
import { PropertyDetail } from "@/components/properties/PropertyDetail";

export default function PropertyDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;

  // Render the client component and pass the ID
  return <PropertyDetail id={id} />;
}
