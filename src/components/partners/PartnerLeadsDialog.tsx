import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Sun, Battery, User, Mail, Phone, MapPin } from 'lucide-react';

interface Lead {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  interest: 'sun' | 'battery' | 'sun_battery';
  date_sent: string;
  opener_name: string | null;
}

interface PartnerLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: string | null;
  partnerName: string;
  selectedMonth: string;
  pricePerSolar: number;
  pricePerBattery: number;
}

export function PartnerLeadsDialog({
  open,
  onOpenChange,
  partnerId,
  partnerName,
  selectedMonth,
  pricePerSolar,
  pricePerBattery,
}: PartnerLeadsDialogProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && partnerId) {
      fetchLeads();
    }
  }, [open, partnerId, selectedMonth]);

  const fetchLeads = async () => {
    if (!partnerId) return;
    setLoading(true);

    try {
      // Get contacts linked to this organization
      const { data: contactOrgs } = await supabase
        .from('contact_organizations')
        .select('contact_id')
        .eq('organization_id', partnerId);

      if (!contactOrgs || contactOrgs.length === 0) {
        setLeads([]);
        return;
      }

      const contactIds = contactOrgs.map(co => co.contact_id);

      // Parse the selected month for filtering
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = new Date(year, month - 2, 1); // Previous month (billing month -1)
      const endDate = new Date(year, month - 1, 0); // Last day of previous month

      // Get contacts with opener info
      const { data: contacts } = await supabase
        .from('contacts')
        .select(`
          id,
          name,
          email,
          phone,
          address,
          postal_code,
          interest,
          date_sent,
          opener:profiles!contacts_opener_id_fkey(full_name)
        `)
        .in('id', contactIds)
        .gte('date_sent', format(startDate, 'yyyy-MM-dd'))
        .lte('date_sent', format(endDate, 'yyyy-MM-dd'))
        .order('date_sent', { ascending: false });

      if (contacts) {
        setLeads(contacts.map(c => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          address: c.address,
          postal_code: c.postal_code,
          interest: c.interest,
          date_sent: c.date_sent,
          opener_name: (c.opener as any)?.full_name || null,
        })));
      }
    } finally {
      setLoading(false);
    }
  };

  const getInterestIcon = (interest: string) => {
    switch (interest) {
      case 'sun':
        return <Sun className="w-4 h-4 text-amber-500" />;
      case 'battery':
        return <Battery className="w-4 h-4 text-emerald-500" />;
      case 'sun_battery':
        return (
          <div className="flex items-center gap-0.5">
            <Sun className="w-4 h-4 text-amber-500" />
            <span className="text-xs">+</span>
            <Battery className="w-4 h-4 text-emerald-500" />
          </div>
        );
      default:
        return null;
    }
  };

  const getLeadPrice = (interest: string) => {
    switch (interest) {
      case 'sun':
        return pricePerSolar;
      case 'battery':
        return pricePerBattery;
      case 'sun_battery':
        return pricePerSolar + pricePerBattery;
      default:
        return 0;
    }
  };

  const totalValue = leads.reduce((sum, lead) => sum + getLeadPrice(lead.interest), 0);

  // Parse month for display
  const billingDate = new Date(selectedMonth + '-01');
  const leadsMonthLabel = format(new Date(billingDate.getFullYear(), billingDate.getMonth() - 1, 1), 'MMMM yyyy', { locale: sv });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Faktureringsunderlag – {partnerName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Leads från {leadsMonthLabel}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Inga leads hittades för denna period
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Datum</TableHead>
                    <TableHead>Kund</TableHead>
                    <TableHead>Kontakt</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Opener</TableHead>
                    <TableHead className="text-right">Pris</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="text-sm">
                        {format(new Date(lead.date_sent), 'd MMM', { locale: sv })}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-medium">{lead.name || 'Okänd'}</p>
                          {lead.address && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {lead.address} {lead.postal_code}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5 text-sm">
                          <p className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-muted-foreground" />
                            {lead.email}
                          </p>
                          {lead.phone && (
                            <p className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              {lead.phone}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1">
                          {getInterestIcon(lead.interest)}
                          {lead.interest === 'sun' && 'Sol'}
                          {lead.interest === 'battery' && 'Batteri'}
                          {lead.interest === 'sun_battery' && 'Sol+Batteri'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <User className="w-3 h-3" />
                          {lead.opener_name || 'Okänd'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {getLeadPrice(lead.interest).toLocaleString('sv-SE')} kr
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Summary */}
        {leads.length > 0 && (
          <div className="border-t pt-4 mt-4">
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Totalt {leads.length} leads
              </div>
              <div className="text-lg font-bold text-primary">
                Att fakturera: {totalValue.toLocaleString('sv-SE')} kr
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
