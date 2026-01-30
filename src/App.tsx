import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@/lib/i18n";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { initializeNeutronMode } from "@/stores/neutronStore";
import Auth from "./pages/Auth";
import Discover from "./pages/Discover";
import Recipes from "./pages/Recipes";
import RecipeDetail from "./pages/RecipeDetail";
import CreateRecipe from "./pages/CreateRecipe";
import Plan from "./pages/Plan";
import Grocery from "./pages/Grocery";
import MyRecipes from "./pages/MyRecipes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  // Ensure auth is initialized even on public routes (like `/`) so user-scoped
  // persisted stores (meal plan + macro calculator inputs) hydrate correctly.
  useAuth();
  
  // Initialize Neutron mode from persisted storage on app load
  useEffect(() => {
    initializeNeutronMode();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Redirect root to discover */}
            <Route path="/" element={<Navigate to="/discover" replace />} />
            <Route path="/auth" element={<Auth />} />
            
            {/* Protected routes */}
            {/* Public recipe browsing */}
            <Route path="/discover" element={<Discover />} />
            <Route path="/recipe/new" element={
              <ProtectedRoute>
                <CreateRecipe />
              </ProtectedRoute>
            } />
            <Route path="/recipe/:id" element={<RecipeDetail />} />
            
            {/* Protected routes */}
            <Route path="/my-recipes" element={
              <ProtectedRoute>
                <MyRecipes />
              </ProtectedRoute>
            } />
            <Route path="/recipes" element={
              <ProtectedRoute>
                <Recipes />
              </ProtectedRoute>
            } />
            <Route path="/plan" element={
              <ProtectedRoute>
                <Plan />
              </ProtectedRoute>
            } />
            <Route path="/grocery" element={
              <ProtectedRoute>
                <Grocery />
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
