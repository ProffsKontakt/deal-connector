import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface EditOpenerDialogProps {
  opener: {
    id: string;
    email: string;
    full_name: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export const EditOpenerDialog = ({ opener, open, onOpenChange, onUpdated }: EditOpenerDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    opener_commission_per_lead: '200',
    opener_commission_per_deal: '1000',
  });

  useEffect(() => {
    if (opener && open) {
      fetchOpenerDetails();
    }
  }, [opener, open]);

  const fetchOpenerDetails = async () => {
    if (!opener) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('full_name, opener_commission_per_lead, opener_commission_per_deal')
      .eq('id', opener.id)
      .single();
    
    if (data) {
      setFormData({
        full_name: data.full_name || '',
        opener_commission_per_lead: (data.opener_commission_per_lead ?? 200).toString(),
        opener_commission_per_deal: (data.opener_commission_per_deal ?? 1000).toString(),
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opener) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name.trim() || null,
          opener_commission_per_lead: parseFloat(formData.opener_commission_per_lead) || 200,
          opener_commission_per_deal: parseFloat(formData.opener_commission_per_deal) || 1000,
        })
        .eq('id', opener.id);

      if (error) throw error;

      toast.success('Opener uppdaterad');
      onOpenChange(false);
      onUpdated();
    } catch (error: any) {
      toast.error('Kunde inte uppdatera opener: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!opener) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Redigera opener</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>E-post</Label>
            <Input value={opener.email} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-opener-name">Namn</Label>
            <Input
              id="edit-opener-name"
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              placeholder="Förnamn Efternamn"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-opener-commission-lead">Provision per lead (kr)</Label>
            <Input
              id="edit-opener-commission-lead"
              type="number"
              value={formData.opener_commission_per_lead}
              onChange={(e) => setFormData(prev => ({ ...prev, opener_commission_per_lead: e.target.value }))}
              placeholder="200"
            />
            <p className="text-xs text-muted-foreground">
              Standard: 200 kr per genererat lead
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-opener-commission-deal">Bonus vid stängd affär (kr)</Label>
            <Input
              id="edit-opener-commission-deal"
              type="number"
              value={formData.opener_commission_per_deal}
              onChange={(e) => setFormData(prev => ({ ...prev, opener_commission_per_deal: e.target.value }))}
              placeholder="1000"
            />
            <p className="text-xs text-muted-foreground">
              Standard: 1 000 kr när deras lead leder till affär
            </p>
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
