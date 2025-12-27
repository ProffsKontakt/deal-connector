import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Calendar, Clock } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
}

interface AddTimelineEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  organizationId?: string;
}

const EVENT_TYPES = [
  { value: 'note', label: 'Anteckning' },
  { value: 'status_change', label: 'Statusändring' },
  { value: 'pause_scheduled', label: 'Planerad paus' },
  { value: 'activation_scheduled', label: 'Planerad aktivering' },
  { value: 'contract_signed', label: 'Avtal signerat' },
  { value: 'pricing_update', label: 'Prisändring' },
  { value: 'coverage_change', label: 'Täckningsändring' },
];

export function AddTimelineEventDialog({
  open,
  onOpenChange,
  onCreated,
  organizationId,
}: AddTimelineEventDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  
  const [selectedOrg, setSelectedOrg] = useState(organizationId || '');
  const [eventType, setEventType] = useState('note');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    if (open && !organizationId) {
      fetchOrganizations();
    }
    if (organizationId) {
      setSelectedOrg(organizationId);
    }
  }, [open, organizationId]);

  useEffect(() => {
    // Auto-set isScheduled for scheduled event types
    if (eventType === 'pause_scheduled' || eventType === 'activation_scheduled') {
      setIsScheduled(true);
    }
  }, [eventType]);

  const fetchOrganizations = async () => {
    const { data } = await supabase
      .from('organizations')
      .select('id, name')
      .order('name');
    if (data) setOrganizations(data);
  };

  const handleSubmit = async () => {
    if (!selectedOrg || !title || !eventDate) {
      toast.error('Fyll i alla obligatoriska fält');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('organization_timeline_events')
        .insert({
          organization_id: selectedOrg,
          event_type: eventType,
          event_date: new Date(eventDate).toISOString(),
          title,
          description: description || null,
          is_scheduled: isScheduled,
          status: eventType === 'status_change' ? status : null,
          created_by: user?.id,
        });

      if (error) throw error;

      toast.success('Händelse tillagd');
      onOpenChange(false);
      onCreated();
      
      // Reset form
      setEventType('note');
      setTitle('');
      setDescription('');
      setIsScheduled(false);
      setStatus('');
      setEventDate(new Date().toISOString().split('T')[0]);
    } catch (error: any) {
      toast.error('Kunde inte skapa händelse: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Lägg till händelse
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!organizationId && (
            <div className="space-y-2">
              <Label>Partner *</Label>
              <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj partner" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Typ av händelse *</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Datum *</Label>
            <Input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Titel *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kort beskrivning av händelsen"
            />
          </div>

          <div className="space-y-2">
            <Label>Beskrivning</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ytterligare detaljer (valfritt)"
              rows={3}
            />
          </div>

          {eventType === 'status_change' && (
            <div className="space-y-2">
              <Label>Ny status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktiv</SelectItem>
                  <SelectItem value="archived">Pausad</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Schemalagd händelse</p>
                <p className="text-xs text-muted-foreground">Händelsen sker i framtiden</p>
              </div>
            </div>
            <Switch
              checked={isScheduled}
              onCheckedChange={setIsScheduled}
              disabled={eventType === 'pause_scheduled' || eventType === 'activation_scheduled'}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Sparar...' : 'Lägg till'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
