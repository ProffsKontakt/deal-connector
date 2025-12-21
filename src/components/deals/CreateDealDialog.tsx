import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { z } from 'zod';
import type { Database } from '@/integrations/supabase/types';

type InterestType = Database['public']['Enums']['interest_type'];

interface Organization {
  id: string;
  name: string;
}

interface Opener {
  id: string;
  full_name: string | null;
  email: string;
}

const dealSchema = z.object({
  email: z.string().trim().email({ message: "Ogiltig e-postadress" }).max(255),
  phone: z.string().trim().max(50).optional(),
  address: z.string().trim().max(500).optional(),
  interest: z.enum(['sun', 'battery', 'sun_battery']),
  opener_id: z.string().min(1, { message: "Välj en opener" }),
  organizations: z.array(z.string()).min(1, { message: "Välj minst en organisation" })
});

interface CreateDealDialogProps {
  onDealCreated: () => void;
}

export const CreateDealDialog = ({ onDealCreated }: CreateDealDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [openers, setOpeners] = useState<Opener[]>([]);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    address: '',
    interest: 'sun' as InterestType,
    opener_id: '',
    selectedOrgs: [] as string[]
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      const [orgsResult, openersResult] = await Promise.all([
        supabase.from('organizations').select('id, name').order('name'),
        supabase.from('profiles').select('id, full_name, email').in('role', ['opener', 'teamleader'])
      ]);
      if (orgsResult.data) setOrganizations(orgsResult.data);
      if (openersResult.data) setOpeners(openersResult.data);
    };
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setErrors({});

    const validation = dealSchema.safeParse({
      email: formData.email,
      phone: formData.phone || undefined,
      address: formData.address || undefined,
      interest: formData.interest,
      opener_id: formData.opener_id,
      organizations: formData.selectedOrgs
    });

    if (!validation.success) {
      const newErrors: Record<string, string> = {};
      validation.error.errors.forEach(err => {
        if (err.path[0]) {
          newErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      // Create contact with selected opener
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          address: formData.address.trim() || null,
          interest: formData.interest,
          opener_id: formData.opener_id
        })
        .select()
        .single();

      if (contactError) throw contactError;

      // Create contact_organizations relationships
      const orgRelations = formData.selectedOrgs.map(orgId => ({
        contact_id: contact.id,
        organization_id: orgId
      }));

      const { error: orgError } = await supabase
        .from('contact_organizations')
        .insert(orgRelations);

      if (orgError) throw orgError;

      toast.success('Deal skapad!');
      setOpen(false);
      setFormData({
        email: '',
        phone: '',
        address: '',
        interest: 'sun',
        opener_id: '',
        selectedOrgs: []
      });
      onDealCreated();
    } catch (error: any) {
      console.error('Error creating deal:', error);
      toast.error('Kunde inte skapa deal');
    } finally {
      setLoading(false);
    }
  };

  const toggleOrganization = (orgId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedOrgs: prev.selectedOrgs.includes(orgId)
        ? prev.selectedOrgs.filter(id => id !== orgId)
        : [...prev.selectedOrgs, orgId]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Ny Deal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Skapa ny deal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-post *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="kontakt@example.com"
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="+46 70 123 45 67"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Adress</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Gatan 1, 123 45 Stad"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="interest">Intresse *</Label>
            <Select
              value={formData.interest}
              onValueChange={(value: InterestType) => setFormData(prev => ({ ...prev, interest: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sun">Sol</SelectItem>
                <SelectItem value="battery">Batteri</SelectItem>
                <SelectItem value="sun_battery">Sol + Batteri</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="opener">Opener *</Label>
            <Select
              value={formData.opener_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, opener_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Välj opener" />
              </SelectTrigger>
              <SelectContent>
                {openers.map((opener) => (
                  <SelectItem key={opener.id} value={opener.id}>
                    {opener.full_name || opener.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.opener_id && <p className="text-sm text-destructive">{errors.opener_id}</p>}
          </div>

          <div className="space-y-2">
            <Label>Organisationer *</Label>
            <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto bg-muted/30">
              {organizations.map((org) => (
                <div key={org.id} className="flex items-center gap-2">
                  <Checkbox
                    id={org.id}
                    checked={formData.selectedOrgs.includes(org.id)}
                    onCheckedChange={() => toggleOrganization(org.id)}
                  />
                  <label htmlFor={org.id} className="text-sm cursor-pointer">
                    {org.name}
                  </label>
                </div>
              ))}
            </div>
            {errors.organizations && <p className="text-sm text-destructive">{errors.organizations}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Skapar...' : 'Skapa Deal'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
