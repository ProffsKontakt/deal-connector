import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { ResizableTableHead } from '@/components/ui/resizable-table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { CreateOrganizationDialog } from '@/components/admin/CreateOrganizationDialog';
import { BulkImportPartnersDialog } from '@/components/admin/BulkImportPartnersDialog';
import { EditPartnerDialog } from '@/components/admin/EditPartnerDialog';
import { CollapsibleSection } from '@/components/partners/CollapsibleSection';
import { PartnerGoalsSettings, DEFAULT_SETTINGS, getThresholdColor, type ThresholdSettings } from '@/components/partners/PartnerGoalsSettings';
import { PartnerBriefingDialog } from '@/components/partners/PartnerBriefingDialog';
import { InvoicingOverview } from '@/components/partners/InvoicingOverview';
import { CreditsManagement } from '@/components/partners/CreditsManagement';
import { PartnerOverviewStats } from '@/components/partners/PartnerOverviewStats';
import { Building2, TrendingUp, Sun, Battery, Calendar, Archive, Trash2, ExternalLink, Target, FileText, CreditCard, Settings2 } from 'lucide-react';
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
  pricePerSolar: number;
  pricePerBattery: number;
  closeRate: number;
}

interface Organization {
  id: string;
  name: string;
  status: 'active' | 'archived';
  contact_person_name: string | null;
  contact_phone: string | null;
  price_per_solar_deal: number | null;
  price_per_battery_deal: number | null;
  price_per_site_visit: number | null;
  is_sales_consultant?: boolean;
  billing_model?: string;
}

const Partners = () => {
  const { profile } = useAuth();
  const [partners, setPartners] = useState<PartnerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>('active');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return format(subMonths(now, 1), 'yyyy-MM');
  });
  const [deletePartner, setDeletePartner] = useState<{ id: string; name: string } | null>(null);
  const [briefingPartner, setBriefingPartner] = useState<PartnerStats | null>(null);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [thresholdSettings, setThresholdSettings] = useState<ThresholdSettings>(DEFAULT_SETTINGS);

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
      const billingDate = new Date(selectedMonth + '-01');
      const leadsStart = startOfMonth(subMonths(billingDate, 1));
      const leadsEnd = endOfMonth(subMonths(billingDate, 1));

      const { data: organizations } = await supabase
        .from('organizations')
        .select('id, name, price_per_solar_deal, price_per_battery_deal, price_per_site_visit, status, contact_person_name, contact_phone, is_sales_consultant, billing_model')
        .eq('status', statusFilter);

      if (!organizations) {
        setPartners([]);
        return;
      }

      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, interest, date_sent')
        .gte('date_sent', format(leadsStart, 'yyyy-MM-dd'))
        .lte('date_sent', format(leadsEnd, 'yyyy-MM-dd'));

      const { data: contactOrgs } = await supabase
        .from('contact_organizations')
        .select('organization_id, contact_id');

      const { data: creditRequests } = await supabase
        .from('credit_requests')
        .select('organization_id, status, contact_id');

      const { data: sales } = await supabase
        .from('sales')
        .select('organization_id, pipeline_status');

      const contactInterestMap = new Map(contacts?.map(c => [c.id, c.interest]) || []);
      const contactIdsInPeriod = new Set(contacts?.map(c => c.id) || []);

      const partnerStats: PartnerStats[] = organizations.map((org) => {
        const orgContactLinks = contactOrgs?.filter(co => 
          co.organization_id === org.id && contactIdsInPeriod.has(co.contact_id)
        ) || [];
        
        const orgCredits = creditRequests?.filter(cr => cr.organization_id === org.id) || [];
        const orgSales = sales?.filter(s => s.organization_id === org.id) || [];
        
        let solarLeads = 0;
        let batteryLeads = 0;
        let sunBatteryLeads = 0;

        orgContactLinks.forEach(link => {
          const interest = contactInterestMap.get(link.contact_id);
          if (interest === 'sun') solarLeads++;
          else if (interest === 'battery') batteryLeads++;
          else if (interest === 'sun_battery') sunBatteryLeads++;
        });
        
        const solarPrice = org.price_per_solar_deal || 0;
        const batteryPrice = org.price_per_battery_deal || 0;
        const totalValue = (solarLeads * solarPrice) + (batteryLeads * batteryPrice) + (sunBatteryLeads * (solarPrice + batteryPrice));

        const requestedCredits = orgCredits.length;
        const approvedCredits = orgCredits.filter(cr => cr.status === 'approved').length;

        const totalDeals = orgSales.length;
        const wonDeals = orgSales.filter(s => s.pipeline_status === 'won').length;
        const closeRate = totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0;

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
          pricePerSolar: solarPrice,
          pricePerBattery: batteryPrice,
          closeRate,
        };
      });

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
      toast.error('Kunde inte arkivera partner');
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
      toast.error('Kunde inte aktivera partner');
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
      toast.error('Kunde inte ta bort partner: ' + error.message);
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

  const billingDate = new Date(selectedMonth + '-01');
  const leadsMonthLabel = format(subMonths(billingDate, 1), 'MMMM yyyy', { locale: sv });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="page-header mb-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <h1 className="page-title">Partners</h1>
          </div>
          <p className="page-description">Lead-strategin & partnerhantering</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      {/* Overview Stats */}
      <PartnerOverviewStats selectedMonth={selectedMonth} />

      {/* Goals Settings */}
      <CollapsibleSection title="Mål & Tröskelvärden" icon={<Target className="w-5 h-5 text-primary" />} defaultOpen={false}>
        <PartnerGoalsSettings onSettingsChange={setThresholdSettings} />
      </CollapsibleSection>

      {/* Partner Statistics */}
      <CollapsibleSection title="Partner-statistik" icon={<TrendingUp className="w-5 h-5 text-primary" />}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Leads skapade i {leadsMonthLabel}
            </p>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <Button variant={statusFilter === 'active' ? 'default' : 'ghost'} size="sm" onClick={() => setStatusFilter('active')} className="rounded-none">
                Aktiv
              </Button>
              <Button variant={statusFilter === 'archived' ? 'default' : 'ghost'} size="sm" onClick={() => setStatusFilter('archived')} className="rounded-none">
                Avstängd
              </Button>
            </div>
          </div>

          {partners.length === 0 ? (
            <EmptyState icon={Building2} title={statusFilter === 'active' ? 'Inga aktiva partners' : 'Inga arkiverade partners'} description="Lägg till partners för att se statistik" />
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <ResizableTableHead className="font-semibold">Partner</ResizableTableHead>
                    <ResizableTableHead className="text-center font-semibold">Totalt</ResizableTableHead>
                    <ResizableTableHead className="text-center font-semibold"><Sun className="w-4 h-4 text-amber-500 mx-auto" /></ResizableTableHead>
                    <ResizableTableHead className="text-center font-semibold"><Battery className="w-4 h-4 text-emerald-500 mx-auto" /></ResizableTableHead>
                    <ResizableTableHead className="text-center font-semibold">Close rate</ResizableTableHead>
                    <ResizableTableHead className="text-right font-semibold">Att fakturera</ResizableTableHead>
                    <ResizableTableHead className="w-32 font-semibold">Åtgärder</ResizableTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map((partner) => (
                    <TableRow key={partner.id} className="hover:bg-muted/30 group">
                      <TableCell>
                        <button className="text-left group/name hover:underline" onClick={() => setBriefingPartner(partner)}>
                          <div className="flex items-center gap-1">
                            <p className="font-medium">{partner.name}</p>
                            <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover/name:opacity-100 transition-opacity" />
                          </div>
                          {partner.contact_person_name && <p className="text-xs text-muted-foreground">{partner.contact_person_name}</p>}
                        </button>
                      </TableCell>
                      <TableCell className="text-center"><span className="font-semibold text-primary">{partner.totalLeads}</span></TableCell>
                      <TableCell className="text-center">{partner.solarLeads + partner.sunBatteryLeads}</TableCell>
                      <TableCell className="text-center">{partner.batteryLeads + partner.sunBatteryLeads}</TableCell>
                      <TableCell className="text-center"><span className={`px-2 py-1 rounded text-sm font-medium ${partner.closeRate >= 20 ? 'text-emerald-600 bg-emerald-500/10' : partner.closeRate >= 10 ? 'text-amber-600 bg-amber-500/10' : 'text-red-600 bg-red-500/10'}`}>{partner.closeRate.toFixed(0)}%</span></TableCell>
                      <TableCell className="text-right"><span className="font-semibold text-success">{partner.totalValue.toLocaleString('sv-SE')} kr</span></TableCell>
                      <TableCell>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="ghost" onClick={() => setBriefingPartner(partner)} title="Visa"><ExternalLink className="w-4 h-4" /></Button>
                          {statusFilter === 'active' ? (
                            <Button size="sm" variant="ghost" onClick={() => handleArchivePartner(partner.id)} title="Arkivera"><Archive className="w-4 h-4" /></Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => handleActivatePartner(partner.id)} title="Aktivera"><Building2 className="w-4 h-4" /></Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeletePartner({ id: partner.id, name: partner.name })} title="Ta bort"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Invoicing Overview */}
      <CollapsibleSection title="Faktureringsunderlag" icon={<FileText className="w-5 h-5 text-primary" />} defaultOpen={false}>
        <InvoicingOverview selectedMonth={selectedMonth} onPartnerClick={(id, name) => {
          const p = partners.find(p => p.id === id);
          if (p) setBriefingPartner(p);
        }} />
      </CollapsibleSection>

      {/* Credits Management */}
      <CollapsibleSection title="Krediter" icon={<CreditCard className="w-5 h-5 text-primary" />} defaultOpen={false}>
        <CreditsManagement onUpdate={fetchPartnerStats} />
      </CollapsibleSection>

      {/* Partner Briefing Dialog */}
      <PartnerBriefingDialog
        open={!!briefingPartner}
        onOpenChange={(open) => !open && setBriefingPartner(null)}
        partner={briefingPartner}
        selectedMonth={selectedMonth}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deletePartner} onOpenChange={() => setDeletePartner(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort partner?</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ta bort <strong>{deletePartner?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePartner} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Ta bort</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditPartnerDialog partner={editingOrg} open={!!editingOrg} onOpenChange={(open) => !open && setEditingOrg(null)} onUpdated={fetchPartnerStats} />
    </div>
  );
};

export default Partners;
