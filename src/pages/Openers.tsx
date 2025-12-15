import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Users, TrendingUp, Sun, Battery, Calculator } from 'lucide-react';

interface OpenerStats {
  id: string;
  email: string;
  full_name: string | null;
  totalDeals: number;
  solarDeals: number;
  batteryDeals: number;
  sunBatteryDeals: number;
}

const Openers = () => {
  const { profile } = useAuth();
  const [openers, setOpeners] = useState<OpenerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'prestanda' | 'siffror'>('prestanda');

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchOpenerStats();
    }
  }, [profile]);

  const fetchOpenerStats = async () => {
    try {
      const { data: openerProfiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('role', 'opener');

      if (!openerProfiles) {
        setOpeners([]);
        return;
      }

      const { data: contacts } = await supabase
        .from('contacts')
        .select('opener_id, interest');

      const openerStats: OpenerStats[] = openerProfiles.map((opener) => {
        const openerContacts = contacts?.filter(c => c.opener_id === opener.id) || [];
        return {
          id: opener.id,
          email: opener.email,
          full_name: opener.full_name,
          totalDeals: openerContacts.length,
          solarDeals: openerContacts.filter(c => c.interest === 'sun').length,
          batteryDeals: openerContacts.filter(c => c.interest === 'battery').length,
          sunBatteryDeals: openerContacts.filter(c => c.interest === 'sun_battery').length,
        };
      });

      openerStats.sort((a, b) => b.totalDeals - a.totalDeals);
      setOpeners(openerStats);
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
          <span className="text-muted-foreground text-sm">Laddar openers...</span>
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
            <Users className="w-6 h-6 text-primary" />
          </div>
          <h1 className="page-title">Openers</h1>
        </div>
        <p className="page-description">
          Översikt av prestanda för alla openers
        </p>
      </div>

      {/* Tab Buttons */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'prestanda' ? 'default' : 'outline'}
          onClick={() => setActiveTab('prestanda')}
          className="gap-2"
        >
          <TrendingUp className="w-4 h-4" />
          Prestanda
        </Button>
        <Button
          variant={activeTab === 'siffror' ? 'default' : 'outline'}
          onClick={() => setActiveTab('siffror')}
          className="gap-2"
        >
          <Calculator className="w-4 h-4" />
          Siffror
        </Button>
      </div>

      {/* Prestanda Tab */}
      {activeTab === 'prestanda' && (
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle>Opener-statistik</CardTitle>
            </div>
            <CardDescription>
              Antal leads genererade per opener
            </CardDescription>
          </CardHeader>
          <CardContent>
            {openers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Inga openers"
                description="Det finns inga openers registrerade ännu"
              />
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold">Opener</TableHead>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openers.map((opener) => (
                      <TableRow key={opener.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div>
                            <p className="font-medium">{opener.full_name || opener.email}</p>
                            {opener.full_name && (
                              <p className="text-sm text-muted-foreground">{opener.email}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold text-primary">{opener.totalDeals}</span>
                        </TableCell>
                        <TableCell className="text-center">{opener.solarDeals}</TableCell>
                        <TableCell className="text-center">{opener.batteryDeals}</TableCell>
                        <TableCell className="text-center">{opener.sunBatteryDeals}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Siffror Tab */}
      {activeTab === 'siffror' && (
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              <CardTitle>Provisioner</CardTitle>
            </div>
            <CardDescription>
              Provisioner för säljare och openers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {openers.length === 0 ? (
              <EmptyState
                icon={Calculator}
                title="Inga provisioner"
                description="Det finns inga provisioner att visa ännu"
              />
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold">Namn</TableHead>
                      <TableHead className="text-center font-semibold">Antal deals</TableHead>
                      <TableHead className="text-center font-semibold">Provision</TableHead>
                      <TableHead className="text-center font-semibold">Totalt (kr)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openers.map((opener) => (
                      <TableRow key={opener.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div>
                            <p className="font-medium">{opener.full_name || opener.email}</p>
                            {opener.full_name && (
                              <p className="text-sm text-muted-foreground">{opener.email}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold">{opener.totalDeals}</span>
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          —
                        </TableCell>
                        <TableCell className="text-center font-semibold text-primary">
                          —
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Openers;