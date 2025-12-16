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
}

export const AddUserDialog = ({ onCreated }: AddUserDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'opener' as UserRole,
  });

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
      // Create user via Supabase Auth (password is automatically hashed)
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
        // Update the profile with the correct role and name
        await supabase
          .from('profiles')
          .update({ 
            role: formData.role,
            full_name: formData.full_name.trim() || null,
          })
          .eq('id', data.user.id);

        // Update user_roles table
        await supabase
          .from('user_roles')
          .update({ role: formData.role })
          .eq('user_id', data.user.id);
      }

      toast.success('Användare skapad');
      setFormData({ email: '', password: '', full_name: '', role: 'opener' });
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lägg till ny användare</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Label htmlFor="user-name">Namn</Label>
            <Input
              id="user-name"
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              placeholder="Förnamn Efternamn"
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
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="teamleader">Teamleader</SelectItem>
                <SelectItem value="opener">Opener</SelectItem>
                <SelectItem value="organization">Partner</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
