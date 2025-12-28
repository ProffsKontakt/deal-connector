import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CreditCard, AlertTriangle, Send, ShieldX, Clock } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface Contact {
  id: string;
  email: string;
  date_sent: string;
  interest: string;
}

interface OrganizationSettings {
  can_request_credits: boolean;
  credit_deadline_days: number | null;
}

const Kreditera = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<string>('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [canRequestCredits, setCanRequestCredits] = useState<boolean | null>(null);
  const [creditDeadlineDays, setCreditDeadlineDays] = useState<number>(14);

  useEffect(() => {
    if (profile?.organization_id) {
      fetchOrganizationSettings();
      fetchContacts();
    } else {
      setLoading(false);
    }
  }, [profile]);

  const fetchOrganizationSettings = async () => {
    if (!profile?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('can_request_credits, credit_deadline_days')
        .eq('id', profile.organization_id)
        .single();

      if (error) {
        console.error('Error fetching organization settings:', error);
        return;
      }

      setCanRequestCredits(data?.can_request_credits ?? true);
      setCreditDeadlineDays(data?.credit_deadline_days ?? 14);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchContacts = async () => {
    if (!profile?.organization_id) return;

    try {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id,
          email,
          date_sent,
          interest,
          contact_organizations!inner(organization_id)
        `)
        .eq('contact_organizations.organization_id', profile.organization_id)
        .order('date_sent', { ascending: false });

      if (error) {
        console.error('Error fetching contacts:', error);
        return;
      }

      setContacts(data || []);
    } finally {
      setLoading(false);
    }
  };

  // Filter contacts to only show those within the credit deadline
  const eligibleContacts = useMemo(() => {
    return contacts.filter(contact => {
      const daysSinceSent = differenceInDays(new Date(), new Date(contact.date_sent));
      return daysSinceSent <= creditDeadlineDays;
    });
  }, [contacts, creditDeadlineDays]);

  const handleSubmit = async (force = false) => {
    if (!selectedContact || !reason.trim() || !profile?.organization_id) {
      toast({
        title: 'Fyll i alla fält',
        description: 'Välj en deal och ange en anledning',
        variant: 'destructive',
      });
      return;
    }

    const contact = contacts.find(c => c.id === selectedContact);
    if (!contact) return;

    const daysSinceSent = differenceInDays(new Date(), new Date(contact.date_sent));

    // Partners cannot submit credits beyond the deadline (admins don't use this page)
    if (daysSinceSent > creditDeadlineDays) {
      toast({
        title: 'Tidsfristen har passerat',
        description: `Du kan endast kreditera leads inom ${creditDeadlineDays} dagar från mottagning`,
        variant: 'destructive',
      });
      return;
    }

    if (daysSinceSent > 60 && !force) {
      setShowWarning(true);
      setPendingSubmit(true);
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('credit_requests')
        .insert({
          contact_id: selectedContact,
          organization_id: profile.organization_id,
          reason: reason.trim(),
          requested_by: profile.id,
        });

      if (error) {
        console.error('Error submitting credit request:', error);
        toast({
          title: 'Fel',
          description: 'Kunde inte skicka kreditförfrågan',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Förfrågan skickad',
        description: 'Din kreditförfrågan har skickats till administratören',
      });

      setSelectedContact('');
      setReason('');
    } finally {
      setSubmitting(false);
      setPendingSubmit(false);
    }
  };

  // Access denied for non-organization users
  if (profile?.role !== 'organization') {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="glass-card max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Åtkomst nekad</h2>
            <p className="text-muted-foreground">
              Endast organisationer kan skicka kreditförfrågningar
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Organization doesn't have credit permission
  if (canRequestCredits === false) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="glass-card max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <ShieldX className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Kreditering ej tillgängligt</h2>
            <p className="text-muted-foreground">
              Er organisation har inte rättighet att kreditera leads enligt ert partneravtal.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Kontakta oss om du har frågor om ert avtal.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Laddar...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Kreditera Deal</h1>
        <p className="text-muted-foreground mt-1">
          Skicka en kreditförfrågan för en deal
        </p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>Ny kreditförfrågan</CardTitle>
              <CardDescription>
                Välj en deal och ange anledning för krediteringen. Begäran måste göras inom {creditDeadlineDays} dagar.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Deadline info banner */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Clock className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Du har <span className="font-semibold">{creditDeadlineDays} dagar</span> från att ett lead levererades för att kunna begära kreditering.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact">Välj deal (inom tidsfrist)</Label>
            <Select value={selectedContact} onValueChange={setSelectedContact}>
              <SelectTrigger id="contact">
                <SelectValue placeholder="Välj en deal att kreditera" />
              </SelectTrigger>
              <SelectContent>
                {eligibleContacts.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Inga deals tillgängliga inom tidsfristen
                  </SelectItem>
                ) : (
                  eligibleContacts.map((contact) => {
                    const daysLeft = creditDeadlineDays - differenceInDays(new Date(), new Date(contact.date_sent));
                    return (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.email} ({format(new Date(contact.date_sent), 'dd MMM yyyy', { locale: sv })}) – {daysLeft} dagar kvar
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Anledning</Label>
            <Textarea
              id="reason"
              placeholder="Beskriv anledningen till kreditförfrågan..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>

          <Button
            onClick={() => handleSubmit()}
            disabled={submitting || !selectedContact || !reason.trim()}
            className="w-full"
          >
            {submitting ? (
              'Skickar...'
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Skicka förfrågan
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Gammal deal
            </AlertDialogTitle>
            <AlertDialogDescription>
              Denna deal är äldre än 60 dagar. Kreditförfrågningar för gamla deals 
              godkänns sällan. Vill du fortsätta ändå?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingSubmit(false)}>
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleSubmit(true)}>
              Fortsätt ändå
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Kreditera;
