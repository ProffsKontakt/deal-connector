import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { Package, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Product {
  id: string;
  name: string;
  type: string;
  base_price_incl_moms: number;
  material_cost_eur: number;
  green_tech_deduction_percent: number;
  capacity_kwh: number | null;
}

export const ProductManagement = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'battery',
    base_price_incl_moms: '',
    material_cost_eur: '',
    green_tech_deduction_percent: '48.5',
    capacity_kwh: '',
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name');

    if (data) {
      setProducts(data);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'battery',
      base_price_incl_moms: '',
      material_cost_eur: '',
      green_tech_deduction_percent: '48.5',
      capacity_kwh: '',
    });
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      type: product.type,
      base_price_incl_moms: product.base_price_incl_moms.toString(),
      material_cost_eur: product.material_cost_eur.toString(),
      green_tech_deduction_percent: product.green_tech_deduction_percent.toString(),
      capacity_kwh: product.capacity_kwh?.toString() || '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Ange ett produktnamn');
      return;
    }

    const productData = {
      name: formData.name.trim(),
      type: formData.type,
      base_price_incl_moms: parseFloat(formData.base_price_incl_moms) || 0,
      material_cost_eur: parseFloat(formData.material_cost_eur) || 0,
      green_tech_deduction_percent: parseFloat(formData.green_tech_deduction_percent) || 48.5,
      capacity_kwh: formData.capacity_kwh ? parseFloat(formData.capacity_kwh) : null,
    };

    if (editingProduct) {
      const { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', editingProduct.id);

      if (error) {
        toast.error('Kunde inte uppdatera produkten');
        return;
      }

      toast.success('Produkt uppdaterad');
      setEditingProduct(null);
    } else {
      const { error } = await supabase
        .from('products')
        .insert(productData);

      if (error) {
        toast.error('Kunde inte skapa produkten');
        return;
      }

      toast.success('Produkt skapad');
      setAddDialogOpen(false);
    }

    resetForm();
    fetchProducts();
  };

  const handleDelete = async () => {
    if (!deleteProduct) return;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', deleteProduct.id);

    if (error) {
      toast.error('Kunde inte ta bort produkten: ' + error.message);
      return;
    }

    toast.success('Produkt borttagen');
    setDeleteProduct(null);
    fetchProducts();
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const ProductForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Produktnamn *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="t.ex. Emaldo 10kWh"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Produkttyp</Label>
          <Select
            value={formData.type}
            onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="battery">Batteri</SelectItem>
              <SelectItem value="solar">Solceller</SelectItem>
              <SelectItem value="solar_battery">Sol + Batteri</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="capacity">Kapacitet (kWh)</Label>
          <Input
            id="capacity"
            type="number"
            step="0.1"
            value={formData.capacity_kwh}
            onChange={(e) => setFormData(prev => ({ ...prev, capacity_kwh: e.target.value }))}
            placeholder="t.ex. 10"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="base_price">Grundpris inkl. moms (SEK)</Label>
          <Input
            id="base_price"
            type="number"
            value={formData.base_price_incl_moms}
            onChange={(e) => setFormData(prev => ({ ...prev, base_price_incl_moms: e.target.value }))}
            placeholder="78000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="material_cost">Materialkostnad (EUR)</Label>
          <Input
            id="material_cost"
            type="number"
            value={formData.material_cost_eur}
            onChange={(e) => setFormData(prev => ({ ...prev, material_cost_eur: e.target.value }))}
            placeholder="6150"
          />
          <p className="text-xs text-muted-foreground">För Emaldo-produkter</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="green_tech">Grön Teknik-avdrag (%)</Label>
        <Input
          id="green_tech"
          type="number"
          step="0.1"
          value={formData.green_tech_deduction_percent}
          onChange={(e) => setFormData(prev => ({ ...prev, green_tech_deduction_percent: e.target.value }))}
          placeholder="48.5"
        />
        <p className="text-xs text-muted-foreground">Max procent av totalpris som kan avdragas</p>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => {
            resetForm();
            setAddDialogOpen(false);
            setEditingProduct(null);
          }}
        >
          Avbryt
        </Button>
        <Button type="submit">
          {editingProduct ? 'Spara ändringar' : 'Skapa produkt'}
        </Button>
      </div>
    </form>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-xl">Produkter</CardTitle>
          <CardDescription>Hantera produkttyper och prissättning</CardDescription>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Ny produkt
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Skapa ny produkt</DialogTitle>
            </DialogHeader>
            <ProductForm />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Inga produkter"
            description="Skapa din första produkt för att komma igång"
          />
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold">Produkt</TableHead>
                  <TableHead className="font-semibold">Typ</TableHead>
                  <TableHead className="font-semibold">Grundpris</TableHead>
                  <TableHead className="font-semibold">Materialkostnad</TableHead>
                  <TableHead className="font-semibold">Grön Teknik</TableHead>
                  <TableHead className="w-24 font-semibold">Åtgärder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id} className="group">
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        {product.capacity_kwh && (
                          <p className="text-xs text-muted-foreground">{product.capacity_kwh} kWh</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.type === 'battery' ? 'Batteri' : product.type === 'solar' ? 'Solceller' : 'Sol + Batteri'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatCurrency(product.base_price_incl_moms)} kr
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.material_cost_eur > 0 ? `${formatCurrency(product.material_cost_eur)} EUR` : '–'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.green_tech_deduction_percent}%
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditDialog(product)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          onClick={() => setDeleteProduct(product)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redigera produkt</DialogTitle>
          </DialogHeader>
          <ProductForm />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteProduct} onOpenChange={() => setDeleteProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort produkt?</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ta bort <strong>{deleteProduct?.name}</strong>? 
              Detta kan påverka befintliga affärer och provisioner.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
