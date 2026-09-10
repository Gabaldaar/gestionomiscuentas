'use client';

import * as React from 'react';
import { collection, getDocs, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Pencil, Trash2, Loader, AlertTriangle, ChevronDown, Building2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { type IncomeCategory, type Property, type IncomeSubcategory } from '@/lib/types';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { ManageCategoryDialog } from '@/components/settings/ManageCategoryDialog';
import { ManageSubcategoryDialog } from '@/components/settings/ManageSubcategoryDialog';
import { useAccount } from '@/components/context/AccountProvider';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';

export default function IncomeCategoriesPage() {
  const { toast } = useToast();
  const { activeAccountId } = useAccount();
  const [categories, setCategories] = React.useState<IncomeCategory[]>([]);
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Dialog states
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<IncomeCategory | null>(null);
  
  const [isSubcategoryDialogOpen, setIsSubcategoryDialogOpen] = React.useState(false);
  const [editingSubcategory, setEditingSubcategory] = React.useState<IncomeSubcategory | null>(null);
  const [parentCategory, setParentCategory] = React.useState<IncomeCategory | null>(null);
  
  const [deletingItem, setDeletingItem] = React.useState<{id: string, name: string, type: 'category' | 'subcategory', parentId?: string} | null>(null);

  const fetchCategories = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const categoriesQuery = query(collection(db, 'incomeCategories'), orderBy('name'));
      const propertiesQuery = query(collection(db, 'properties'), orderBy('name'));

      const [categoriesSnapshot, propertiesSnapshot] = await Promise.all([
        getDocs(categoriesQuery),
        getDocs(propertiesQuery)
      ]);
      
      const propertiesList = propertiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
      setProperties(propertiesList);

      const categoriesList = await Promise.all(categoriesSnapshot.docs.map(async (categoryDoc) => {
        const categoryData = categoryDoc.data();
        const subcategoriesQuery = query(collection(db, 'incomeCategories', categoryDoc.id, 'subcategories'), orderBy('name'));
        const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
        const subcategoriesList = subcategoriesSnapshot.docs.map(subDoc => {
          const subData = subDoc.data();
          return {
            id: subDoc.id,
            name: subData.name,
            propertyId: subData.propertyId || (subData.propertyIds && subData.propertyIds[0]),
            propertyIds: subData.propertyIds || (subData.propertyId ? [subData.propertyId] : []),
          };
        });
        return {
          id: categoryDoc.id,
          name: categoryData.name,
          propertyId: categoryData.propertyId || (categoryData.propertyIds && categoryData.propertyIds[0]),
          propertyIds: categoryData.propertyIds || (categoryData.propertyId ? [categoryData.propertyId] : []),
          subcategories: subcategoriesList,
        } as IncomeCategory;
      }));
      setCategories(categoriesList);
    } catch (err) {
      console.error("Error fetching income categories: ", err);
      setError("No se pudieron cargar las categorías de ingresos. Por favor, inténtalo de nuevo más tarde.");
      toast({ title: "Error", description: "No se pudieron cargar las categorías de ingresos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const propertiesMap = React.useMemo(() => {
    return new Map(properties.map(p => [p.id, p]));
  }, [properties]);

  const activeProperty = React.useMemo(() => {
    return properties.find(p => p.id === activeAccountId);
  }, [properties, activeAccountId]);

  // Filter categories strictly by active account
  const filteredCategories = React.useMemo(() => {
    if (activeAccountId === 'all') {
      return categories;
    }

    return categories.filter(category => {
      const propId = category.propertyId || (category.propertyIds && category.propertyIds[0]);
      return propId === activeAccountId;
    });
  }, [categories, activeAccountId]);

  // --- Category Actions ---
  const handleAddCategory = () => {
    setEditingCategory(null);
    setIsCategoryDialogOpen(true);
  };
  
  const handleEditCategory = (category: IncomeCategory) => {
    setEditingCategory(category);
    setIsCategoryDialogOpen(true);
  };

  const handleDeleteCategory = (category: IncomeCategory) => {
     if (category.subcategories.length > 0) {
      toast({
        title: "No se puede eliminar",
        description: "Elimina primero todas las subcategorías asociadas.",
        variant: "destructive",
      });
      return;
    }
    setDeletingItem({ id: category.id, name: category.name, type: 'category' });
  };

  // --- Subcategory Actions ---
  const handleAddSubcategory = (category: IncomeCategory) => {
    setEditingSubcategory(null);
    setParentCategory(category);
    setIsSubcategoryDialogOpen(true);
  };

  const handleEditSubcategory = (subcategory: IncomeSubcategory, category: IncomeCategory) => {
    setEditingSubcategory(subcategory);
    setParentCategory(category);
    setIsSubcategoryDialogOpen(true);
  };

  const handleDeleteSubcategory = (subcategory: IncomeSubcategory, category: IncomeCategory) => {
    setDeletingItem({ id: subcategory.id, name: subcategory.name, type: 'subcategory', parentId: category.id });
  };
  
  // --- Deletion Confirmation ---
  const confirmDelete = async () => {
    if (!deletingItem) return;

    let docPath: string;
    if (deletingItem.type === 'category') {
        docPath = `incomeCategories/${deletingItem.id}`;
    } else if (deletingItem.type === 'subcategory' && deletingItem.parentId) {
        docPath = `incomeCategories/${deletingItem.parentId}/subcategories/${deletingItem.id}`;
    } else {
        toast({ title: "Error", description: "Información de eliminación incompleta.", variant: "destructive" });
        return;
    }

    try {
      await deleteDoc(doc(db, docPath));
      toast({ title: `"${deletingItem.name}" eliminado`, variant: "destructive" });
      setDeletingItem(null);
      fetchCategories();
    } catch (error) {
      console.error(`Error deleting ${deletingItem.type}: `, error);
      toast({ title: "Error", description: `No se pudo eliminar el elemento.`, variant: "destructive" });
    }
  };

  const renderAccountBadge = (propertyId?: string, propertyIds?: string[]) => {
    const pid = propertyId || (propertyIds && propertyIds[0]);
    if (!pid) return null;
    const prop = propertiesMap.get(pid);
    if (!prop) return null;
    return (
      <Badge variant="secondary" className="text-[11px] font-normal gap-1.5 py-0.5 px-2">
        {prop.imageUrl ? (
          <Image src={prop.imageUrl} alt={prop.name} width={14} height={14} className="rounded-sm object-cover" />
        ) : (
          <Building2 className="h-3 w-3 text-muted-foreground" />
        )}
        <span>{prop.name}</span>
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 flex justify-center items-center min-h-[50vh]">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 flex justify-center">
        <Card className="max-w-2xl mx-auto w-full">
          <CardHeader>
            <CardTitle className='text-destructive flex items-center gap-2'>
              <AlertTriangle/> Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button onClick={fetchCategories} className="mt-4">Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Categorías de Ingresos">
        <Button onClick={handleAddCategory}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Añadir Categoría
        </Button>
      </PageHeader>

      {/* Categories List */}
      <div className="space-y-4">
        {filteredCategories.length > 0 ? (
          filteredCategories.map((category) => (
            <Collapsible key={category.id} defaultOpen>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 [&[data-state=open]>svg]:rotate-180">
                        <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                        <span className="sr-only">Toggle Categoría</span>
                      </Button>
                    </CollapsibleTrigger>
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <CardTitle className="text-base truncate">{category.name}</CardTitle>
                      {activeAccountId === 'all' && renderAccountBadge(category.propertyId, category.propertyIds)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAddSubcategory(category)} title="Añadir Subcategoría">
                      <PlusCircle className="h-4 w-4" />
                      <span className="sr-only">Añadir Subcategoría</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditCategory(category)} title="Editar Categoría">
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Editar Categoría</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteCategory(category)} title="Eliminar Categoría">
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Eliminar Categoría</span>
                    </Button>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-0 px-4 pb-3">
                    <ul className="divide-y divide-border/40 rounded-md border bg-muted/20">
                      {category.subcategories.map((subcategory) => (
                        <li key={subcategory.id} className="flex items-center justify-between p-2.5 hover:bg-muted/40 transition-colors">
                          <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                            <span className="text-sm font-medium truncate">{subcategory.name}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditSubcategory(subcategory, category)} title="Editar Subcategoría">
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="sr-only">Editar Subcategoría</span>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteSubcategory(subcategory, category)} title="Eliminar Subcategoría">
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="sr-only">Eliminar Subcategoría</span>
                            </Button>
                          </div>
                        </li>
                      ))}
                      {category.subcategories.length === 0 && (
                        <li className="text-center text-xs text-muted-foreground p-3">
                          No hay subcategorías {activeAccountId !== 'all' ? 'para esta cuenta' : ''}. Añade una para empezar.
                        </li>
                      )}
                    </ul>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))
        ) : (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground space-y-3">
              <p className="text-base font-medium">
                {activeAccountId === 'all' 
                  ? 'No hay categorías de ingresos registradas.'
                  : `No hay categorías de ingresos asignadas a "${activeProperty?.name || 'esta cuenta'}".`
                }
              </p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {activeAccountId !== 'all'
                  ? 'Puedes añadir una nueva categoría para esta cuenta o cambiar la cuenta seleccionada en la barra superior.'
                  : 'Haz clic en "Añadir Categoría" para crear la primera.'
                }
              </p>
              <Button onClick={handleAddCategory} className="mt-2">
                <PlusCircle className="mr-2 h-4 w-4" />
                Añadir Categoría
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <ManageCategoryDialog 
        isOpen={isCategoryDialogOpen}
        onOpenChange={setIsCategoryDialogOpen}
        onSave={fetchCategories}
        categoryToEdit={editingCategory}
        collectionPath="incomeCategories"
        entityName="Categoría de Ingreso"
        properties={properties}
        defaultPropertyId={activeAccountId === 'all' ? (properties[0]?.id || '') : activeAccountId}
      />
      
      <ManageSubcategoryDialog
        isOpen={isSubcategoryDialogOpen}
        onOpenChange={setIsSubcategoryDialogOpen}
        onSave={fetchCategories}
        parentCategory={parentCategory}
        subcategoryToEdit={editingSubcategory}
        collectionPath="incomeCategories"
        entityName="Subcategoría de Ingreso"
        properties={properties}
        defaultPropertyId={activeAccountId === 'all' ? (properties[0]?.id || '') : activeAccountId}
      />

      <ConfirmDeleteDialog
        isOpen={!!deletingItem}
        onOpenChange={() => setDeletingItem(null)}
        onConfirm={confirmDelete}
        title={`¿Eliminar "${deletingItem?.name}"?`}
        description={`Esta acción es permanente y no se puede deshacer. ¿Estás seguro de que quieres eliminar esta ${deletingItem?.type === 'category' ? 'categoría' : 'subcategoría'}?`}
      />
    </div>
  );
}
