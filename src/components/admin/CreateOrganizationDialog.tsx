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
    contact_person_name: '',
    contact_phone: '',
    price_per_solar_deal: '',
    price_per_battery_deal: '',
    price_per_site_visit: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Partnernamn krävs');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('organizations').insert({
        name: formData.name.trim(),
        contact_person_name: formData.contact_person_name.trim() || null,
        contact_phone: formData.contact_phone.trim() || null,
        price_per_solar_deal: formData.price_per_solar_deal ? parseFloat(formData.price_per_solar_deal) : null,
        price_per_battery_deal: formData.price_per_battery_deal ? parseFloat(formData.price_per_battery_deal) : null,
        price_per_site_visit: formData.price_per_site_visit ? parseFloat(formData.price_per_site_visit) : null,
        status: 'active' as const
      });

      if (error) throw error;

      toast.success('🎉 Partner skapad');
      setFormData({ name: '', contact_person_name: '', contact_phone: '', price_per_solar_deal: '', price_per_battery_deal: '', price_per_site_visit: '' });
      setOpen(false);
      onCreated();
    } catch (error: any) {
      toast.error('⚠️ Kunde inte skapa partner: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Ny Partner
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Skapa ny partner</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Företagsnamn *</Label>
            <Input
              id="org-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Företag AB"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Kontaktperson</Label>
              <Input
                id="contact-name"
                value={formData.contact_person_name}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_person_name: e.target.value }))}
                placeholder="Anna Svensson"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Telefon</Label>
              <Input
                id="contact-phone"
                value={formData.contact_phone}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                placeholder="070-123 45 67"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="solar-price">Sol-pris (kr)</Label>
              <Input
                id="solar-price"
                type="number"
                value={formData.price_per_solar_deal}
                onChange={(e) => setFormData(prev => ({ ...prev, price_per_solar_deal: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="battery-price">Batteri-pris (kr)</Label>
              <Input
                id="battery-price"
                type="number"
                value={formData.price_per_battery_deal}
                onChange={(e) => setFormData(prev => ({ ...prev, price_per_battery_deal: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-visit-price">Platsbesök (kr)</Label>
              <Input
                id="site-visit-price"
                type="number"
                value={formData.price_per_site_visit}
                onChange={(e) => setFormData(prev => ({ ...prev, price_per_site_visit: e.target.value }))}
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
