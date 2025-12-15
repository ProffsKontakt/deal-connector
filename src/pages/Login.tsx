import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Building2, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { z } from 'zod';

const authSchema = z.object({
  email: z.string().email('Ange en giltig e-postadress'),
  password: z.string().min(6, 'Lösenordet måste vara minst 6 tecken'),
});

const Login = () => {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground text-sm">Laddar...</span>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/deals" replace />;
  }

  const handleAuth = async (mode: 'signin' | 'signup') => {
    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      toast({
        title: '⚠️ Valideringsfel',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = mode === 'signin' 
        ? await signIn(email, password)
        : await signUp(email, password);

      if (error) {
        let message = error.message;
        if (error.message.includes('Invalid login credentials')) {
          message = 'Felaktiga inloggningsuppgifter';
        } else if (error.message.includes('User already registered')) {
          message = 'En användare med denna e-post finns redan';
        }
        toast({
          title: '⚠️ Fel',
          description: message,
          variant: 'destructive',
        });
        return;
      }

      if (mode === 'signup') {
        toast({
          title: '🎉 Konto skapat',
          description: 'Du kan nu logga in med dina uppgifter',
        });
      } else {
        navigate('/deals');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-lg shadow-primary/20 mb-4">
            <Building2 className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Proffskontakt</h1>
          <p className="text-muted-foreground mt-2 flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4" />
            CRM System
          </p>
        </div>

        <Card className="glass-card shadow-xl border-border/50">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">Välkommen tillbaka</CardTitle>
            <CardDescription>
              Logga in eller skapa ett konto för att fortsätta
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50 p-1">
                <TabsTrigger value="signin" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Logga in
                </TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Registrera
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-signin" className="text-sm font-medium">E-post</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email-signin"
                      type="email"
                      placeholder="namn@exempel.se"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-signin" className="text-sm font-medium">Lösenord</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password-signin"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 h-11"
                      onKeyDown={(e) => e.key === 'Enter' && handleAuth('signin')}
                    />
                  </div>
                </div>
                <Button
                  onClick={() => handleAuth('signin')}
                  disabled={isSubmitting}
                  className="w-full h-11 gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      Loggar in...
                    </>
                  ) : (
                    <>
                      Logga in
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-signup" className="text-sm font-medium">E-post</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email-signup"
                      type="email"
                      placeholder="namn@exempel.se"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-signup" className="text-sm font-medium">Lösenord</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password-signup"
                      type="password"
                      placeholder="Minst 6 tecken"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 h-11"
                      onKeyDown={(e) => e.key === 'Enter' && handleAuth('signup')}
                    />
                  </div>
                </div>
                <Button
                  onClick={() => handleAuth('signup')}
                  disabled={isSubmitting}
                  className="w-full h-11 gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      Skapar konto...
                    </>
                  ) : (
                    <>
                      Skapa konto
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Genom att fortsätta godkänner du våra användarvillkor
        </p>
      </div>
    </div>
  );
};

export default Login;