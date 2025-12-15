import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { Building2, TrendingUp, Sun, Battery } from 'lucide-react';

interface PartnerStats {
  id: string;
  name: string;
  totalLeads: number;
  solarLeads: number;
  batteryLeads: number;
  sunBatteryLeads: number;
  totalValue: number;
}

const Partners = () => {
  const { profile } = useAuth();
  const [partners, setPartners] = useState<PartnerStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchPartnerStats();
    }
  }, [profile]);

  const fetchPartnerStats = async () => {
    try {
      // Fetch all organizations
      const { data: organizations } = await supabase
        .from('organizations')
        .select('id, name, price_per_solar_deal, price_per_battery_deal');

      if (!organizations) {
        setPartners([]);
        return;
      }

      // Fetch contact-organization relationships with contact interest
      const { data: contactOrgs } = await supabase
        .from('contact_organizations')
        .select('organization_id, contact:contacts(interest)');

      const partnerStats: PartnerStats[] = organizations.map((org) => {
        const orgContacts = contactOrgs?.filter(co => co.organization_id === org.id) || [];
        
        const solarLeads = orgContacts.filter(co => co.contact?.interest === 'sun').length;
        const batteryLeads = orgContacts.filter(co => co.contact?.interest === 'battery').length;
        const sunBatteryLeads = orgContacts.filter(co => co.contact?.interest === 'sun_battery').length;
        
        // Calculate total value
        const solarPrice = org.price_per_solar_deal || 0;
        const batteryPrice = org.price_per_battery_deal || 0;
        const totalValue = (solarLeads * solarPrice) + (batteryLeads * batteryPrice) + (sunBatteryLeads * (solarPrice + batteryPrice));

        return {
          id: org.id,
          name: org.name,
          totalLeads: orgContacts.length,
          solarLeads,
          batteryLeads,
          sunBatteryLeads,
          totalValue,
        };
      });

      // Sort by total leads descending
      partnerStats.sort((a, b) => b.totalLeads - a.totalLeads);
      setPartners(partnerStats);
    } finally {
      setLoading(false);
    }
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
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Partner-statistik</CardTitle>
          </div>
          <CardDescription>
            Totalt antal leads per partner och beräknat värde
          </CardDescription>
        </CardHeader>
        <CardContent>
          {partners.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Inga partners"
              description="Det finns inga partners registrerade ännu"
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
                    <TableHead className="text-right font-semibold">Värde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map((partner) => (
                    <TableRow key={partner.id} className="hover:bg-muted/30">
                      <TableCell>
                        <p className="font-medium">{partner.name}</p>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Partners;