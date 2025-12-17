import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, Plus, Trash2 } from 'lucide-react';

interface PartnerRow {
  name: string;
  contact_person_name: string;
  contact_phone: string;
  price_per_solar_deal: string;
  price_per_battery_deal: string;
  price_per_site_visit: string;
}

interface BulkImportPartnersDialogProps {
  onImported: () => void;
}

export const BulkImportPartnersDialog = ({ onImported }: BulkImportPartnersDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PartnerRow[]>([
    { name: '', contact_person_name: '', contact_phone: '', price_per_solar_deal: '', price_per_battery_deal: '', price_per_site_visit: '' }
  ]);

  const addRow = () => {
    setRows([...rows, { name: '', contact_person_name: '', contact_phone: '', price_per_solar_deal: '', price_per_battery_deal: '', price_per_site_visit: '' }]);
  };

  const removeRow = (index: number) => {
    if (rows.length > 1) {
      setRows(rows.filter((_, i) => i !== index));
    }
  };

  const updateRow = (index: number, field: keyof PartnerRow, value: string) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    setRows(newRows);
  };

  const handleImport = async () => {
    const validRows = rows.filter(row => row.name.trim());
    
    if (validRows.length === 0) {
      toast.error('Ange minst en partner med namn');
      return;
    }

    setLoading(true);
    try {
      const partnersToInsert = validRows.map(row => ({
        name: row.name.trim(),
        contact_person_name: row.contact_person_name.trim() || null,
        contact_phone: row.contact_phone.trim() || null,
        price_per_solar_deal: row.price_per_solar_deal ? parseFloat(row.price_per_solar_deal) : null,
        price_per_battery_deal: row.price_per_battery_deal ? parseFloat(row.price_per_battery_deal) : null,
        price_per_site_visit: row.price_per_site_visit ? parseFloat(row.price_per_site_visit) : null,
        status: 'active' as const
      }));

      const { error } = await supabase
        .from('organizations')
        .insert(partnersToInsert);

      if (error) throw error;

      toast.success(`🎉 ${validRows.length} partners importerade`);
      setOpen(false);
      setRows([{ name: '', contact_person_name: '', contact_phone: '', price_per_solar_deal: '', price_per_battery_deal: '', price_per_site_visit: '' }]);
      onImported();
    } catch (error: any) {
      toast.error('⚠️ Kunde inte importera partners: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="w-4 h-4" />
          Bulk-importera
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk-importera partners</DialogTitle>
          <DialogDescription>
            Lägg till flera partners samtidigt med kontaktuppgifter och priser
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-6 gap-2 text-sm font-medium text-muted-foreground px-1">
            <span>Företagsnamn *</span>
            <span>Kontaktperson</span>
            <span>Telefon</span>
            <span>Sol-pris</span>
            <span>Batteri-pris</span>
            <span>Platsbesök-pris</span>
          </div>

          {rows.map((row, index) => (
            <div key={index} className="grid grid-cols-6 gap-2 items-center">
              <Input
                value={row.name}
                onChange={(e) => updateRow(index, 'name', e.target.value)}
                placeholder="Företag AB"
              />
              <Input
                value={row.contact_person_name}
                onChange={(e) => updateRow(index, 'contact_person_name', e.target.value)}
                placeholder="Anna Svensson"
              />
              <Input
                value={row.contact_phone}
                onChange={(e) => updateRow(index, 'contact_phone', e.target.value)}
                placeholder="070-123 45 67"
              />
              <Input
                type="number"
                value={row.price_per_solar_deal}
                onChange={(e) => updateRow(index, 'price_per_solar_deal', e.target.value)}
                placeholder="0"
              />
              <Input
                type="number"
                value={row.price_per_battery_deal}
                onChange={(e) => updateRow(index, 'price_per_battery_deal', e.target.value)}
                placeholder="0"
              />
              <div className="flex gap-1">
                <Input
                  type="number"
                  value={row.price_per_site_visit}
                  onChange={(e) => updateRow(index, 'price_per_site_visit', e.target.value)}
                  placeholder="0"
                />
                {rows.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(index)}
                    className="shrink-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={addRow} className="gap-2 w-full">
            <Plus className="w-4 h-4" />
            Lägg till rad
          </Button>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={handleImport} disabled={loading}>
              {loading ? 'Importerar...' : `Importera ${rows.filter(r => r.name.trim()).length} partners`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
