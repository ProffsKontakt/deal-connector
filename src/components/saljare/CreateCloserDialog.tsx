import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';

interface Region {
  id: string;
  name: string;
}

interface Organization {
  id: string;
  name: string;
}

interface CreateCloserDialogProps {
  onCreated: () => void;
}

export const CreateCloserDialog = ({ onCreated }: CreateCloserDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    base_commission: '8000',
    markup_percentage: '40',
  });
  const [selectedRegions, setSelectedRegions] = useState<{ regionId: string; organizationId: string }[]>([]);

  useEffect(() => {
    if (open) {
      fetchRegionsAndOrganizations();
    }
  }, [open]);

  const fetchRegionsAndOrganizations = async () => {
    const [regionsRes, orgsRes] = await Promise.all([
      supabase.from('regions').select('id, name').order('name'),
      supabase.from('organizations').select('id, name').eq('status', 'active').order('name'),
    ]);
    
    if (regionsRes.data) setRegions(regionsRes.data);
    if (orgsRes.data) setOrganizations(orgsRes.data);
  };

  const handleRegionToggle = (regionId: string, organizationId: string) => {
    const key = `${regionId}-${organizationId}`;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email.trim() || !formData.password) {
      toast.error('E-post och lösenord krävs');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Lösenordet måste vara minst 6 tecken');
      return;
    }

    if (!formData.full_name.trim()) {
      toast.error('Namn krävs');
      return;
    }

    if (selectedRegions.length === 0) {
      toast.error('Välj minst en region och organisation');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name.trim(),
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Update the profile with closer role, name and commission settings
        await supabase
          .from('profiles')
          .update({ 
            role: 'closer',
            full_name: formData.full_name.trim(),
            closer_base_commission: parseFloat(formData.base_commission) || 8000,
            closer_markup_percentage: parseFloat(formData.markup_percentage) || 40,
          })
          .eq('id', data.user.id);

        // Update user_roles table
        await supabase
          .from('user_roles')
          .update({ role: 'closer' })
          .eq('user_id', data.user.id);

        // Create closer_regions entries
        const closerRegionsData = selectedRegions.map(sr => ({
          closer_id: data.user!.id,
          region_id: sr.regionId,
          organization_id: sr.organizationId,
        }));

        const { error: regionsError } = await supabase
          .from('closer_regions')
          .insert(closerRegionsData);

        if (regionsError) {
          console.error('Error creating closer regions:', regionsError);
          toast.error('Closer skapad men kunde inte tilldela regioner');
        }
      }

      toast.success('Closer skapad');
      setFormData({ email: '', password: '', full_name: '', base_commission: '8000', markup_percentage: '40' });
      setSelectedRegions([]);
      setOpen(false);
      onCreated();
    } catch (error: any) {
      toast.error('Kunde inte skapa closer: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="w-4 h-4" />
          Skapa closer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Skapa ny closer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="closer-name">Namn *</Label>
            <Input
              id="closer-name"
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              placeholder="Förnamn Efternamn"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="closer-email">E-post *</Label>
            <Input
              id="closer-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="exempel@email.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="closer-password">Lösenord *</Label>
            <Input
              id="closer-password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              placeholder="Minst 6 tecken"
              required
            />
          </div>

          <div className="space-y-3">
            <Label>Tilldela regioner & organisationer *</Label>
            <p className="text-sm text-muted-foreground">
              Välj vilka regioner closern ska sälja för, och för vilken partner/organisation.
            </p>
            
            {regions.length === 0 || organizations.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                {regions.length === 0 ? 'Inga regioner skapade ännu. ' : ''}
                {organizations.length === 0 ? 'Inga aktiva organisationer.' : ''}
              </p>
            ) : (
              <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                {regions.map((region) => (
                  <div key={region.id} className="p-3">
                    <p className="font-medium mb-2">{region.name}</p>
                    <div className="flex flex-wrap gap-3">
                      {organizations.map((org) => (
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
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium">Provisionsstruktur</h4>
            
            <div className="space-y-2">
              <Label htmlFor="closer-base-commission">Basprovision per standardaffär (kr)</Label>
              <Input
                id="closer-base-commission"
                type="number"
                value={formData.base_commission}
                onChange={(e) => setFormData(prev => ({ ...prev, base_commission: e.target.value }))}
                placeholder="8000"
              />
              <p className="text-xs text-muted-foreground">Standard: 8 000 kr per stängd affär</p>
            </div>


            <div className="space-y-2">
              <Label htmlFor="closer-markup-percentage">Closerns andel av bolagets påslag (%)</Label>
              <Input
                id="closer-markup-percentage"
                type="number"
                value={formData.markup_percentage}
                onChange={(e) => setFormData(prev => ({ ...prev, markup_percentage: e.target.value }))}
                placeholder="40"
              />
              <p className="text-xs text-muted-foreground">Hur stor del av ProffsKontakts påslag som closern får (t.ex. 40%)</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Skapar...' : 'Skapa closer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
