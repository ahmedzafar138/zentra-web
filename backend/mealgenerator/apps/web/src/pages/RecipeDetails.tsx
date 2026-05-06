import { useState, useEffect } from "react";
import { useAppSelector } from "@/store/hooks";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "@/lib/utils";
import { motion } from "framer-motion";
import { X } from "lucide-react";

const mealTypes = ["Breakfast", "Lunch", "Dinner", "Snacks"];

const RecipeDetails = () => {
  const day1Plan = useAppSelector(
    (state) => state.mealPlans.plans.find((p) => p.day === 1)?.plan
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clicked, setClicked] = useState(false); // Track if any button clicked
  const [activeMeal, setActiveMeal] = useState<string | null>(null); // Active button
  const navigate = useNavigate();

  const handleGetRecipe = async (mealKey: string) => {
    if (!day1Plan || !day1Plan[mealKey]) return;
    setLoading(true);
    setError(null);
    setClicked(true); // Hide helper text after first click
    setActiveMeal(mealKey); // Mark active button
    // console.log(day1Plan[mealKey]);

    try {
      const mealName = day1Plan[mealKey].food;
      const res = await fetch(`${API_BASE_URL}/api/v1/recipe/generate-recipe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meal_name: mealName }),
      });
      if (!res.ok) throw new Error("Failed to fetch recipe");
      const data = await res.json();
      // Navigate to MealDetails with recipe data
      navigate("/meal-details", { state: { recipe: data } });
    } catch (e: any) {
      setError(e.message || "Error fetching recipe");
    } finally {
      setLoading(false);
    }
  };

  // Auto-load Breakfast when page loads
  useEffect(() => {
    if (day1Plan && !clicked) {
      handleGetRecipe("Breakfast");
    }
  }, [day1Plan]);

  return (
    <div className="min-h-screen bg-background p-6 flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-4xl"
      >
        {/* Close Button */}
        <div className="flex justify-end mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/chat")}
            className="hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Heading */}
        <h1 className="text-3xl md:text-4xl font-black text-center mb-8 text-gradient-primary">
          Day 1 Recipes
        </h1>

        {/* Meal Buttons */}
        <div className="flex flex-wrap justify-center gap-4 mb-4">
          {day1Plan &&
            mealTypes.map((mealKey) => (
              <Button
                key={mealKey}
                onClick={() => handleGetRecipe(mealKey)}
                disabled={loading}
                className={`px-6 py-2 font-semibold text-white rounded-2xl shadow-md transition-transform duration-200 hover:scale-105 
                  bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500
                  ${
                    activeMeal === mealKey
                      ? "ring-4 ring-pink-300 scale-105"
                      : ""
                  }`}
              >
                {mealKey}
              </Button>
            ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-8">
            <span className="text-lg font-semibold text-primary animate-pulse">
              Asking the chef inside to plan your recipe...
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-8 text-red-600 font-semibold">
            {error}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default RecipeDetails;
