import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useNavigate, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { API_BASE_URL } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";

const MealDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialRecipe = location.state?.recipe;

  const actions = ["Breakfast", "Lunch", "Dinner", "Snacks"];
  const [activeMeal, setActiveMeal] = useState("Breakfast"); // 👈 Default = Breakfast
  const [recipe, setRecipe] = useState(initialRecipe);
  const [loading, setLoading] = useState(false);

  const mealPlan = useAppSelector(
    (state) => state.mealPlans.plans.find((p) => p.day === 1)?.plan
  );

  const fetchRecipe = async (meal: string) => {
    setLoading(true);
    try {
      const selectedMeal = mealPlan?.[meal] || { meal_name: meal };

      const res = await fetch(`${API_BASE_URL}/api/v1/recipe/generate-recipe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meal_name: selectedMeal.food || meal,
          ...selectedMeal,
        }),
      });

      if (!res.ok) throw new Error("Failed to fetch recipe");
      const data = await res.json();
      setRecipe(data);
    } catch (err) {
      console.error(err);
      setRecipe(null);
    } finally {
      setLoading(false);
    }
  };
  // 👇 Automatically fetch Breakfast recipe on page load
  useEffect(() => {
    if (!recipe) {
      fetchRecipe("Breakfast");
    }
  }, []);

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-5xl"
      >
        {/* Close Button */}
        <div className="flex justify-end mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/chat")}
            className="hover:bg-destructive hover:text-destructive-foreground transition-all duration-200 hover:scale-110"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-center gap-4 mb-3">
          {actions.map((label) => (
            <Button
              key={label}
              onClick={() => {
                setActiveMeal(label);
                fetchRecipe(label);
              }}
              disabled={loading}
              className={`px-6 py-2 font-semibold rounded-2xl shadow-md transition-transform duration-200 hover:scale-105 
        ${
          recipe?.meal_name === label // ✅ highlight if current recipe matches meal_name
            ? "ring-4 ring-primary bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600"
            : "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
        }`}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <p className="text-center text-muted-foreground mb-8 text-sm md:text-base font-medium">
            Asking the chef inside to plan your {activeMeal} recipe...
          </p>
        )}

        {/* Recipe Content */}
        {!loading && recipe ? (
          <Card className="shadow-lg border-0 bg-card">
            <CardHeader className="relative pb-2">
              <h1 className="text-3xl md:text-4xl font-black text-foreground mb-6 text-center">
                {recipe.meal_name}
              </h1>
            </CardHeader>

            <CardContent className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Ingredients */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className="space-y-4"
                >
                  <h2 className="text-xl font-bold text-primary mb-4 pb-2 border-b-2 border-primary/30">
                    🥘 {recipe.ingredients.heading}
                  </h2>
                  <div className="space-y-1">
                    {recipe.ingredients.items.map(
                      (ingredient: string, idx: number) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            duration: 0.3,
                            delay: 0.1 + idx * 0.05,
                          }}
                          className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors border-l-2 border-primary/30"
                        >
                          <span className="text-primary font-bold min-w-[24px] bg-primary/20 rounded-full w-6 h-6 flex items-center justify-center text-sm">
                            {idx + 1}
                          </span>
                          <span className="text-foreground leading-relaxed font-bold">
                            {ingredient}
                          </span>
                        </motion.div>
                      )
                    )}
                  </div>
                </motion.div>

                {/* Instructions */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="space-y-4"
                >
                  <h2 className="text-xl font-bold text-secondary mb-4 pb-2 border-b-2 border-secondary/30">
                    👩‍🍳 {recipe.instructions.heading}
                  </h2>
                  <div className="space-y-2">
                    {recipe.instructions.steps.map(
                      (step: string, idx: number) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            duration: 0.3,
                            delay: 0.2 + idx * 0.05,
                          }}
                          className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors border-l-2 border-secondary/30"
                        >
                          <span className="text-secondary font-bold min-w-[32px] bg-secondary/20 rounded-full w-8 h-8 flex items-center justify-center text-sm">
                            {idx + 1}
                          </span>
                          <p className="text-foreground leading-relaxed text-base font-bold">
                            {step}
                          </p>
                        </motion.div>
                      )
                    )}
                  </div>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </motion.div>
    </div>
  );
};

export default MealDetails;
