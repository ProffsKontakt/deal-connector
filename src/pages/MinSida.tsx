import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { OrganizationDetailsDialog } from '@/components/admin/OrganizationDetailsDialog';
import { TrendingUp, CreditCard, Calendar, Clock, Building2, User, Inbox, ChevronRight } from 'lucide-react';
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

      if (profile.role === 'admin') {
        const { data: orgs } = await supabase
          .from('organizations')
          .select('*')
          .order('name');
        setOrganizations(orgs || []);
      }

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

      let totalValue = 0;
      if (profile.role === 'opener') {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('interest')
          .eq('opener_id', profile.id);

        if (contacts) {
          totalValue = contacts.length * 1000;
        }
      }

      let creditQuery = supabase
        .from('credit_requests')
        .select('id, status, created_at, contact:contacts(email)');

      if (profile.role === 'organization' && profile.organization_id) {
        creditQuery = creditQuery.eq('organization_id', profile.organization_id);
      } else if (profile.role === 'opener') {
        creditQuery = creditQuery.eq('requested_by', profile.id);
      }

      const { data: credits } = await creditQuery.order('created_at', { ascending: false });

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
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground text-sm">Laddar dashboard...</span>
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
            <User className="w-6 h-6 text-primary" />
          </div>
          <h1 className="page-title">Min Sida</h1>
        </div>
        <p className="page-description">
          Välkommen tillbaka, <span className="text-foreground font-medium">{profile?.full_name || profile?.email}</span>
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Totalt värde"
          value={`${stats.totalValue.toLocaleString('sv-SE')} kr`}
          subtitle="Baserat på dina deals"
          icon={TrendingUp}
          iconColor="text-primary"
        />
        <StatCard
          title="Krediter denna månad"
          value={stats.creditsThisMonth}
          subtitle="Godkända krediteringar"
          icon={CreditCard}
          iconColor="text-success"
          valueColor="text-success"
        />
        <StatCard
          title="Krediter förra månaden"
          value={stats.creditsLastMonth}
          subtitle={format(subMonths(new Date(), 1), 'MMMM yyyy', { locale: sv })}
          icon={Calendar}
          iconColor="text-muted-foreground"
        />
        <StatCard
          title="Väntande"
          value={stats.pendingCredits}
          subtitle="Kreditförfrågningar"
          icon={Clock}
          iconColor="text-warning"
          valueColor="text-warning"
        />
      </div>

      {/* Admin: Organizations overview */}
      {profile?.role === 'admin' && organizations.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle>Organisationer</CardTitle>
            </div>
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
                  className="group p-4 rounded-xl bg-muted/30 hover:bg-muted/50 border border-transparent hover:border-primary/20 transition-all duration-200 text-left"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold group-hover:text-primary transition-colors">{org.name}</p>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1.5">
                    Sol: {org.price_per_solar_deal?.toLocaleString('sv-SE') || 0} kr · Batteri: {org.price_per_battery_deal?.toLocaleString('sv-SE') || 0} kr
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Credits */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Senaste kreditförfrågningar</CardTitle>
          <CardDescription>
            Dina senaste kreditförfrågningar och deras status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentCredits.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Inga kreditförfrågningar"
              description="Du har inte skickat några kreditförfrågningar ännu"
            />
          ) : (
            <div className="space-y-3">
              {recentCredits.map((credit) => (
                <div
                  key={credit.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{credit.contact?.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(credit.created_at), 'dd MMM yyyy, HH:mm', { locale: sv })}
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