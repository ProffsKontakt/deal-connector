import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { OrganizationDetailsDialog } from '@/components/admin/OrganizationDetailsDialog';
import { TrendingUp, CreditCard, Calendar, User, Building2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { sv } from 'date-fns/locale';

interface Organization {
  id: string;
  name: string;
  price_per_solar_deal: number | null;
  price_per_battery_deal: number | null;
}

interface DashboardStats {
  totalValue: number;
  creditsThisMonth: number;
  creditsLastMonth: number;
  pendingCredits: number;
}

interface RecentCredit {
  id: string;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  contact: { email: string };
}

const MinSida = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalValue: 0,
    creditsThisMonth: 0,
    creditsLastMonth: 0,
    pendingCredits: 0,
  });
  const [recentCredits, setRecentCredits] = useState<RecentCredit[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchDashboardData();
    }
  }, [profile]);

  const fetchDashboardData = async () => {
    if (!profile) return;

    try {
      const now = new Date();
      const thisMonthStart = startOfMonth(now);
      const thisMonthEnd = endOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));

      // Admin: fetch all organizations
      if (profile.role === 'admin') {
        const { data: orgs } = await supabase
          .from('organizations')
          .select('*')
          .order('name');
        setOrganizations(orgs || []);
      }

      // Fetch organization prices if user is organization
      let orgPrices = { price_per_solar_deal: 0, price_per_battery_deal: 0 };
      if (profile.role === 'organization' && profile.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('price_per_solar_deal, price_per_battery_deal')
          .eq('id', profile.organization_id)
          .maybeSingle();
        if (org) {
          orgPrices = {
            price_per_solar_deal: org.price_per_solar_deal || 0,
            price_per_battery_deal: org.price_per_battery_deal || 0,
          };
        }
      }

      // Fetch contacts for value calculation (for openers)
      let totalValue = 0;
      if (profile.role === 'opener') {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('interest')
          .eq('opener_id', profile.id);

        if (contacts) {
          // Simple calculation - would need org prices in real scenario
          totalValue = contacts.length * 1000; // Placeholder value
        }
      }

      // Fetch credit requests
      let creditQuery = supabase
        .from('credit_requests')
        .select('id, status, created_at, contact:contacts(email)');

      if (profile.role === 'organization' && profile.organization_id) {
        creditQuery = creditQuery.eq('organization_id', profile.organization_id);
      } else if (profile.role === 'opener') {
        creditQuery = creditQuery.eq('requested_by', profile.id);
      }

      const { data: credits } = await creditQuery.order('created_at', { ascending: false });

      // Calculate stats
      const creditsThisMonth = credits?.filter(c => {
        const date = new Date(c.created_at);
        return date >= thisMonthStart && date <= thisMonthEnd && c.status === 'approved';
      }).length || 0;

      const creditsLastMonth = credits?.filter(c => {
        const date = new Date(c.created_at);
        return date >= lastMonthStart && date <= lastMonthEnd && c.status === 'approved';
      }).length || 0;

      const pendingCredits = credits?.filter(c => c.status === 'pending').length || 0;

      setStats({
        totalValue,
        creditsThisMonth,
        creditsLastMonth,
        pendingCredits,
      });

      setRecentCredits((credits || []).slice(0, 5) as RecentCredit[]);
    } finally {
      setLoading(false);
    }
  };

  const handleOrgClick = (org: Organization) => {
    setSelectedOrg(org);
    setOrgDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Laddar dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Min Sida</h1>
        <p className="text-muted-foreground mt-1">
          Välkommen tillbaka, {profile?.full_name || profile?.email}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Totalt värde
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalValue.toLocaleString('sv-SE')} kr
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Baserat på dina deals
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Krediter denna månad
            </CardTitle>
            <CreditCard className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">
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
              Krediter förra månaden
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.creditsLastMonth}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {format(subMonths(new Date(), 1), 'MMMM yyyy', { locale: sv })}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Väntande
            </CardTitle>
            <User className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">
              {stats.pendingCredits}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Kreditförfrågningar
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Admin: Organizations overview */}
      {profile?.role === 'admin' && organizations.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organisationer
            </CardTitle>
            <CardDescription>
              Klicka på en organisation för att se detaljerad statistik
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleOrgClick(org)}
                  className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                >
                  <p className="font-medium">{org.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sol: {org.price_per_solar_deal || 0} kr | Batteri: {org.price_per_battery_deal || 0} kr
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Senaste kreditförfrågningar</CardTitle>
          <CardDescription>
            Dina senaste kreditförfrågningar och deras status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentCredits.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Inga kreditförfrågningar ännu
            </p>
          ) : (
            <div className="space-y-4">
              {recentCredits.map((credit) => (
                <div
                  key={credit.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30"
                >
                  <div>
                    <p className="font-medium">{credit.contact?.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(credit.created_at), 'dd MMM yyyy HH:mm', { locale: sv })}
                    </p>
                  </div>
                  <StatusBadge status={credit.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <OrganizationDetailsDialog
        organization={selectedOrg}
        open={orgDialogOpen}
        onOpenChange={setOrgDialogOpen}
      />
    </div>
  );
};

export default MinSida;