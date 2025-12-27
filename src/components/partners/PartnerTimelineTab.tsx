import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { 
  Calendar, 
  Plus, 
  Play, 
  Pause, 
  FileText, 
  DollarSign, 
  MapPin, 
  Clock,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { AddTimelineEventDialog } from './AddTimelineEventDialog';
import { toast } from 'sonner';

interface TimelineEvent {
  id: string;
  event_type: string;
  event_date: string;
  status: string | null;
  title: string;
  description: string | null;
  is_scheduled: boolean;
  created_at: string;
}

interface PartnerTimelineTabProps {
  partnerId: string;
  collaborationStartDate: string | null;
}

export function PartnerTimelineTab({ partnerId, collaborationStartDate }: PartnerTimelineTabProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [addEventOpen, setAddEventOpen] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, [partnerId]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('organization_timeline_events')
        .select('*')
        .eq('organization_id', partnerId)
        .order('event_date', { ascending: false });

      if (data) setEvents(data);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    const { error } = await supabase
      .from('organization_timeline_events')
      .delete()
      .eq('id', eventId);

    if (error) {
      toast.error('Kunde inte ta bort händelse');
      return;
    }
    toast.success('Händelse borttagen');
    fetchEvents();
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'collaboration_started':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'pause_scheduled':
        return <Pause className="w-4 h-4 text-amber-500" />;
      case 'activation_scheduled':
        return <Play className="w-4 h-4 text-emerald-500" />;
      case 'status_change':
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case 'note':
        return <FileText className="w-4 h-4 text-muted-foreground" />;
      case 'pricing_update':
        return <DollarSign className="w-4 h-4 text-primary" />;
      case 'coverage_change':
        return <MapPin className="w-4 h-4 text-primary" />;
      case 'contract_signed':
        return <FileText className="w-4 h-4 text-emerald-500" />;
      default:
        return <Calendar className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getEventLabel = (eventType: string) => {
    switch (eventType) {
      case 'collaboration_started': return 'Samarbete inlett';
      case 'status_change': return 'Statusändring';
      case 'pause_scheduled': return 'Paus planerad';
      case 'activation_scheduled': return 'Aktivering planerad';
      case 'note': return 'Anteckning';
      case 'contract_signed': return 'Avtal signerat';
      case 'pricing_update': return 'Prisändring';
      case 'coverage_change': return 'Täckningsändring';
      default: return eventType;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pastEvents = events.filter(e => !e.is_scheduled);
  const scheduledEvents = events.filter(e => e.is_scheduled);

  return (
    <div className="space-y-6">
      {/* Header with add button */}
      <div className="flex items-center justify-between">
        <div>
          {collaborationStartDate && (
            <p className="text-sm text-muted-foreground">
              Samarbete inlett: {format(new Date(collaborationStartDate), 'd MMMM yyyy', { locale: sv })}
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => setAddEventOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Lägg till händelse
        </Button>
      </div>

      {/* Scheduled Events */}
      {scheduledEvents.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Planerade händelser
          </h4>
          <div className="space-y-2">
            {scheduledEvents.map((event) => (
              <Card key={event.id} className="bg-amber-500/5 border-amber-500/20">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{getEventIcon(event.event_type)}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{event.title}</p>
                          <Badge variant="outline" className="text-xs">
                            {getEventLabel(event.event_type)}
                          </Badge>
                        </div>
                        {event.description && (
                          <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(event.event_date), 'd MMM yyyy', { locale: sv })}
                      </p>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteEvent(event.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Past Events Timeline */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Historik
        </h4>
        
        {pastEvents.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Ingen historik"
            description="Det finns inga registrerade händelser för denna partner"
          />
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[18px] top-2 bottom-2 w-0.5 bg-border" />
            
            <div className="space-y-4">
              {pastEvents.map((event, index) => (
                <div key={event.id} className="relative flex gap-4">
                  {/* Timeline dot */}
                  <div className="relative z-10 flex items-center justify-center w-9 h-9 rounded-full bg-background border-2 border-border shrink-0">
                    {getEventIcon(event.event_type)}
                  </div>
                  
                  {/* Event content */}
                  <Card className="flex-1 hover:bg-muted/30 transition-colors group">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{event.title}</p>
                            <Badge variant="secondary" className="text-xs">
                              {getEventLabel(event.event_type)}
                            </Badge>
                            {event.status && (
                              <Badge variant={event.status === 'active' ? 'default' : 'secondary'}>
                                {event.status === 'active' ? 'Aktiv' : 'Pausad'}
                              </Badge>
                            )}
                          </div>
                          {event.description && (
                            <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(event.event_date), 'd MMM yyyy', { locale: sv })}
                          </p>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                            onClick={() => handleDeleteEvent(event.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AddTimelineEventDialog
        open={addEventOpen}
        onOpenChange={setAddEventOpen}
        onCreated={fetchEvents}
        organizationId={partnerId}
      />
    </div>
  );
}
