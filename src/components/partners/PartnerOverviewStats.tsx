import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, Target, BarChart3, Percent } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { sv } from 'date-fns/locale';

interface RegionStats {
  regionId: string;
  regionName: string;
  partnerCount: number;
  leadCount: number;
  avgLeadsPerPartner: number;
}

interface PartnerOverviewStatsProps {
  selectedMonth: string;
}

export function PartnerOverviewStats({ selectedMonth }: PartnerOverviewStatsProps) {
  const [stats, setStats] = useState({
    totalLeads: 0,
    totalPartners: 0,
    avgLeadsPerPartner: 0,
    avgPartnersPerLead: 0,
    avgCloseRate: 0,
    regionStats: [] as RegionStats[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [selectedMonth]);

  const fetchStats = async () => {
    try {
      const selectedDate = new Date(selectedMonth + '-01');
      const leadsStart = startOfMonth(selectedDate);
      const leadsEnd = endOfMonth(selectedDate);

      // Fetch active organizations
      const { data: organizations } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('status', 'active');

      // Fetch contacts in period
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, region_id')
        .gte('date_sent', format(leadsStart, 'yyyy-MM-dd'))
        .lte('date_sent', format(leadsEnd, 'yyyy-MM-dd'));

      // Fetch regions
      const { data: regions } = await supabase
        .from('regions')
        .select('id, name');

      // Fetch contact-org links
      const { data: contactOrgs } = await supabase
        .from('contact_organizations')
        .select('organization_id, contact_id');

      // Fetch sales for close rate
      const { data: sales } = await supabase
        .from('sales')
        .select('organization_id, pipeline_status');

      const totalPartners = organizations?.length || 0;
      const totalLeads = contacts?.length || 0;
      const contactIds = new Set(contacts?.map(c => c.id) || []);
      
      // Count org links for leads in period
      const linksInPeriod = contactOrgs?.filter(co => contactIds.has(co.contact_id)) || [];
      const avgPartnersPerLead = totalLeads > 0 ? linksInPeriod.length / totalLeads : 0;
      
      // Count leads per org
      const orgLeadCounts = new Map<string, number>();
      linksInPeriod.forEach(link => {
        orgLeadCounts.set(link.organization_id, (orgLeadCounts.get(link.organization_id) || 0) + 1);
      });
      const orgsWithLeads = Array.from(orgLeadCounts.values());
      const avgLeadsPerPartner = orgsWithLeads.length > 0 
        ? orgsWithLeads.reduce((a, b) => a + b, 0) / orgsWithLeads.length 
        : 0;

      // Calculate close rate
      const totalDeals = sales?.length || 0;
      const wonDeals = sales?.filter(s => s.pipeline_status === 'won').length || 0;
      const avgCloseRate = totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0;

      // Region stats - simplified (just count per region)
      const regionMap = new Map(regions?.map(r => [r.id, r.name]) || []);
      const regionLeadCounts = new Map<string, number>();
      const regionPartnerCounts = new Map<string, Set<string>>();
      
      contacts?.forEach(c => {
        if (c.region_id) {
          regionLeadCounts.set(c.region_id, (regionLeadCounts.get(c.region_id) || 0) + 1);
        }
      });

      const regionStats: RegionStats[] = Array.from(regionLeadCounts.entries()).map(([regionId, leadCount]) => ({
        regionId,
        regionName: regionMap.get(regionId) || 'Okänd',
        partnerCount: 0, // Would need org_regions data
        leadCount,
        avgLeadsPerPartner: 0,
      }));

      setStats({
        totalLeads,
        totalPartners,
        avgLeadsPerPartner,
        avgPartnersPerLead,
        avgCloseRate,
        regionStats,
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedDate = new Date(selectedMonth + '-01');
  const leadsMonthLabel = format(selectedDate, 'MMMM yyyy', { locale: sv });

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4 h-24 bg-muted/30" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Statistik för {leadsMonthLabel}</p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Totala leads</span>
            </div>
            <p className="text-2xl font-bold text-primary">{stats.totalLeads}</p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Aktiva partners</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{stats.totalPartners}</p>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Partners/lead</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{stats.avgPartnersPerLead.toFixed(1)}</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Leads/partner</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.avgLeadsPerPartner.toFixed(1)}</p>
          </CardContent>
        </Card>

        <Card className="bg-violet-500/5 border-violet-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="w-4 h-4 text-violet-500" />
              <span className="text-xs text-muted-foreground">Snitt close rate</span>
            </div>
            <p className="text-2xl font-bold text-violet-600">{stats.avgCloseRate.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
