import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { persistStore } from "redux-persist";
import { store, persistor } from "@/store/store";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import Navbar from "@/components/layout/Navbar";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Chat from "./pages/Chat";
import Calendar from "./pages/Calendar";
import MealDetails from "./pages/MealDetails";
import ShoppingList from "./pages/ShoppingList";
import About from "./pages/About";
import Blogs from "./pages/Blogs";
import NotFound from "./pages/NotFound";
import FoodAnalysis from "./pages/FoodAnalysis";
import RecipeDetails from "./pages/RecipeDetails";
import MealRecipe from "./pages/MealRecipe";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import AuthInitializer from "@/components/layout/AuthInitializer";

const queryClient = new QueryClient();

const App = () => {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AuthInitializer>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider defaultTheme="light" storageKey="oviya-ui-theme">
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <Navbar />
                  <div className="pt-20">
                    <Routes>
                      <Route path="/" element={<Landing />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/onboarding" element={<Onboarding />} />
                      <Route path="/chat" element={<Chat />} />
                      <Route
                        path="/calendar"
                        element={
                          <ProtectedRoute>
                            <Calendar />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/meal-details"
                        element={
                          <ProtectedRoute>
                            <MealDetails />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/shopping-list"
                        element={
                          <ProtectedRoute>
                            <ShoppingList />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="/about" element={<About />} />
                      <Route path="/blogs" element={<Blogs />} />
                      <Route path="/food-analysis" element={<FoodAnalysis />} />
                      <Route
                        path="/recipes"
                        element={
                          <ProtectedRoute>
                            <RecipeDetails />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/meal-recipe"
                        element={
                          <ProtectedRoute>
                            <MealRecipe />
                          </ProtectedRoute>
                        }
                      />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </div>
                </BrowserRouter>
              </TooltipProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </AuthInitializer>
      </PersistGate>
    </Provider>
  );
};

export default App;
