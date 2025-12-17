import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { CreateOrganizationDialog } from '@/components/admin/CreateOrganizationDialog';
import { BulkImportPartnersDialog } from '@/components/admin/BulkImportPartnersDialog';
import { Building2, TrendingUp, Sun, Battery, Calendar, Archive, Trash2 } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { sv } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PartnerStats {
  id: string;
  name: string;
  status: 'active' | 'archived';
  contact_person_name: string | null;
  contact_phone: string | null;
  totalLeads: number;
  solarLeads: number;
  batteryLeads: number;
  sunBatteryLeads: number;
  totalValue: number;
  requestedCredits: number;
  approvedCredits: number;
}

const Partners = () => {
  const { profile } = useAuth();
  const [partners, setPartners] = useState<PartnerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>('active');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    // Default to previous month (billing month)
    const now = new Date();
    return format(subMonths(now, 1), 'yyyy-MM');
  });
  const [deletePartner, setDeletePartner] = useState<{ id: string; name: string } | null>(null);

  // Generate month options (last 12 months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: sv })
    };
  });

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchPartnerStats();
    }
  }, [profile, statusFilter, selectedMonth]);

  const fetchPartnerStats = async () => {
    try {
      // Calculate the billing period (leads from previous month are billed this month)
      const billingDate = new Date(selectedMonth + '-01');
      const leadsMonth = subMonths(billingDate, 0); // The month we're billing for
      const leadsStart = startOfMonth(subMonths(leadsMonth, 1)); // Leads created in previous month
      const leadsEnd = endOfMonth(subMonths(leadsMonth, 1));

      // Fetch organizations with status filter
      const { data: organizations } = await supabase
        .from('organizations')
        .select('id, name, price_per_solar_deal, price_per_battery_deal, price_per_site_visit, status, contact_person_name, contact_phone')
        .eq('status', statusFilter);

      if (!organizations) {
        setPartners([]);
        return;
      }

      // Fetch contacts created in the billing period
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, interest, date_sent')
        .gte('date_sent', format(leadsStart, 'yyyy-MM-dd'))
        .lte('date_sent', format(leadsEnd, 'yyyy-MM-dd'));

      // Fetch contact-organization relationships
      const { data: contactOrgs } = await supabase
        .from('contact_organizations')
        .select('organization_id, contact_id');

      // Fetch credit requests
      const { data: creditRequests } = await supabase
        .from('credit_requests')
        .select('organization_id, status, contact_id');

      const contactInterestMap = new Map(contacts?.map(c => [c.id, c.interest]) || []);
      const contactIdsInPeriod = new Set(contacts?.map(c => c.id) || []);

      const partnerStats: PartnerStats[] = organizations.map((org) => {
        // Filter to only contacts in billing period
        const orgContactLinks = contactOrgs?.filter(co => 
          co.organization_id === org.id && contactIdsInPeriod.has(co.contact_id)
        ) || [];
        
        const orgCredits = creditRequests?.filter(cr => cr.organization_id === org.id) || [];
        
        let solarLeads = 0;
        let batteryLeads = 0;
        let sunBatteryLeads = 0;

        orgContactLinks.forEach(link => {
          const interest = contactInterestMap.get(link.contact_id);
          if (interest === 'sun') solarLeads++;
          else if (interest === 'battery') batteryLeads++;
          else if (interest === 'sun_battery') sunBatteryLeads++;
        });
        
        // Calculate total value
        const solarPrice = org.price_per_solar_deal || 0;
        const batteryPrice = org.price_per_battery_deal || 0;
        const totalValue = (solarLeads * solarPrice) + (batteryLeads * batteryPrice) + (sunBatteryLeads * (solarPrice + batteryPrice));

        // Count credit requests
        const requestedCredits = orgCredits.length;
        const approvedCredits = orgCredits.filter(cr => cr.status === 'approved').length;

        return {
          id: org.id,
          name: org.name,
          status: org.status as 'active' | 'archived',
          contact_person_name: org.contact_person_name,
          contact_phone: org.contact_phone,
          totalLeads: orgContactLinks.length,
          solarLeads,
          batteryLeads,
          sunBatteryLeads,
          totalValue,
          requestedCredits,
          approvedCredits,
        };
      });

      // Sort by total leads descending
      partnerStats.sort((a, b) => b.totalLeads - a.totalLeads);
      setPartners(partnerStats);
    } finally {
      setLoading(false);
    }
  };

  const handleArchivePartner = async (partnerId: string) => {
    const { error } = await supabase
      .from('organizations')
      .update({ status: 'archived' })
      .eq('id', partnerId);

    if (error) {
      toast.error('⚠️ Kunde inte arkivera partner');
      return;
    }

    toast.success('Partner arkiverad');
    fetchPartnerStats();
  };

  const handleActivatePartner = async (partnerId: string) => {
    const { error } = await supabase
      .from('organizations')
      .update({ status: 'active' })
      .eq('id', partnerId);

    if (error) {
      toast.error('⚠️ Kunde inte aktivera partner');
      return;
    }

    toast.success('Partner aktiverad');
    fetchPartnerStats();
  };

  const handleDeletePartner = async () => {
    if (!deletePartner) return;

    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', deletePartner.id);

    if (error) {
      toast.error('⚠️ Kunde inte ta bort partner: ' + error.message);
      return;
    }

    toast.success('Partner borttagen');
    setDeletePartner(null);
    fetchPartnerStats();
  };

  if (profile?.role !== 'admin') {
    return <Navigate to="/deals" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground text-sm">Laddar partners...</span>
        </div>
      </div>
    );
  }

  // Get the leads month label (month before billing month)
  const billingDate = new Date(selectedMonth + '-01');
  const leadsMonthLabel = format(subMonths(billingDate, 1), 'MMMM yyyy', { locale: sv });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <h1 className="page-title">Partners</h1>
        </div>
        <p className="page-description">
          Översikt av leads skickade till varje partner
        </p>
      </div>

      {/* Partners Table */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle>Partner-statistik</CardTitle>
              </div>
              <CardDescription>
                Leads skapade i {leadsMonthLabel} – faktureras i {format(billingDate, 'MMMM yyyy', { locale: sv })}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Status filter buttons */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                <Button
                  variant={statusFilter === 'active' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter('active')}
                  className="rounded-none"
                >
                  Aktiv
                </Button>
                <Button
                  variant={statusFilter === 'archived' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter('archived')}
                  className="rounded-none"
                >
                  Avstängd
                </Button>
              </div>
              
              {/* Month selector */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <BulkImportPartnersDialog onImported={fetchPartnerStats} />
              <CreateOrganizationDialog onCreated={fetchPartnerStats} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {partners.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={statusFilter === 'active' ? 'Inga aktiva partners' : 'Inga arkiverade partners'}
              description={statusFilter === 'active' 
                ? 'Det finns inga aktiva partners registrerade ännu' 
                : 'Det finns inga arkiverade partners'}
            />
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold">Partner</TableHead>
                    <TableHead className="text-center font-semibold">Totalt</TableHead>
                    <TableHead className="text-center font-semibold">
                      <div className="flex items-center justify-center gap-1">
                        <Sun className="w-4 h-4 text-amber-500" />
                        Sol
                      </div>
                    </TableHead>
                    <TableHead className="text-center font-semibold">
                      <div className="flex items-center justify-center gap-1">
                        <Battery className="w-4 h-4 text-emerald-500" />
                        Batteri
                      </div>
                    </TableHead>
                    <TableHead className="text-center font-semibold">
                      <div className="flex items-center justify-center gap-1">
                        <Sun className="w-4 h-4 text-amber-500" />
                        +
                        <Battery className="w-4 h-4 text-emerald-500" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right font-semibold">Att fakturera</TableHead>
                    <TableHead className="text-center font-semibold">Önskade krediter</TableHead>
                    <TableHead className="text-center font-semibold">Godkända krediter</TableHead>
                    <TableHead className="w-28 font-semibold">Åtgärder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map((partner) => (
                    <TableRow key={partner.id} className="hover:bg-muted/30 group">
                      <TableCell>
                        <div>
                          <p className="font-medium">{partner.name}</p>
                          {partner.contact_person_name && (
                            <p className="text-xs text-muted-foreground">{partner.contact_person_name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold text-primary">{partner.totalLeads}</span>
                      </TableCell>
                      <TableCell className="text-center">{partner.solarLeads}</TableCell>
                      <TableCell className="text-center">{partner.batteryLeads}</TableCell>
                      <TableCell className="text-center">{partner.sunBatteryLeads}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-success">
                          {partner.totalValue.toLocaleString('sv-SE')} kr
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium text-amber-600">{partner.requestedCredits}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium text-emerald-600">{partner.approvedCredits}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {statusFilter === 'active' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleArchivePartner(partner.id)}
                              title="Arkivera"
                            >
                              <Archive className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleActivatePartner(partner.id)}
                              title="Aktivera"
                            >
                              <Building2 className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeletePartner({ id: partner.id, name: partner.name })}
                            title="Ta bort"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletePartner} onOpenChange={() => setDeletePartner(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort partner?</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ta bort <strong>{deletePartner?.name}</strong>? 
              Detta kan inte ångras och all data kopplad till denna partner kan påverkas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePartner} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Partners;
