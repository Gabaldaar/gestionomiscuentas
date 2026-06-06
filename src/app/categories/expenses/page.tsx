'use client';

import * as React from 'react';
import { collection, getDocs, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Pencil, Trash2, Loader, AlertTriangle, Link2, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { type ExpenseCategory, type Property, type ExpenseSubcategory } from '@/lib/types';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { ManageCategoryDialog } from '@/components/settings/ManageCategoryDialog';
import { ManageSubcategoryDialog } from '@/components/settings/ManageSubcategoryDialog';
import { useAccount } from '@/components/context/AccountProvider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function ExpenseCategoriesPage() {
  const { toast } = useToast();
  const { activeAccountId } = useAccount();
  const [categories, setCategories] = React.useState<ExpenseCategory[]>([]);
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Dialog states
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<ExpenseCategory | null>(null);
  
  const [isSubcategoryDialogOpen, setIsSubcategoryDialogOpen] = React.useState(false);
  const [editingSubcategory, setEditingSubcategory] = React.useState<ExpenseSubcategory | null>(null);
  const [parentCategory, setParentCategory] = React.useState<ExpenseCategory | null>(null);
  
  const [deletingItem, setDeletingItem] = React.useState<{id: string, name: string, type: 'category' | 'subcategory', parentId?: string} | null>(null);

  const fetchCategories = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const categoriesQuery = query(collection(db, 'expenseCategories'), orderBy('name'));
      const propertiesQuery = query(collection(db, 'properties'), orderBy('name'));

      const [categoriesSnapshot, propertiesSnapshot] = await Promise.all([
        getDocs(categoriesQuery),
        getDocs(propertiesQuery)
      ]);
      
      const propertiesList = propertiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
      setProperties(propertiesList);

      const categoriesList = await Promise.all(categoriesSnapshot.docs.map(async (categoryDoc) => {
        const categoryData = categoryDoc.data();
        const subcategoriesQuery = query(collection(db, 'expenseCategories', categoryDoc.id, 'subcategories'), orderBy('name'));
        const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
        const subcategoriesList = subcategoriesSnapshot.docs.map(subDoc => {
          const subData = subDoc.data();
          return {
            id: subDoc.id,
            name: subData.name,
            propertyIds: subData.propertyIds || [],
          };
        });
        return {
          id: categoryDoc.id,
          name: categoryData.name,
          propertyIds: categoryData.propertyIds || [],
          subcategories: subcategoriesList,
        } as ExpenseCategory;
      }));
      setCategories(categoriesList);
    } catch (err) {
      console.error("Error fetching expense categories: ", err);
      setError("No se pudieron cargar las categorías de gastos. Por favor, inténtalo de nuevo más tarde.");
      toast({ title: "Error", description: "No se pudieron cargar las categorías de gastos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // --- Category Actions ---
  const handleAddCategory = () => {
    setEditingCategory(null);
    setIsCategoryDialogOpen(true);
  };
  
  const handleEditCategory = (category: ExpenseCategory) => {
    setEditingCategory(category);
    setIsCategoryDialogOpen(true);
  };

  const handleDeleteCategory = (category: ExpenseCategory) => {
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
  const handleAddSubcategory = (category: ExpenseCategory) => {
    setEditingSubcategory(null);
    setParentCategory(category);
    setIsSubcategoryDialogOpen(true);
  };

  const handleEditSubcategory = (subcategory: ExpenseSubcategory, category: ExpenseCategory) => {
    setEditingSubcategory(subcategory);
    setParentCategory(category);
    setIsSubcategoryDialogOpen(true);
  };

  const handleDeleteSubcategory = (subcategory: ExpenseSubcategory, category: ExpenseCategory) => {
    setDeletingItem({ id: subcategory.id, name: subcategory.name, type: 'subcategory', parentId: category.id });
  };
  
  // --- Deletion Confirmation ---
  const confirmDelete = async () => {
    if (!deletingItem) return;

    let docPath: string;
    if (deletingItem.type === 'category') {
        docPath = `expenseCategories/${deletingItem.id}`;
    } else if (deletingItem.type === 'subcategory' && deletingItem.parentId) {
        docPath = `expenseCategories/${deletingItem.parentId}/subcategories/${deletingItem.id}`;
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

  const isAvailableForActiveAccount = (item: { propertyIds?: string[] }) => {
    if (activeAccountId === 'all') return false;
    // An item is "globally" available if it has no specific properties assigned.
    if (!item.propertyIds || item.propertyIds.length === 0) return true;
    // Otherwise, it must be explicitly assigned to the active account.
    return item.propertyIds.includes(activeAccountId);
  }


  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 flex justify-center">
        <Loader className="h-8 w-8 animate-spin" />
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
    <TooltipProvider>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <PageHeader title="Categorías de Gastos">
          <Button onClick={handleAddCategory}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Añadir Categoría
          </Button>
        </PageHeader>

        <div className="space-y-6">
          {categories.length > 0 ? categories.map((category) => {
            const isCategoryAvailable = isAvailableForActiveAccount(category);
            return (
            <Collapsible key={category.id}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 [&[data-state=open]>svg]:rotate-180">
                      <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                      <span className="sr-only">Toggle Categoría</span>
                    </Button>
                  </CollapsibleTrigger>
                  <CardTitle className="flex items-center gap-2">
                      {category.name}
                    {isCategoryAvailable && (
                        <Tooltip>
                            <TooltipTrigger>
                                <Link2 className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Disponible para la cuenta activa</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleAddSubcategory(category)}>
                      <PlusCircle className="h-4 w-4" />
                      <span className="sr-only">Añadir Subcategoría</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleEditCategory(category)}>
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Editar Categoría</span>
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteCategory(category)}>
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Eliminar Categoría</span>
                  </Button>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {category.subcategories.map((subcategory) => {
                    const isSubcategoryAvailable = isAvailableForActiveAccount(subcategory);
                    const showIcon = isCategoryAvailable && isSubcategoryAvailable;
                    return (
                    <li key={subcategory.id} className="flex items-center justify-between p-2 rounded-md hover:bg-secondary">
                      <span className="flex items-center gap-2">
                        {subcategory.name}
                        {showIcon && (
                            <Tooltip>
                                <TooltipTrigger>
                                    <Link2 className="h-4 w-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Disponible para la cuenta activa</p>
                                </TooltipContent>
                            </Tooltip>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditSubcategory(subcategory, category)}>
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Editar Subcategoría</span>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteSubcategory(subcategory, category)}>
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Eliminar Subcategoría</span>
                          </Button>
                      </div>
                    </li>
                  )})}
                   {category.subcategories.length === 0 && (
                     <p className="text-center text-muted-foreground p-4">No hay subcategorías. Añade una para empezar.</p>
                   )}
                </ul>
              </CardContent>
              </CollapsibleContent>
            </Card>
            </Collapsible>
          )}) : (
            <Card>
                <CardContent className='p-10 text-center text-muted-foreground'>
                    No hay categorías de gastos. Añade una para empezar.
                </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ManageCategoryDialog 
        isOpen={isCategoryDialogOpen}
        onOpenChange={setIsCategoryDialogOpen}
        onSave={fetchCategories}
        categoryToEdit={editingCategory}
        collectionPath='expenseCategories'
        entityName='Categoría de Gasto'
        properties={properties}
      />
      
      <ManageSubcategoryDialog
        isOpen={isSubcategoryDialogOpen}
        onOpenChange={setIsSubcategoryDialogOpen}
        onSave={fetchCategories}
        parentCategory={parentCategory}
        subcategoryToEdit={editingSubcategory}
        collectionPath='expenseCategories'
        entityName='Subcategoría de Gasto'
        properties={properties}
      />

      <ConfirmDeleteDialog
        isOpen={!!deletingItem}
        onOpenChange={() => setDeletingItem(null)}
        onConfirm={confirmDelete}
        title={`¿Eliminar "${deletingItem?.name}"?`}
        description={`Esta acción es permanente y no se puede deshacer. ¿Estás seguro de que quieres eliminar esta ${deletingItem?.type === 'category' ? 'categoría' : 'subcategoría'}?`}
      />
    </TooltipProvider>
  );
}
