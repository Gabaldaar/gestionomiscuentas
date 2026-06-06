
'use client';

import * as React from 'react';
import { collection, getDocs, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Pencil, Trash2, Loader, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type IncomeCategory } from '@/lib/types';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { ManageCategoryDialog } from '@/components/settings/ManageCategoryDialog';
import { ManageSubcategoryDialog } from '@/components/settings/ManageSubcategoryDialog';

export default function IncomeSettingsPage() {
  const { toast } = useToast();
  const [categories, setCategories] = React.useState<IncomeCategory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Dialog states
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<IncomeCategory | null>(null);
  
  const [isSubcategoryDialogOpen, setIsSubcategoryDialogOpen] = React.useState(false);
  const [editingSubcategory, setEditingSubcategory] = React.useState<IncomeCategory['subcategories'][0] | null>(null);
  const [parentCategory, setParentCategory] = React.useState<IncomeCategory | null>(null);
  
  const [deletingItem, setDeletingItem] = React.useState<{id: string, name: string, type: 'category' | 'subcategory', parentId?: string} | null>(null);

  const fetchCategories = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const categoriesQuery = query(collection(db, 'incomeCategories'), orderBy('name'));
      const categoriesSnapshot = await getDocs(categoriesQuery);
      const categoriesList = await Promise.all(categoriesSnapshot.docs.map(async (categoryDoc) => {
        const categoryData = categoryDoc.data();
        const subcategoriesQuery = query(collection(db, 'incomeCategories', categoryDoc.id, 'subcategories'), orderBy('name'));
        const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
        const subcategoriesList = subcategoriesSnapshot.docs.map(subDoc => ({
          id: subDoc.id,
          name: subDoc.data().name,
        }));
        return {
          id: categoryDoc.id,
          name: categoryData.name,
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

  const handleEditSubcategory = (subcategory: IncomeCategory['subcategories'][0], category: IncomeCategory) => {
    setEditingSubcategory(subcategory);
    setParentCategory(category);
    setIsSubcategoryDialogOpen(true);
  };

  const handleDeleteSubcategory = (subcategory: IncomeCategory['subcategories'][0], category: IncomeCategory) => {
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
    <>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <PageHeader title="Categorías de Ingresos">
          <Button onClick={handleAddCategory}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Añadir Categoría
          </Button>
        </PageHeader>

        <div className="space-y-6">
          {categories.length > 0 ? categories.map((category) => (
            <Card key={category.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{category.name}</CardTitle>
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
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {category.subcategories.map((subcategory) => (
                    <li key={subcategory.id} className="flex items-center justify-between p-2 rounded-md hover:bg-secondary">
                      <span>{subcategory.name}</span>
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
                  ))}
                   {category.subcategories.length === 0 && (
                     <p className="text-center text-muted-foreground p-4">No hay subcategorías. Añade una para empezar.</p>
                   )}
                </ul>
              </CardContent>
            </Card>
          )) : (
            <Card>
                <CardContent className='p-10 text-center text-muted-foreground'>
                    No hay categorías de ingresos. Añade una para empezar.
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
        collectionPath='incomeCategories'
        entityName='Categoría de Ingreso'
      />
      
      <ManageSubcategoryDialog
        isOpen={isSubcategoryDialogOpen}
        onOpenChange={setIsSubcategoryDialogOpen}
        onSave={fetchCategories}
        parentCategory={parentCategory}
        subcategoryToEdit={editingSubcategory}
        collectionPath='incomeCategories'
        entityName='Subcategoría de Ingreso'
      />

      <ConfirmDeleteDialog
        isOpen={!!deletingItem}
        onOpenChange={() => setDeletingItem(null)}
        onConfirm={confirmDelete}
        title={`¿Eliminar "${deletingItem?.name}"?`}
        description={`Esta acción es permanente y no se puede deshacer. ¿Estás seguro de que quieres eliminar esta ${deletingItem?.type === 'category' ? 'categoría' : 'subcategoría'}?`}
      />
    </>
  );
}
