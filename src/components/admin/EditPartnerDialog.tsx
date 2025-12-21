import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, Trash2, Building2, Settings2, DollarSign, Percent } from 'lucide-react';

interface CostSegment {
  id?: string;
  name: string;
  amount: number;
  is_eur: boolean;
}

interface Partner {
  id: string;
  name: string;
  contact_person_name: string | null;
  contact_phone: string | null;
  price_per_solar_deal: number | null;
  price_per_battery_deal: number | null;
  price_per_site_visit: number | null;
  is_sales_consultant?: boolean;
  billing_model?: string;
  company_markup_share?: number;
  base_cost_for_billing?: number;
  eur_to_sek_rate?: number;
  lf_finans_percent?: number;
  default_customer_price?: number;
}

interface EditPartnerDialogProps {
  partner: Partner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export const EditPartnerDialog = ({ partner, open, onOpenChange, onUpdated }: EditPartnerDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact_person_name: '',
    contact_phone: '',
    price_per_solar_deal: '',
    price_per_battery_deal: '',
    price_per_site_visit: '',
    is_sales_consultant: false,
    billing_model: 'fixed',
    company_markup_share: '70',
    base_cost_for_billing: '23000',
    eur_to_sek_rate: '11',
    lf_finans_percent: '3',
    default_customer_price: '78000',
  });
  const [costSegments, setCostSegments] = useState<CostSegment[]>([]);
  const [newCostSegment, setNewCostSegment] = useState<CostSegment>({
    name: '',
    amount: 0,
    is_eur: false,
  });

  useEffect(() => {
    if (partner && open) {
      setFormData({
        name: partner.name || '',
        contact_person_name: partner.contact_person_name || '',
        contact_phone: partner.contact_phone || '',
        price_per_solar_deal: partner.price_per_solar_deal?.toString() || '',
        price_per_battery_deal: partner.price_per_battery_deal?.toString() || '',
        price_per_site_visit: partner.price_per_site_visit?.toString() || '',
        is_sales_consultant: partner.is_sales_consultant || false,
        billing_model: partner.billing_model || 'fixed',
        company_markup_share: (partner.company_markup_share ?? 70).toString(),
        base_cost_for_billing: (partner.base_cost_for_billing ?? 23000).toString(),
        eur_to_sek_rate: (partner.eur_to_sek_rate ?? 11).toString(),
        lf_finans_percent: (partner.lf_finans_percent ?? 3).toString(),
        default_customer_price: (partner.default_customer_price ?? 78000).toString(),
      });
      fetchCostSegments();
    }
  }, [partner, open]);

  const fetchCostSegments = async () => {
    if (!partner) return;
    
    const { data } = await supabase
      .from('organization_cost_segments')
      .select('*')
      .eq('organization_id', partner.id)
      .order('created_at');
    
    if (data) {
      setCostSegments(data.map(cs => ({
        id: cs.id,
        name: cs.name,
        amount: cs.amount,
        is_eur: cs.is_eur,
      })));
    }
  };

  const addCostSegment = async () => {
    if (!partner || !newCostSegment.name.trim()) {
      toast.error('Ange ett namn för kostnadssegmentet');
      return;
    }

    const { data, error } = await supabase
      .from('organization_cost_segments')
      .insert({
        organization_id: partner.id,
        name: newCostSegment.name.trim(),
        amount: newCostSegment.amount,
        is_eur: newCostSegment.is_eur,
      })
      .select()
      .single();

    if (error) {
      toast.error('Kunde inte lägga till kostnadssegment');
      return;
    }

    setCostSegments(prev => [...prev, { 
      id: data.id, 
      name: data.name, 
      amount: data.amount, 
      is_eur: data.is_eur 
    }]);
    setNewCostSegment({ name: '', amount: 0, is_eur: false });
    toast.success('Kostnadssegment tillagt');
  };

  const removeCostSegment = async (id: string) => {
    const { error } = await supabase
      .from('organization_cost_segments')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Kunde inte ta bort kostnadssegment');
      return;
    }

    setCostSegments(prev => prev.filter(cs => cs.id !== id));
    toast.success('Kostnadssegment borttaget');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partner) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: formData.name.trim(),
          contact_person_name: formData.contact_person_name.trim() || null,
          contact_phone: formData.contact_phone.trim() || null,
          price_per_solar_deal: formData.price_per_solar_deal ? parseFloat(formData.price_per_solar_deal) : null,
          price_per_battery_deal: formData.price_per_battery_deal ? parseFloat(formData.price_per_battery_deal) : null,
          price_per_site_visit: formData.price_per_site_visit ? parseFloat(formData.price_per_site_visit) : null,
          is_sales_consultant: formData.is_sales_consultant,
          billing_model: formData.billing_model,
          company_markup_share: parseFloat(formData.company_markup_share) || 70,
          base_cost_for_billing: parseFloat(formData.base_cost_for_billing) || 23000,
          eur_to_sek_rate: parseFloat(formData.eur_to_sek_rate) || 11,
          lf_finans_percent: parseFloat(formData.lf_finans_percent) || 3,
          default_customer_price: parseFloat(formData.default_customer_price) || 78000,
        })
        .eq('id', partner.id);

      if (error) throw error;

      toast.success('Partner uppdaterad');
      onOpenChange(false);
      onUpdated();
    } catch (error: any) {
      toast.error('Kunde inte uppdatera partner: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!partner) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Redigera {partner.name}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
              Grundläggande information
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Företagsnamn</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Partner AB"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_person">Kontaktperson</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_person_name: e.target.value }))}
                  placeholder="Anna Andersson"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_phone">Telefon</Label>
              <Input
                id="contact_phone"
                value={formData.contact_phone}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                placeholder="070-123 45 67"
              />
            </div>
          </div>

          <Separator />

          {/* Lead Pricing */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
              <DollarSign className="h-4 w-4" />
              Lead-prissättning
            </h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price_solar">Sol-pris (kr)</Label>
                <Input
                  id="price_solar"
                  type="number"
                  value={formData.price_per_solar_deal}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_per_solar_deal: e.target.value }))}
                  placeholder="500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_battery">Batteri-pris (kr)</Label>
                <Input
                  id="price_battery"
                  type="number"
                  value={formData.price_per_battery_deal}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_per_battery_deal: e.target.value }))}
                  placeholder="300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_visit">Platsbesök-pris (kr)</Label>
                <Input
                  id="price_visit"
                  type="number"
                  value={formData.price_per_site_visit}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_per_site_visit: e.target.value }))}
                  placeholder="200"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Sales Consultant Toggle */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Säljkonsult
                </h3>
                <p className="text-sm text-muted-foreground">
                  Aktivera för att visa säljkonsult-inställningar
                </p>
              </div>
              <Switch
                checked={formData.is_sales_consultant}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_sales_consultant: checked }))}
              />
            </div>

            {formData.is_sales_consultant && (
              <div className="pl-4 border-l-2 border-primary/30 space-y-4 animate-fade-in">
                {/* Billing Model */}
                <div className="space-y-2">
                  <Label>Faktureringsmodell</Label>
                  <Select
                    value={formData.billing_model}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, billing_model: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Satt provision</SelectItem>
                      <SelectItem value="above_cost">Allt över (kostnad subtraheras)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {formData.billing_model === 'above_cost' 
                      ? '"Allt över" subtraherar alla kostnader från ordervärdet och fakturerar resten'
                      : '"Satt provision" använder en fast provision per affär'}
                  </p>
                </div>

                {/* Company Markup Share */}
                <div className="space-y-2">
                  <Label htmlFor="company_share" className="flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    ProffsKontakts andel av påslag (%)
                  </Label>
                  <Input
                    id="company_share"
                    type="number"
                    value={formData.company_markup_share}
                    onChange={(e) => setFormData(prev => ({ ...prev, company_markup_share: e.target.value }))}
                    placeholder="70"
                  />
                  <p className="text-xs text-muted-foreground">
                    Hur stor del av påslag ex moms som ProffsKontakt tar (t.ex. 70%)
                  </p>
                </div>

                {formData.billing_model === 'above_cost' && (
                  <>
                    {/* Default Customer Price */}
                    <div className="space-y-2">
                      <Label htmlFor="default_price">Standardpris till kund (kr inkl. moms)</Label>
                      <Input
                        id="default_price"
                        type="number"
                        value={formData.default_customer_price}
                        onChange={(e) => setFormData(prev => ({ ...prev, default_customer_price: e.target.value }))}
                        placeholder="78000"
                      />
                    </div>

                    {/* Base Cost */}
                    <div className="space-y-2">
                      <Label htmlFor="base_cost">Baskostnad (kr)</Label>
                      <Input
                        id="base_cost"
                        type="number"
                        value={formData.base_cost_for_billing}
                        onChange={(e) => setFormData(prev => ({ ...prev, base_cost_for_billing: e.target.value }))}
                        placeholder="23000"
                      />
                      <p className="text-xs text-muted-foreground">
                        Partnerns grundkostnad för installation
                      </p>
                    </div>

                    {/* EUR to SEK rate */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="eur_rate">EUR till SEK växelkurs</Label>
                        <Input
                          id="eur_rate"
                          type="number"
                          step="0.01"
                          value={formData.eur_to_sek_rate}
                          onChange={(e) => setFormData(prev => ({ ...prev, eur_to_sek_rate: e.target.value }))}
                          placeholder="11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lf_finans">LF Finans (%)</Label>
                        <Input
                          id="lf_finans"
                          type="number"
                          step="0.1"
                          value={formData.lf_finans_percent}
                          onChange={(e) => setFormData(prev => ({ ...prev, lf_finans_percent: e.target.value }))}
                          placeholder="3"
                        />
                      </div>
                    </div>

                    {/* Cost Segments */}
                    <div className="space-y-3">
                      <Label>Kostnadssegment</Label>
                      <p className="text-xs text-muted-foreground">
                        Lägg till anpassade kostnader som subtraheras från ordervärdet
                      </p>

                      {costSegments.length > 0 && (
                        <div className="space-y-2">
                          {costSegments.map((segment) => (
                            <div key={segment.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div>
                                <p className="font-medium">{segment.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {segment.amount.toLocaleString('sv-SE')} {segment.is_eur ? 'EUR' : 'SEK'}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => segment.id && removeCostSegment(segment.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Input
                          placeholder="Namn (t.ex. Materialkostnad)"
                          value={newCostSegment.name}
                          onChange={(e) => setNewCostSegment(prev => ({ ...prev, name: e.target.value }))}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          placeholder="Belopp"
                          className="w-24"
                          value={newCostSegment.amount || ''}
                          onChange={(e) => setNewCostSegment(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                        />
                        <Select
                          value={newCostSegment.is_eur ? 'eur' : 'sek'}
                          onValueChange={(value) => setNewCostSegment(prev => ({ ...prev, is_eur: value === 'eur' }))}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sek">SEK</SelectItem>
                            <SelectItem value="eur">EUR</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="icon" onClick={addCostSegment}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Sparar...' : 'Spara ändringar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
