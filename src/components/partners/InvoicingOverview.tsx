import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { ResizableTableHead } from '@/components/ui/resizable-table';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { sv } from 'date-fns/locale';
import { FileText, Copy, Download, Sun, Battery, ExternalLink, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

interface DetailedLead {
  id: string;
  address: string | null;
  contactPerson: string | null;
  email: string;
  phone: string | null;
  interest: string;
  organizationId: string;
  organizationName: string;
  pricePerLead: number;
  status: string;
}

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
  const [detailedLeads, setDetailedLeads] = useState<DetailedLead[]>([]);
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
        setDetailedLeads([]);
        return;
      }

      // Fetch detailed contacts in billing period
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, email, name, address, phone, interest, date_sent')
        .gte('date_sent', format(leadsStart, 'yyyy-MM-dd'))
        .lte('date_sent', format(leadsEnd, 'yyyy-MM-dd'));

      // Fetch contact-org links
      const { data: contactOrgs } = await supabase
        .from('contact_organizations')
        .select('organization_id, contact_id');

      // Fetch approved credits to exclude
      const { data: creditRequests } = await supabase
        .from('credit_requests')
        .select('contact_id, organization_id, status');

      const contactMap = new Map(contacts?.map(c => [c.id, c]) || []);
      const contactIdsInPeriod = new Set(contacts?.map(c => c.id) || []);
      const approvedCredits = new Set(
        creditRequests?.filter(cr => cr.status === 'approved').map(cr => `${cr.contact_id}-${cr.organization_id}`) || []
      );
      const creditedContacts = new Map(
        creditRequests?.map(cr => [`${cr.contact_id}-${cr.organization_id}`, cr.status]) || []
      );

      const orgMap = new Map(organizations.map(o => [o.id, o]));
      const allDetailedLeads: DetailedLead[] = [];

      const partnerInvoices: PartnerInvoice[] = organizations.map((org) => {
        const orgContactLinks = contactOrgs?.filter(co => 
          co.organization_id === org.id && contactIdsInPeriod.has(co.contact_id)
        ) || [];
        
        let solarLeads = 0;
        let batteryLeads = 0;
        let sunBatteryLeads = 0;

        orgContactLinks.forEach(link => {
          const contact = contactMap.get(link.contact_id);
          if (!contact) return;

          // Check credit status
          const creditKey = `${link.contact_id}-${org.id}`;
          const creditStatus = creditedContacts.get(creditKey);
          const isCredited = creditStatus === 'approved';

          // Calculate price based on interest
          let pricePerLead = 0;
          if (contact.interest === 'sun') {
            pricePerLead = org.price_per_solar_deal || 0;
            if (!isCredited) solarLeads++;
          } else if (contact.interest === 'battery') {
            pricePerLead = org.price_per_battery_deal || 0;
            if (!isCredited) batteryLeads++;
          } else if (contact.interest === 'sun_battery') {
            pricePerLead = (org.price_per_solar_deal || 0) + (org.price_per_battery_deal || 0);
            if (!isCredited) sunBatteryLeads++;
          }

          // Add to detailed leads for export
          allDetailedLeads.push({
            id: contact.id,
            address: contact.address,
            contactPerson: contact.name,
            email: contact.email,
            phone: contact.phone,
            interest: contact.interest,
            organizationId: org.id,
            organizationName: org.name,
            pricePerLead: isCredited ? 0 : pricePerLead,
            status: isCredited ? 'Krediterad' : 'Offert',
          });
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
      setDetailedLeads(allDetailedLeads);
    } finally {
      setLoading(false);
    }
  };

  const billingDate = new Date(selectedMonth + '-01');
  const leadsMonthLabel = format(subMonths(billingDate, 1), 'MMMM yyyy', { locale: sv });
  const totalSum = invoices.reduce((sum, i) => sum + i.totalValue, 0);
  const totalLeadsCount = invoices.reduce((sum, i) => sum + i.totalLeads, 0);
  const creditedLeadsCount = detailedLeads.filter(l => l.status === 'Krediterad').length;

  const getInterestLabel = (interest: string) => {
    switch (interest) {
      case 'sun': return 'Solceller';
      case 'battery': return 'Batteri';
      case 'sun_battery': return 'Solceller & Batteri';
      default: return interest;
    }
  };

  const getLeadType = (interest: string) => {
    // All leads are "Offert" type in this context
    return 'Offert';
  };

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

  const handleExportExcel = () => {
    // Create workbook
    const wb = XLSX.utils.book_new();

    // Create data for the excel sheet - matching the screenshot format
    // Headers: Adress, Kontaktperson, Kund, Leadtyp, Lead Intresse, Telefonnummer, Status, Taxa
    const excelData = detailedLeads.map(lead => ({
      'Adress': lead.address || '',
      'Kontaktperson': lead.contactPerson || lead.email,
      'Kund': lead.organizationName,
      'Leadtyp': getLeadType(lead.interest),
      'Lead Intresse': getInterestLabel(lead.interest),
      'Telefonnummer': lead.phone || '',
      'Status': lead.status,
      'Taxa': lead.pricePerLead > 0 ? `${lead.pricePerLead} kr` : '',
    }));

    // Add summary rows
    const summaryStartRow = excelData.length + 2;

    // Create worksheet from data
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Add summary section to the right side (column J onwards)
    // Add summary headers and data
    const summaryData = [
      { label: 'Summa', value: '' },
      { label: 'Totalt levererade leads', value: totalLeadsCount },
      { label: '', value: '' },
      { label: 'Brutto', value: `${totalSum.toLocaleString('sv-SE')} kr` },
      { label: 'Krediterade', value: `${(creditedLeadsCount * (invoices[0]?.pricePerSolar || 500)).toLocaleString('sv-SE')} kr` },
      { label: '', value: '' },
      { label: 'Faktureras – ex moms', value: `${Math.round(totalSum * 0.8).toLocaleString('sv-SE')} kr` },
      { label: 'Faktureras – ink moms', value: `${totalSum.toLocaleString('sv-SE')} kr` },
      { label: '', value: '' },
      { label: 'Moms (25%)', value: `${Math.round(totalSum * 0.2).toLocaleString('sv-SE')} kr` },
    ];

    // Add summary to worksheet starting at column J (index 9)
    summaryData.forEach((item, index) => {
      const cellLabel = XLSX.utils.encode_cell({ r: index, c: 9 }); // Column J
      const cellValue = XLSX.utils.encode_cell({ r: index, c: 10 }); // Column K
      ws[cellLabel] = { t: 's', v: item.label };
      ws[cellValue] = { t: 's', v: item.value.toString() };
    });

    // Update the range to include summary columns
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    range.e.c = Math.max(range.e.c, 10); // Extend to column K
    range.e.r = Math.max(range.e.r, summaryData.length - 1);
    ws['!ref'] = XLSX.utils.encode_range(range);

    // Set column widths for better readability
    ws['!cols'] = [
      { wch: 35 }, // Adress
      { wch: 25 }, // Kontaktperson
      { wch: 20 }, // Kund
      { wch: 10 }, // Leadtyp
      { wch: 18 }, // Lead Intresse
      { wch: 15 }, // Telefonnummer
      { wch: 12 }, // Status
      { wch: 10 }, // Taxa
      { wch: 5 },  // Spacer
      { wch: 25 }, // Summary label
      { wch: 15 }, // Summary value
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Faktureringsunderlag');

    // Generate file name
    const fileName = `faktureringsunderlag_${format(subMonths(billingDate, 1), 'yyyy-MM')}.xlsx`;

    // Write and download
    XLSX.writeFile(wb, fileName);
    toast.success('Excel-fil exporterad');
  };

  const handleExportPartnerExcel = (partnerId: string, partnerName: string) => {
    const partnerLeads = detailedLeads.filter(l => l.organizationId === partnerId);
    const partnerInvoice = invoices.find(i => i.id === partnerId);
    
    if (partnerLeads.length === 0) {
      toast.error('Inga leads att exportera för denna partner');
      return;
    }

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Create data for the excel sheet
    const excelData = partnerLeads.map(lead => ({
      'Adress': lead.address || '',
      'Kontaktperson': lead.contactPerson || lead.email,
      'Kund': lead.organizationName,
      'Leadtyp': getLeadType(lead.interest),
      'Lead Intresse': getInterestLabel(lead.interest),
      'Telefonnummer': lead.phone || '',
      'Status': lead.status,
      'Taxa': lead.pricePerLead > 0 ? `${lead.pricePerLead} kr` : '',
    }));

    // Create worksheet from data
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Calculate partner totals
    const partnerTotal = partnerLeads.filter(l => l.status !== 'Krediterad').reduce((sum, l) => sum + l.pricePerLead, 0);
    const partnerCredited = partnerLeads.filter(l => l.status === 'Krediterad').length;

    // Add summary section
    const summaryData = [
      { label: 'Summa', value: '' },
      { label: 'Totalt levererade leads', value: partnerInvoice?.totalLeads || 0 },
      { label: '', value: '' },
      { label: 'Brutto', value: `${partnerTotal.toLocaleString('sv-SE')} kr` },
      { label: 'Krediterade', value: partnerCredited },
      { label: '', value: '' },
      { label: 'Faktureras – ex moms', value: `${Math.round(partnerTotal * 0.8).toLocaleString('sv-SE')} kr` },
      { label: 'Faktureras – ink moms', value: `${partnerTotal.toLocaleString('sv-SE')} kr` },
      { label: '', value: '' },
      { label: 'Moms (25%)', value: `${Math.round(partnerTotal * 0.2).toLocaleString('sv-SE')} kr` },
    ];

    // Add summary to worksheet
    summaryData.forEach((item, index) => {
      const cellLabel = XLSX.utils.encode_cell({ r: index, c: 9 });
      const cellValue = XLSX.utils.encode_cell({ r: index, c: 10 });
      ws[cellLabel] = { t: 's', v: item.label };
      ws[cellValue] = { t: 's', v: item.value.toString() };
    });

    // Update range
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    range.e.c = Math.max(range.e.c, 10);
    range.e.r = Math.max(range.e.r, summaryData.length - 1);
    ws['!ref'] = XLSX.utils.encode_range(range);

    // Set column widths
    ws['!cols'] = [
      { wch: 35 }, { wch: 25 }, { wch: 20 }, { wch: 10 }, 
      { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 10 },
      { wch: 5 }, { wch: 25 }, { wch: 15 },
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, partnerName.substring(0, 31)); // Sheet names max 31 chars

    // Generate file name
    const fileName = `faktureringsunderlag_${partnerName.replace(/[^a-zA-Z0-9]/g, '_')}_${format(subMonths(billingDate, 1), 'yyyy-MM')}.xlsx`;

    // Write and download
    XLSX.writeFile(wb, fileName);
    toast.success(`Excel-fil för ${partnerName} exporterad`);
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
          <Button variant="default" size="sm" onClick={handleExportExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-1" />
            Exportera Excel
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
              <ResizableTableHead className="w-24 font-semibold">Export</ResizableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow 
                key={invoice.id} 
                className="hover:bg-muted/30 group"
              >
                <TableCell>
                  <button
                    className="flex items-center gap-1 hover:underline text-left"
                    onClick={() => onPartnerClick?.(invoice.id, invoice.name)}
                  >
                    <span className="font-medium">{invoice.name}</span>
                    <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </TableCell>
                <TableCell className="text-center">{invoice.solarLeads}</TableCell>
                <TableCell className="text-center">{invoice.batteryLeads}</TableCell>
                <TableCell className="text-center">{invoice.sunBatteryLeads}</TableCell>
                <TableCell className="text-center font-semibold text-primary">{invoice.totalLeads}</TableCell>
                <TableCell className="text-right font-semibold text-success">
                  {invoice.totalValue.toLocaleString('sv-SE')} kr
                </TableCell>
                <TableCell>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleExportPartnerExcel(invoice.id, invoice.name)}
                    title="Exportera Excel för denna partner"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
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
              <TableCell></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}