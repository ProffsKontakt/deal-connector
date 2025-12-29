import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type UserRole = Database['public']['Enums']['user_role'];

interface AddUserDialogProps {
  onCreated: () => void;
  defaultUserType?: 'internal' | 'external';
}

export const AddUserDialog = ({ onCreated, defaultUserType = 'internal' }: AddUserDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: (defaultUserType === 'internal' ? 'opener' : 'organization') as UserRole,
    personal_number: '',
    bank_name: '',
    account_number: '',
    employer_fee_percent: 31.42,
    vacation_pay_percent: 12,
  });

  const isInternalRole = (role: UserRole) => ['admin', 'teamleader', 'opener', 'closer'].includes(role);

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

    setLoading(true);
    try {
      // Save current admin session BEFORE creating new user
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession) {
        toast.error('Du måste vara inloggad som admin');
        setLoading(false);
        return;
      }

      // Store the admin tokens
      const adminAccessToken = currentSession.access_token;
      const adminRefreshToken = currentSession.refresh_token;

      // Create user via Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name.trim() || null,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Prepare profile update data
        const profileUpdate: any = { 
          role: formData.role,
          full_name: formData.full_name.trim() || null,
          user_type: isInternalRole(formData.role) ? 'internal' : 'external',
        };

        // Add internal fields only for internal users
        if (isInternalRole(formData.role)) {
          profileUpdate.personal_number = formData.personal_number.trim() || null;
          profileUpdate.bank_name = formData.bank_name.trim() || null;
          profileUpdate.account_number = formData.account_number.trim() || null;
          profileUpdate.employer_fee_percent = formData.employer_fee_percent;
          profileUpdate.vacation_pay_percent = formData.vacation_pay_percent;
        }

        // Update the profile with the correct role and additional fields
        await supabase
          .from('profiles')
          .update(profileUpdate)
          .eq('id', data.user.id);

        // Update user_roles table
        await supabase
          .from('user_roles')
          .update({ role: formData.role })
          .eq('user_id', data.user.id);
      }

      // IMMEDIATELY restore the admin's session - this is critical
      await supabase.auth.setSession({
        access_token: adminAccessToken,
        refresh_token: adminRefreshToken,
      });

      toast.success('Användare skapad');
      setFormData({ 
        email: '', 
        password: '', 
        full_name: '', 
        role: defaultUserType === 'internal' ? 'opener' : 'organization',
        personal_number: '',
        bank_name: '',
        account_number: '',
        employer_fee_percent: 31.42,
        vacation_pay_percent: 12,
      });
      setOpen(false);
      onCreated();
    } catch (error: any) {
      toast.error('Kunde inte skapa användare: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="w-4 h-4" />
          Lägg till användare
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lägg till ny användare</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-name">Namn</Label>
            <Input
              id="user-name"
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              placeholder="Förnamn Efternamn"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-email">E-post *</Label>
            <Input
              id="user-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="exempel@email.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-password">Lösenord *</Label>
            <Input
              id="user-password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              placeholder="Minst 6 tecken"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-role">Roll</Label>
            <Select
              value={formData.role}
              onValueChange={(value: UserRole) => setFormData(prev => ({ ...prev, role: value }))}
            >
              <SelectTrigger id="user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {defaultUserType === 'internal' ? (
                  <>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="teamleader">Teamleader</SelectItem>
                    <SelectItem value="opener">Opener</SelectItem>
                    <SelectItem value="closer">Closer</SelectItem>
                  </>
                ) : (
                  <SelectItem value="organization">Partner</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {isInternalRole(formData.role) && (
            <>
              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Anställningsinformation</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-personal-number">Personnummer</Label>
                <Input
                  id="user-personal-number"
                  value={formData.personal_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, personal_number: e.target.value }))}
                  placeholder="YYYYMMDD-XXXX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-bank-name">Banknamn</Label>
                <Input
                  id="user-bank-name"
                  value={formData.bank_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, bank_name: e.target.value }))}
                  placeholder="t.ex. Nordea"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-account-number">Kontonummer</Label>
                <Input
                  id="user-account-number"
                  value={formData.account_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, account_number: e.target.value }))}
                  placeholder="XXXX-XXXXXXX"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="user-employer-fee">Arbetsgivaravgift (%)</Label>
                  <Input
                    id="user-employer-fee"
                    type="number"
                    step="0.01"
                    value={formData.employer_fee_percent}
                    onChange={(e) => setFormData(prev => ({ ...prev, employer_fee_percent: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-vacation-pay">Semesterersättning (%)</Label>
                  <Input
                    id="user-vacation-pay"
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Skapar...' : 'Skapa användare'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
