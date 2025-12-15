import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import Login from "./pages/Login";
import Deals from "./pages/Deals";
import Kreditera from "./pages/Kreditera";
import MinSida from "./pages/MinSida";
import Admin from "./pages/Admin";
import Openers from "./pages/Openers";
import Partners from "./pages/Partners";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="proffskontakt-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Navigate to="/deals" replace />} />
              <Route element={<AppLayout />}>
                <Route path="/deals" element={<Deals />} />
                <Route path="/kreditera" element={<Kreditera />} />
                <Route path="/minsida" element={<MinSida />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/openers" element={<Openers />} />
                <Route path="/partners" element={<Partners />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;