import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { format, addMonths, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Calendar, Clock, Play, Pause, AlertTriangle, TrendingUp, ArrowRight, Plus } from 'lucide-react';
import { AddTimelineEventDialog } from './AddTimelineEventDialog';

interface TimelineEvent {
  id: string;
  organization_id: string;
  organization_name: string;
  event_type: string;
  event_date: string;
  status: string | null;
  title: string;
  description: string | null;
  is_scheduled: boolean;
}

interface ForecastData {
  month: string;
  activePartners: number;
  projectedLeads: number;
}

export function PartnerTimelineSection() {
  const [upcomingEvents, setUpcomingEvents] = useState<TimelineEvent[]>([]);
  const [forecast, setForecast] = useState<ForecastData[]>([]);
  const [loading, setLoading] = useState(true);
  const [addEventOpen, setAddEventOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch upcoming scheduled events (next 90 days)
      const futureDate = addMonths(new Date(), 3);
      const { data: events } = await supabase
        .from('organization_timeline_events')
        .select(`
          id, organization_id, event_type, event_date, status, title, description, is_scheduled,
          organizations!organization_timeline_events_organization_id_fkey(name)
        `)
        .eq('is_scheduled', true)
        .gte('event_date', new Date().toISOString())
        .lte('event_date', futureDate.toISOString())
        .order('event_date', { ascending: true })
        .limit(20);

      if (events) {
        setUpcomingEvents(events.map(e => ({
          ...e,
          organization_name: (e.organizations as any)?.name || 'Okänd'
        })));
      }

      // Calculate forecast for next 3 months
      const { data: activeOrgs } = await supabase
        .from('organizations')
        .select('id')
        .eq('status', 'active');

      const activeCount = activeOrgs?.length || 0;
      
      // Get average leads per partner (rough estimate)
      const avgLeadsPerPartner = 15; // This could be calculated from historical data

      const forecastData: ForecastData[] = [];
      for (let i = 0; i < 3; i++) {
        const month = addMonths(new Date(), i);
        let adjustedCount = activeCount;

        // Adjust based on scheduled events
        events?.forEach(e => {
          const eventDate = new Date(e.event_date);
          if (eventDate <= endOfMonth(month) && eventDate >= startOfMonth(month)) {
            if (e.event_type === 'pause_scheduled') adjustedCount--;
            if (e.event_type === 'activation_scheduled') adjustedCount++;
          }
        });

        forecastData.push({
          month: format(month, 'MMMM yyyy', { locale: sv }),
          activePartners: Math.max(0, adjustedCount),
          projectedLeads: Math.max(0, adjustedCount) * avgLeadsPerPartner,
        });
      }
      setForecast(forecastData);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'pause_scheduled':
        return <Pause className="w-4 h-4 text-amber-500" />;
      case 'activation_scheduled':
        return <Play className="w-4 h-4 text-emerald-500" />;
      default:
        return <Calendar className="w-4 h-4 text-primary" />;
    }
  };

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case 'pause_scheduled':
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">Paus planerad</Badge>;
      case 'activation_scheduled':
        return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">Aktivering planerad</Badge>;
      case 'status_change':
        return <Badge variant="secondary">Statusändring</Badge>;
      default:
        return <Badge variant="outline">{eventType}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Forecast Section */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Prognos kommande månader
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {forecast.map((f, i) => (
            <Card key={f.month} className={i === 0 ? 'border-primary/30 bg-primary/5' : ''}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground capitalize">{f.month}</p>
                <div className="mt-2 space-y-1">
                  <p className="text-2xl font-bold">{f.activePartners}</p>
                  <p className="text-xs text-muted-foreground">aktiva partners</p>
                </div>
                <div className="mt-2 pt-2 border-t">
                  <p className="text-sm">
                    <span className="text-muted-foreground">~</span>
                    <span className="font-medium">{f.projectedLeads}</span>
                    <span className="text-muted-foreground"> leads</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Upcoming Events */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Kommande händelser
          </h4>
          <Button size="sm" variant="outline" onClick={() => setAddEventOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Lägg till händelse
          </Button>
        </div>

        {upcomingEvents.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Inga planerade händelser"
            description="Det finns inga schemalagda händelser för de kommande 90 dagarna"
          />
        ) : (
          <div className="space-y-2">
            {upcomingEvents.map((event) => {
              const daysUntil = differenceInDays(new Date(event.event_date), new Date());
              return (
                <Card key={event.id} className="hover:bg-muted/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">{getEventIcon(event.event_type)}</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{event.organization_name}</p>
                            {getEventBadge(event.event_type)}
                          </div>
                          <p className="text-sm text-muted-foreground">{event.title}</p>
                          {event.description && (
                            <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium">
                          {format(new Date(event.event_date), 'd MMM yyyy', { locale: sv })}
                        </p>
                        <p className={`text-xs ${daysUntil <= 7 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                          {daysUntil === 0 ? 'Idag' : daysUntil === 1 ? 'Imorgon' : `Om ${daysUntil} dagar`}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Capacity warnings */}
      {upcomingEvents.filter(e => e.event_type === 'pause_scheduled').length > 0 && (
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">Kapacitetsvarning</p>
                <p className="text-sm text-muted-foreground">
                  {upcomingEvents.filter(e => e.event_type === 'pause_scheduled').length} partner(s) har planerad paus. 
                  Detta kan påverka lead-leveransen.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <AddTimelineEventDialog
        open={addEventOpen}
        onOpenChange={setAddEventOpen}
        onCreated={fetchData}
      />
    </div>
  );
}
