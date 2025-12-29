import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type UserRole = Database['public']['Enums']['user_role'];

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  organization_id: string | null;
  personal_number?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  employer_fee_percent?: number | null;
  vacation_pay_percent?: number | null;
  user_type?: string | null;
}

interface Organization {
  id: string;
  name: string;
}

interface EditUserDialogProps {
  user: Profile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export const EditUserDialog = ({ user, open, onOpenChange, onUpdated }: EditUserDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [formData, setFormData] = useState({
    full_name: '',
    role: 'opener' as UserRole,
    organization_id: '' as string,
    personal_number: '',
    bank_name: '',
    account_number: '',
    employer_fee_percent: 31.42,
    vacation_pay_percent: 12,
  });

  const isInternalRole = (role: UserRole) => ['admin', 'teamleader', 'opener', 'closer'].includes(role);

  useEffect(() => {
    if (open) {
      fetchOrganizations();
    }
  }, [open]);

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        role: user.role,
        organization_id: user.organization_id || '',
        personal_number: user.personal_number || '',
        bank_name: user.bank_name || '',
        account_number: user.account_number || '',
        employer_fee_percent: user.employer_fee_percent ?? 31.42,
        vacation_pay_percent: user.vacation_pay_percent ?? 12,
      });
    }
  }, [user]);

  const fetchOrganizations = async () => {
    const { data } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    if (data) setOrganizations(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const updateData: any = {
        full_name: formData.full_name.trim() || null,
        role: formData.role,
        user_type: isInternalRole(formData.role) ? 'internal' : 'external',
      };

      // For partner/organization role, set organization_id
      if (formData.role === 'organization') {
        updateData.organization_id = formData.organization_id || null;
      }

      // Only add internal fields for internal users
      if (isInternalRole(formData.role)) {
        updateData.personal_number = formData.personal_number.trim() || null;
        updateData.bank_name = formData.bank_name.trim() || null;
        updateData.account_number = formData.account_number.trim() || null;
        updateData.employer_fee_percent = formData.employer_fee_percent;
        updateData.vacation_pay_percent = formData.vacation_pay_percent;
        updateData.organization_id = null; // Clear org for internal users
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      // Also update user_roles
      await supabase
        .from('user_roles')
        .update({ role: formData.role })
        .eq('user_id', user.id);

      toast.success('Användare uppdaterad');
      onOpenChange(false);
      onUpdated();
    } catch (error: any) {
      toast.error('Kunde inte uppdatera användare: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Redigera användare</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>E-post</Label>
            <Input value={user.email} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-name">Namn</Label>
            <Input
              id="edit-name"
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              placeholder="Förnamn Efternamn"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-role">Roll</Label>
            <Select
              value={formData.role}
              onValueChange={(value: UserRole) => setFormData(prev => ({ ...prev, role: value }))}
            >
              <SelectTrigger id="edit-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="teamleader">Teamleader</SelectItem>
                <SelectItem value="opener">Opener</SelectItem>
                <SelectItem value="closer">Closer</SelectItem>
                <SelectItem value="organization">Partner</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.role === 'organization' && (
            <div className="space-y-2">
              <Label htmlFor="edit-organization">Kopplat bolag</Label>
              <Select
                value={formData.organization_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, organization_id: value }))}
              >
                <SelectTrigger id="edit-organization">
                  <SelectValue placeholder="Välj bolag..." />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isInternalRole(formData.role) && (
            <>
              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Anställningsinformation</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-personal-number">Personnummer</Label>
                <Input
                  id="edit-personal-number"
                  value={formData.personal_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, personal_number: e.target.value }))}
                  placeholder="YYYYMMDD-XXXX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-bank-name">Banknamn</Label>
                <Input
                  id="edit-bank-name"
                  value={formData.bank_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, bank_name: e.target.value }))}
                  placeholder="t.ex. Nordea"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-account-number">Kontonummer</Label>
                <Input
                  id="edit-account-number"
                  value={formData.account_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, account_number: e.target.value }))}
                  placeholder="XXXX-XXXXXXX"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-employer-fee">Arbetsgivaravgift (%)</Label>
                  <Input
                    id="edit-employer-fee"
                    type="number"
                    step="0.01"
                    value={formData.employer_fee_percent}
                    onChange={(e) => setFormData(prev => ({ ...prev, employer_fee_percent: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-vacation-pay">Semesterersättning (%)</Label>
                  <Input
                    id="edit-vacation-pay"
                    type="number"
                    step="0.01"
                    value={formData.vacation_pay_percent}
                    onChange={(e) => setFormData(prev => ({ ...prev, vacation_pay_percent: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
            </>
          )}

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
