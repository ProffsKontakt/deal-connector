import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InterestBadge } from '@/components/ui/interest-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Building2, Mail, Phone, MapPin, User, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface Organization {
  id: string;
  name: string;
}

interface CreditRequest {
  status: 'pending' | 'approved' | 'denied';
  organization_id: string;
  organization?: { name: string };
}

interface Contact {
  id: string;
  email: string;
  phone: string | null;
  address: string | null;
  date_sent: string;
  interest: 'sun' | 'battery' | 'sun_battery';
  opener?: { email: string; full_name: string | null };
  organizations?: Organization[];
  credit_requests?: CreditRequest[];
}

interface DealDetailsDialogProps {
  contact: Contact | null;
  organizations: Organization[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DealDetailsDialog = ({ contact, organizations, open, onOpenChange }: DealDetailsDialogProps) => {
  if (!contact) return null;

  // Get organization names for credit requests
  const getCreditingOrganizations = () => {
    if (!contact.credit_requests || contact.credit_requests.length === 0) return [];
    
    return contact.credit_requests.map(cr => {
      const org = organizations.find(o => o.id === cr.organization_id);
      return {
        name: org?.name || 'Okänd organisation',
        status: cr.status,
      };
    });
  };

  const creditingOrgs = getCreditingOrganizations();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Deal Detaljer</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Contact Info */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Kontaktinformation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-primary" />
                <span className="font-medium">{contact.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{contact.phone || 'Ej angivet'}</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{contact.address || 'Ej angivet'}</span>
              </div>
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Opener: {contact.opener?.full_name || contact.opener?.email || 'Okänd'}
                </span>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <span className="text-sm text-muted-foreground">Intresse:</span>
                <InterestBadge interest={contact.interest} />
              </div>
              <div className="text-sm text-muted-foreground">
                Skickad: {format(new Date(contact.date_sent), 'dd MMMM yyyy', { locale: sv })}
              </div>
            </CardContent>
          </Card>

          {/* Organizations */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Synlig för organisationer
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contact.organizations && contact.organizations.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {contact.organizations.map((org) => (
                    <span
                      key={org.id}
                      className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium"
                    >
                      {org.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Inga organisationer kopplade</p>
              )}
            </CardContent>
          </Card>

          {/* Credit Requests */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Kreditförfrågningar
              </CardTitle>
            </CardHeader>
            <CardContent>
              {creditingOrgs.length > 0 ? (
                <div className="space-y-2">
                  {creditingOrgs.map((credit, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                    >
                      <span className="font-medium">{credit.name}</span>
                      <StatusBadge status={credit.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Ingen har begärt kredit</p>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
