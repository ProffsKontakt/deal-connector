-- Create role enum
CREATE TYPE public.user_role AS ENUM ('admin', 'teamleader', 'opener', 'organization');

-- Create interest enum
CREATE TYPE public.interest_type AS ENUM ('sun', 'battery', 'sun_battery');

-- Create credit status enum
CREATE TYPE public.credit_status AS ENUM ('pending', 'approved', 'denied');

-- Organizations table
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price_per_solar_deal NUMERIC,
  price_per_battery_deal NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Profiles table (users with roles)
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'opener',
  organization_id UUID REFERENCES public.organizations(id),
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User roles table for RLS (security definer pattern)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Contacts (deals) table
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  date_sent DATE NOT NULL DEFAULT CURRENT_DATE,
  interest interest_type NOT NULL,
  opener_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Contact organizations junction table
CREATE TABLE public.contact_organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  UNIQUE(contact_id, organization_id)
);

-- Credit requests table
CREATE TABLE public.credit_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status credit_status NOT NULL DEFAULT 'pending',
  reason TEXT,
  requested_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_requests ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = _user_id
$$;

-- Check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role
  )
$$;

-- Get user's organization
CREATE OR REPLACE FUNCTION public.get_user_organization(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = _user_id
$$;

-- Handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'opener');
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'opener');
  
  RETURN new;
END;
$$;

-- Trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_credit_requests_updated_at BEFORE UPDATE ON public.credit_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for organizations
CREATE POLICY "Anyone authenticated can view organizations" ON public.organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage organizations" ON public.organizations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for contacts
CREATE POLICY "Admins and teamleaders can view all contacts" ON public.contacts FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teamleader')
);
CREATE POLICY "Openers can view own contacts" ON public.contacts FOR SELECT TO authenticated USING (opener_id = auth.uid());
CREATE POLICY "Organizations can view related contacts" ON public.contacts FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'organization') AND 
  EXISTS (
    SELECT 1 FROM public.contact_organizations co 
    WHERE co.contact_id = id AND co.organization_id = public.get_user_organization(auth.uid())
  )
);
CREATE POLICY "Authenticated users can insert contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (opener_id = auth.uid());
CREATE POLICY "Admins can update contacts" ON public.contacts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete contacts" ON public.contacts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for contact_organizations
CREATE POLICY "View contact organizations" ON public.contact_organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage contact organizations" ON public.contact_organizations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for credit_requests
CREATE POLICY "Admins can view all credit requests" ON public.credit_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Organizations can view own credit requests" ON public.credit_requests FOR SELECT TO authenticated USING (
  organization_id = public.get_user_organization(auth.uid())
);
CREATE POLICY "Organizations can insert credit requests" ON public.credit_requests FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'organization') AND
  organization_id = public.get_user_organization(auth.uid())
);
CREATE POLICY "Admins can update credit requests" ON public.credit_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));