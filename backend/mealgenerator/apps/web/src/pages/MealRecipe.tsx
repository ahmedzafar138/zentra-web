import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { API_BASE_URL } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const MealRecipe = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const mealName = location.state?.mealName; // 👈 passed from Calendar

  const [recipe, setRecipe] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchRecipe = async () => {
    if (!mealName) return;
    setLoading(true);
    try {
      console.log("Fetching recipe for:", mealName);
      const res = await fetch(`${API_BASE_URL}/api/v1/recipe/generate-recipe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meal_name: mealName }),
      });

      if (!res.ok) throw new Error("Failed to fetch recipe");
      const data = await res.json();
      setRecipe(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipe();
  }, [mealName]);

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-5xl"
      >
        {/* Back Button */}
        <div className="flex justify-start mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/calendar")}
            className="hover:bg-destructive hover:text-destructive-foreground transition-all duration-200 hover:scale-105"
          >
            <ChevronLeft className="h-5 w-5 mr-1" /> Back to Calendar
          </Button>
        </div>
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground text-lg font-medium text-center">
              Cooking up {mealName} for you...
            </p>
          </div>
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

export default MealRecipe;
