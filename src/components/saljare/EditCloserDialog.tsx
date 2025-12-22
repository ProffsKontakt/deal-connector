import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

interface Region {
  id: string;
  name: string;
}

interface Organization {
  id: string;
  name: string;
}

interface CommissionType {
  id?: string;
  name: string;
  commission_amount: number;
}

interface EditCloserDialogProps {
  closer: {
    id: string;
    email: string;
    full_name: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export const EditCloserDialog = ({ closer, open, onOpenChange, onUpdated }: EditCloserDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [formData, setFormData] = useState({
    full_name: '',
    base_commission: '8000',
    markup_percentage: '40',
  });
  const [selectedRegions, setSelectedRegions] = useState<{ regionId: string; organizationId: string }[]>([]);
  const [commissionTypes, setCommissionTypes] = useState<CommissionType[]>([]);
  const [newCommissionType, setNewCommissionType] = useState({ name: '', commission_amount: '8000' });
  const [organizationRegions, setOrganizationRegions] = useState<{ organization_id: string; region_id: string }[]>([]);

  useEffect(() => {
    if (closer && open) {
      fetchData();
    }
  }, [closer, open]);

  const fetchData = async () => {
    if (!closer) return;

    const [regionsRes, orgsRes, profileRes, closerRegionsRes, commissionTypesRes, orgRegionsRes] = await Promise.all([
      supabase.from('regions').select('id, name').order('name'),
      supabase.from('organizations').select('id, name').eq('status', 'active').order('name'),
      supabase.from('profiles').select('full_name, closer_base_commission, closer_markup_percentage, closer_company_markup_share').eq('id', closer.id).single(),
      supabase.from('closer_regions').select('region_id, organization_id').eq('closer_id', closer.id),
      supabase.from('closer_commission_types').select('id, name, commission_amount').eq('closer_id', closer.id),
      supabase.from('organization_regions').select('organization_id, region_id'),
    ]);

    if (regionsRes.data) setRegions(regionsRes.data);
    if (orgsRes.data) setOrganizations(orgsRes.data);
    if (profileRes.data) {
      setFormData({
        full_name: profileRes.data.full_name || '',
        base_commission: (profileRes.data.closer_base_commission ?? 8000).toString(),
        markup_percentage: (profileRes.data.closer_markup_percentage ?? 40).toString(),
      });
    }
    if (closerRegionsRes.data) {
      setSelectedRegions(
        closerRegionsRes.data.map(cr => ({
          regionId: cr.region_id,
          organizationId: cr.organization_id,
        }))
      );
    }
    if (commissionTypesRes.data) {
      setCommissionTypes(commissionTypesRes.data);
    }
    // Store organization regions to filter valid combinations
    if (orgRegionsRes.data) {
      setOrganizationRegions(orgRegionsRes.data);
    }
  };

  const handleRegionToggle = (regionId: string, organizationId: string) => {
    const exists = selectedRegions.find(
      sr => sr.regionId === regionId && sr.organizationId === organizationId
    );

    if (exists) {
      setSelectedRegions(prev =>
        prev.filter(sr => !(sr.regionId === regionId && sr.organizationId === organizationId))
      );
    } else {
      setSelectedRegions(prev => [...prev, { regionId, organizationId }]);
    }
  };

  const isRegionSelected = (regionId: string, organizationId: string) => {
    return selectedRegions.some(
      sr => sr.regionId === regionId && sr.organizationId === organizationId
    );
  };

  // Check if an organization has a specific region assigned
  const orgHasRegion = (organizationId: string, regionId: string) => {
    return organizationRegions.some(
      or => or.organization_id === organizationId && or.region_id === regionId
    );
  };

  // Get organizations that have a specific region
  const getOrgsForRegion = (regionId: string) => {
    const orgIds = organizationRegions
      .filter(or => or.region_id === regionId)
      .map(or => or.organization_id);
    return organizations.filter(org => orgIds.includes(org.id));
  };

  const addCommissionType = async () => {
    if (!closer || !newCommissionType.name.trim()) {
      toast.error('Ange ett namn för provisionstypen');
      return;
    }

    const { data, error } = await supabase
      .from('closer_commission_types')
      .insert({
        closer_id: closer.id,
        name: newCommissionType.name.trim(),
        commission_amount: parseFloat(newCommissionType.commission_amount) || 8000,
      })
      .select()
      .single();

    if (error) {
      toast.error('Kunde inte lägga till provisionstyp');
      return;
    }

    setCommissionTypes(prev => [...prev, data]);
    setNewCommissionType({ name: '', commission_amount: '8000' });
    toast.success('Provisionstyp tillagd');
  };

  const removeCommissionType = async (id: string) => {
    const { error } = await supabase
      .from('closer_commission_types')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Kunde inte ta bort provisionstyp');
      return;
    }

    setCommissionTypes(prev => prev.filter(ct => ct.id !== id));
    toast.success('Provisionstyp borttagen');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closer) return;

    setLoading(true);
    try {
      // Update profile with commission settings
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name.trim() || null,
          closer_base_commission: parseFloat(formData.base_commission) || 8000,
          closer_markup_percentage: parseFloat(formData.markup_percentage) || 40,
        })
        .eq('id', closer.id);

      if (profileError) throw profileError;

      // Update regions - delete all and re-insert
      await supabase
        .from('closer_regions')
        .delete()
        .eq('closer_id', closer.id);

      if (selectedRegions.length > 0) {
        const regionsData = selectedRegions.map(sr => ({
          closer_id: closer.id,
          region_id: sr.regionId,
          organization_id: sr.organizationId,
        }));

        const { error: regionsError } = await supabase
          .from('closer_regions')
          .insert(regionsData);

        if (regionsError) throw regionsError;
      }

      toast.success('Closer uppdaterad');
      onOpenChange(false);
      onUpdated();
    } catch (error: any) {
      toast.error('Kunde inte uppdatera closer: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!closer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Redigera closer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>E-post</Label>
            <Input value={closer.email} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-closer-name">Namn</Label>
            <Input
              id="edit-closer-name"
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              placeholder="Förnamn Efternamn"
            />
          </div>

          {/* Commission Types */}
          <div className="space-y-3">
            <Label>Provision sälj</Label>
            <p className="text-sm text-muted-foreground">
              Lägg till olika försäljningstyper med olika provisioner.
            </p>

            {commissionTypes.length > 0 && (
              <div className="space-y-2">
                {commissionTypes.map((ct) => (
                  <div key={ct.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{ct.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {ct.commission_amount.toLocaleString('sv-SE')} kr
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => ct.id && removeCommissionType(ct.id)}
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
                placeholder="Typ (t.ex. 15,36 kWh batteri)"
                value={newCommissionType.name}
                onChange={(e) => setNewCommissionType(prev => ({ ...prev, name: e.target.value }))}
              />
              <Input
                type="number"
                placeholder="Kr"
                className="w-24"
                value={newCommissionType.commission_amount}
                onChange={(e) => setNewCommissionType(prev => ({ ...prev, commission_amount: e.target.value }))}
              />
              <Button type="button" variant="outline" size="icon" onClick={addCommissionType}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-2 pt-2">
              <Label htmlFor="edit-closer-base-commission">Basprovision per standardaffär (kr)</Label>
              <Input
                id="edit-closer-base-commission"
                type="number"
                value={formData.base_commission}
                onChange={(e) => setFormData(prev => ({ ...prev, base_commission: e.target.value }))}
                placeholder="8000"
              />
            </div>


            <div className="space-y-2">
              <Label htmlFor="edit-closer-markup-percentage">Closerns andel av bolagets påslag (%)</Label>
              <Input
                id="edit-closer-markup-percentage"
                type="number"
                value={formData.markup_percentage}
                onChange={(e) => setFormData(prev => ({ ...prev, markup_percentage: e.target.value }))}
                placeholder="40"
              />
              <p className="text-xs text-muted-foreground">Hur stor del av ProffsKontakts påslag som closern får</p>
            </div>
          </div>

          {/* Regions */}
          <div className="space-y-3">
            <Label>Tilldela regioner & organisationer</Label>
            <p className="text-xs text-muted-foreground">
              Endast organisationer som har regionen tilldelad visas.
            </p>
            {regions.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Inga regioner skapade ännu.
              </p>
            ) : (
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {regions.map((region) => {
                  const orgsForRegion = getOrgsForRegion(region.id);
                  if (orgsForRegion.length === 0) {
                    return (
                      <div key={region.id} className="p-3 opacity-50">
                        <p className="font-medium mb-1">{region.name}</p>
                        <p className="text-xs text-muted-foreground italic">Ingen organisation har denna region</p>
                      </div>
                    );
                  }
                  return (
                    <div key={region.id} className="p-3">
                      <p className="font-medium mb-2">{region.name}</p>
                      <div className="flex flex-wrap gap-3">
                        {orgsForRegion.map((org) => (
                          <label
                            key={`${region.id}-${org.id}`}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Checkbox
                              checked={isRegionSelected(region.id, org.id)}
                              onCheckedChange={() => handleRegionToggle(region.id, org.id)}
                            />
                            <span className="text-sm">{org.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Sparar...' : 'Spara'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
