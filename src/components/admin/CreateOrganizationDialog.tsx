import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

interface CreateOrganizationDialogProps {
  onCreated: () => void;
}

export const CreateOrganizationDialog = ({ onCreated }: CreateOrganizationDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    price_per_solar_deal: '',
    price_per_battery_deal: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Organisationsnamn krävs');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('organizations').insert({
        name: formData.name.trim(),
        price_per_solar_deal: formData.price_per_solar_deal ? parseFloat(formData.price_per_solar_deal) : null,
        price_per_battery_deal: formData.price_per_battery_deal ? parseFloat(formData.price_per_battery_deal) : null,
      });

      if (error) throw error;

      toast.success('Organisation skapad');
      setFormData({ name: '', price_per_solar_deal: '', price_per_battery_deal: '' });
      setOpen(false);
      onCreated();
    } catch (error: any) {
      toast.error('Kunde inte skapa organisation: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Ny Organisation
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Skapa ny organisation</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Namn *</Label>
            <Input
              id="org-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Organisation AB"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="solar-price">Pris per Sol-deal (kr)</Label>
              <Input
                id="solar-price"
                type="number"
                value={formData.price_per_solar_deal}
                onChange={(e) => setFormData(prev => ({ ...prev, price_per_solar_deal: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="battery-price">Pris per Batteri-deal (kr)</Label>
              <Input
                id="battery-price"
                type="number"
                value={formData.price_per_battery_deal}
                onChange={(e) => setFormData(prev => ({ ...prev, price_per_battery_deal: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Skapar...' : 'Skapa'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
