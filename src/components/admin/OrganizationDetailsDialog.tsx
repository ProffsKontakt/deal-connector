import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InterestBadge } from '@/components/ui/interest-badge';
import { Users, TrendingUp, CreditCard, Calendar } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { sv } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

type InterestType = Database['public']['Enums']['interest_type'];

interface Organization {
  id: string;
  name: string;
  price_per_solar_deal: number | null;
  price_per_battery_deal: number | null;
}

interface OrganizationStats {
  totalLeads: number;
  solarLeads: number;
  batteryLeads: number;
  sunBatteryLeads: number;
  totalPayment: number;
  creditsThisMonth: number;
  creditsSinceLastMonth: number;
}

interface OrganizationDetailsDialogProps {
  organization: Organization | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const OrganizationDetailsDialog = ({ organization, open, onOpenChange }: OrganizationDetailsDialogProps) => {
  const [stats, setStats] = useState<OrganizationStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (organization && open) {
      fetchStats();
    }
  }, [organization, open]);

  const fetchStats = async () => {
    if (!organization) return;
    
    setLoading(true);
    try {
      const now = new Date();
      const thisMonthStart = startOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));

      // Fetch contact IDs linked to this organization
      const { data: contactOrgs } = await supabase
        .from('contact_organizations')
        .select('contact_id')
        .eq('organization_id', organization.id);

      const contactIds = contactOrgs?.map(co => co.contact_id) || [];

      // Fetch contacts with their interest types
      let solarLeads = 0;
      let batteryLeads = 0;
      let sunBatteryLeads = 0;

      if (contactIds.length > 0) {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('interest')
          .in('id', contactIds);

        contacts?.forEach(contact => {
          if (contact.interest === 'sun') solarLeads++;
          else if (contact.interest === 'battery') batteryLeads++;
          else if (contact.interest === 'sun_battery') sunBatteryLeads++;
        });
      }

      const totalLeads = solarLeads + batteryLeads + sunBatteryLeads;

      // Calculate payment
      const solarPrice = organization.price_per_solar_deal || 0;
      const batteryPrice = organization.price_per_battery_deal || 0;
      const totalPayment = 
        (solarLeads * solarPrice) + 
        (batteryLeads * batteryPrice) + 
        (sunBatteryLeads * (solarPrice + batteryPrice));

      // Fetch credit requests
      const { data: credits } = await supabase
        .from('credit_requests')
        .select('status, created_at')
        .eq('organization_id', organization.id)
        .eq('status', 'approved');

      const creditsThisMonth = credits?.filter(c => 
        new Date(c.created_at) >= thisMonthStart
      ).length || 0;

      const creditsSinceLastMonth = credits?.filter(c => 
        new Date(c.created_at) >= lastMonthStart
      ).length || 0;

      setStats({
        totalLeads,
        solarLeads,
        batteryLeads,
        sunBatteryLeads,
        totalPayment,
        creditsThisMonth,
        creditsSinceLastMonth,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!organization) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{organization.name}</DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-pulse text-muted-foreground">Laddar statistik...</div>
          </div>
        ) : stats ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Totalt antal leads
                  </CardTitle>
                  <Users className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalLeads}</div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      Sol: {stats.solarLeads}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Batteri: {stats.batteryLeads}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Sol+Batteri: {stats.sunBatteryLeads}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Att betala denna månad
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-400">
                    {stats.totalPayment.toLocaleString('sv-SE')} kr
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sol: {organization.price_per_solar_deal || 0} kr | Batteri: {organization.price_per_battery_deal || 0} kr
                  </p>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Krediter denna månad
                  </CardTitle>
                  <CreditCard className="h-4 w-4 text-amber-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-400">
                    {stats.creditsThisMonth}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Godkända krediteringar
                  </p>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Krediter sedan förra månaden
                  </CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.creditsSinceLastMonth}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sedan {format(subMonths(new Date(), 1), 'MMMM', { locale: sv })}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
