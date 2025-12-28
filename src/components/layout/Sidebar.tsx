import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { FileText, CreditCard, User, LogOut, Settings, Sun, Moon, Users, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import logoDark from "@/assets/logo-dark.png";
import logoLight from "@/assets/logo-light.png";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  requiresCreditPermission?: boolean;
}

const navItems: NavItem[] = [
  { to: "/admin", label: "Admin", icon: User, roles: ["admin"] },
  { to: "/deals", label: "Deals", icon: FileText, roles: ["admin", "teamleader", "opener", "organization", "closer"] },
  { to: "/saljare", label: "Säljare", icon: Users, roles: ["admin"] },
  { to: "/partners", label: "Partners", icon: Handshake, roles: ["admin"] },
  { to: "/kreditera", label: "Kreditera", icon: CreditCard, roles: ["organization"], requiresCreditPermission: true },
  { to: "/installningar", label: "Inställningar", icon: Settings, roles: ["admin"] },
];

export const Sidebar = () => {
  const { profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [canRequestCredits, setCanRequestCredits] = useState<boolean>(true);

  useEffect(() => {
    if (profile?.role === 'organization' && profile?.organization_id) {
      fetchCreditPermission();
    }
  }, [profile]);

  const fetchCreditPermission = async () => {
    if (!profile?.organization_id) return;
    
    const { data } = await supabase
      .from('organizations')
      .select('can_request_credits')
      .eq('id', profile.organization_id)
      .single();
    
    setCanRequestCredits(data?.can_request_credits ?? true);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const filteredNav = navItems.filter((item) => {
    // Check role permission
    if (!profile?.role || !item.roles.includes(profile.role)) {
      return false;
    }
    
    // Check credit permission for Kreditera menu item
    if (item.requiresCreditPermission && !canRequestCredits) {
      return false;
    }
    
    return true;
  });

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: "Administrator",
      teamleader: "Teamleader",
      opener: "Opener",
      closer: "Closer",
      organization: "Partner",
    };
    return labels[role] || role;
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={theme === "dark" ? logoDark : logoLight} 
              alt="Proffskontakt" 
              className="w-10 h-10 rounded-xl object-cover"
            />
            <div>
              <h1 className="font-semibold text-sidebar-foreground tracking-tight">Proffskontakt</h1>
              <p className="text-xs text-muted-foreground">CRM System</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9 rounded-lg text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {filteredNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="mb-3 px-4">
          <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.email}</p>
          <p className="text-xs text-muted-foreground">{profile?.role && getRoleLabel(profile.role)}</p>
        </div>
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
        >
          <LogOut className="w-4 h-4" />
          Logga ut
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
