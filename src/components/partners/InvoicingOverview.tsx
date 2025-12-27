import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { ResizableTableHead } from '@/components/ui/resizable-table';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { sv } from 'date-fns/locale';
import { FileText, Copy, Download, Sun, Battery, ExternalLink } from 'lucide-react';

interface PartnerInvoice {
  id: string;
  name: string;
  solarLeads: number;
  batteryLeads: number;
  sunBatteryLeads: number;
  totalLeads: number;
  pricePerSolar: number;
  pricePerBattery: number;
  totalValue: number;
}

interface InvoicingOverviewProps {
  selectedMonth: string;
  onPartnerClick?: (partnerId: string, partnerName: string) => void;
}

export function InvoicingOverview({ selectedMonth, onPartnerClick }: InvoicingOverviewProps) {
  const [invoices, setInvoices] = useState<PartnerInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoiceData();
  }, [selectedMonth]);

  const fetchInvoiceData = async () => {
    try {
      const billingDate = new Date(selectedMonth + '-01');
      const leadsStart = startOfMonth(subMonths(billingDate, 1));
      const leadsEnd = endOfMonth(subMonths(billingDate, 1));

      // Fetch active organizations
      const { data: organizations } = await supabase
        .from('organizations')
        .select('id, name, price_per_solar_deal, price_per_battery_deal')
        .eq('status', 'active');

      if (!organizations) {
        setInvoices([]);
        return;
      }

      // Fetch contacts in billing period
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, interest, date_sent')
        .gte('date_sent', format(leadsStart, 'yyyy-MM-dd'))
        .lte('date_sent', format(leadsEnd, 'yyyy-MM-dd'));

      // Fetch contact-org links
      const { data: contactOrgs } = await supabase
        .from('contact_organizations')
        .select('organization_id, contact_id');

      // Fetch approved credits to exclude
      const { data: creditRequests } = await supabase
        .from('credit_requests')
        .select('contact_id, organization_id')
        .eq('status', 'approved');

      const contactInterestMap = new Map(contacts?.map(c => [c.id, c.interest]) || []);
      const contactIdsInPeriod = new Set(contacts?.map(c => c.id) || []);
      const approvedCredits = new Set(
        creditRequests?.map(cr => `${cr.contact_id}-${cr.organization_id}`) || []
      );

      const partnerInvoices: PartnerInvoice[] = organizations.map((org) => {
        const orgContactLinks = contactOrgs?.filter(co => 
          co.organization_id === org.id && contactIdsInPeriod.has(co.contact_id)
        ) || [];
        
        let solarLeads = 0;
        let batteryLeads = 0;
        let sunBatteryLeads = 0;

        orgContactLinks.forEach(link => {
          // Skip if this lead was credited
          if (approvedCredits.has(`${link.contact_id}-${org.id}`)) return;
          
          const interest = contactInterestMap.get(link.contact_id);
          if (interest === 'sun') solarLeads++;
          else if (interest === 'battery') batteryLeads++;
          else if (interest === 'sun_battery') sunBatteryLeads++;
        });

        const pricePerSolar = org.price_per_solar_deal || 0;
        const pricePerBattery = org.price_per_battery_deal || 0;
        const totalValue = (solarLeads * pricePerSolar) + 
                          (batteryLeads * pricePerBattery) + 
                          (sunBatteryLeads * (pricePerSolar + pricePerBattery));

        return {
          id: org.id,
          name: org.name,
          solarLeads,
          batteryLeads,
          sunBatteryLeads,
          totalLeads: solarLeads + batteryLeads + sunBatteryLeads,
          pricePerSolar,
          pricePerBattery,
          totalValue,
        };
      }).filter(i => i.totalLeads > 0).sort((a, b) => b.totalValue - a.totalValue);

      setInvoices(partnerInvoices);
    } finally {
      setLoading(false);
    }
  };

  const billingDate = new Date(selectedMonth + '-01');
  const leadsMonthLabel = format(subMonths(billingDate, 1), 'MMMM yyyy', { locale: sv });
  const totalSum = invoices.reduce((sum, i) => sum + i.totalValue, 0);

  const handleCopyAll = () => {
    const headers = ['Partner', 'Sol', 'Batteri', 'Sol+Batteri', 'Totalt', 'Belopp'];
    const rows = invoices.map(i => [
      i.name,
      i.solarLeads.toString(),
      i.batteryLeads.toString(),
      i.sunBatteryLeads.toString(),
      i.totalLeads.toString(),
      i.totalValue.toString(),
    ]);
    rows.push(['', '', '', '', 'TOTALT', totalSum.toString()]);
    
    const tableText = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
    navigator.clipboard.writeText(tableText);
    toast.success('Tabell kopierad');
  };

  const handleExportCSV = () => {
    const headers = ['Partner', 'Sol', 'Batteri', 'Sol+Batteri', 'Totalt leads', 'Sol-pris', 'Batteri-pris', 'Totalt belopp'];
    const rows = invoices.map(i => [
      i.name,
      i.solarLeads.toString(),
      i.batteryLeads.toString(),
      i.sunBatteryLeads.toString(),
      i.totalLeads.toString(),
      i.pricePerSolar.toString(),
      i.pricePerBattery.toString(),
      i.totalValue.toString(),
    ]);
    
    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `faktureringsunderlag_alla_${selectedMonth}.csv`;
    link.click();
    toast.success('Exporterad till CSV');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Inga fakturor"
        description={`Inga leads att fakturera för ${leadsMonthLabel}`}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Fakturering för leads från {leadsMonthLabel}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyAll}>
            <Copy className="w-4 h-4 mr-1" />
            Kopiera
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-1" />
            Exportera
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <ResizableTableHead className="font-semibold">Partner</ResizableTableHead>
              <ResizableTableHead className="text-center font-semibold">
                <div className="flex items-center justify-center gap-1">
                  <Sun className="w-4 h-4 text-amber-500" />
                  Sol
                </div>
              </ResizableTableHead>
              <ResizableTableHead className="text-center font-semibold">
                <div className="flex items-center justify-center gap-1">
                  <Battery className="w-4 h-4 text-emerald-500" />
                  Batteri
                </div>
              </ResizableTableHead>
              <ResizableTableHead className="text-center font-semibold">Sol+Bat</ResizableTableHead>
              <ResizableTableHead className="text-center font-semibold">Totalt</ResizableTableHead>
              <ResizableTableHead className="text-right font-semibold">Belopp</ResizableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow 
                key={invoice.id} 
                className="hover:bg-muted/30 cursor-pointer group"
                onClick={() => onPartnerClick?.(invoice.id, invoice.name)}
              >
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">{invoice.name}</span>
                    <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </TableCell>
                <TableCell className="text-center">{invoice.solarLeads}</TableCell>
                <TableCell className="text-center">{invoice.batteryLeads}</TableCell>
                <TableCell className="text-center">{invoice.sunBatteryLeads}</TableCell>
                <TableCell className="text-center font-semibold text-primary">{invoice.totalLeads}</TableCell>
                <TableCell className="text-right font-semibold text-success">
                  {invoice.totalValue.toLocaleString('sv-SE')} kr
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/30 font-bold">
              <TableCell>Totalt</TableCell>
              <TableCell className="text-center">{invoices.reduce((s, i) => s + i.solarLeads, 0)}</TableCell>
              <TableCell className="text-center">{invoices.reduce((s, i) => s + i.batteryLeads, 0)}</TableCell>
              <TableCell className="text-center">{invoices.reduce((s, i) => s + i.sunBatteryLeads, 0)}</TableCell>
              <TableCell className="text-center text-primary">{invoices.reduce((s, i) => s + i.totalLeads, 0)}</TableCell>
              <TableCell className="text-right text-success">{totalSum.toLocaleString('sv-SE')} kr</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
