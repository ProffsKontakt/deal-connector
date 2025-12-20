import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';

interface CreateOpenerDialogProps {
  onCreated: () => void;
}

export const CreateOpenerDialog = ({ onCreated }: CreateOpenerDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    commission_per_lead: '200',
    commission_per_deal: '1000',
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
        // Update the profile with opener role, name and commissions
        await supabase
          .from('profiles')
          .update({ 
            role: 'opener',
            full_name: formData.full_name.trim() || null,
            opener_commission_per_lead: parseFloat(formData.commission_per_lead) || 200,
            opener_commission_per_deal: parseFloat(formData.commission_per_deal) || 1000,
          })
          .eq('id', data.user.id);

        // Update user_roles table
        await supabase
          .from('user_roles')
          .update({ role: 'opener' })
          .eq('user_id', data.user.id);
      }

      toast.success('Opener skapad');
      setFormData({ email: '', password: '', full_name: '', commission_per_lead: '200', commission_per_deal: '1000' });
      setOpen(false);
      onCreated();
    } catch (error: any) {
      toast.error('Kunde inte skapa opener: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="w-4 h-4" />
          Skapa opener
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Skapa ny opener</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="opener-name">Namn *</Label>
            <Input
              id="opener-name"
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              placeholder="Förnamn Efternamn"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="opener-email">E-post *</Label>
            <Input
              id="opener-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="exempel@email.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="opener-password">Lösenord *</Label>
            <Input
              id="opener-password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              placeholder="Minst 6 tecken"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="opener-commission-lead">Provision per lead (kr)</Label>
            <Input
              id="opener-commission-lead"
              type="number"
              value={formData.commission_per_lead}
              onChange={(e) => setFormData(prev => ({ ...prev, commission_per_lead: e.target.value }))}
              placeholder="200"
            />
            <p className="text-xs text-muted-foreground">Standard: 200 kr per genererat lead</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="opener-commission-deal">Bonus vid stängd affär (kr)</Label>
            <Input
              id="opener-commission-deal"
              type="number"
              value={formData.commission_per_deal}
              onChange={(e) => setFormData(prev => ({ ...prev, commission_per_deal: e.target.value }))}
              placeholder="1000"
            />
            <p className="text-xs text-muted-foreground">Standard: 1 000 kr när deras lead leder till affär</p>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Skapar...' : 'Skapa opener'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
