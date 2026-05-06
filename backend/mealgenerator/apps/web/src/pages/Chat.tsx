import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Navigate, useNavigate } from "react-router-dom";
import { useAppSelector } from "@/store/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Loader2 } from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { saveMealPlan } from "@/store/slices/mealPlansSlice";
import {
  addMessage,
  setDietaryPreferences,
  setCulinaryPreferences,
  setShowInitialPrompt,
  clearChat,
} from "@/store/slices/chatSlice";
import ReactSelect from "react-select";
import { API_BASE_URL } from "@/lib/utils";
import { store } from "@/store/store";
import { authenticatedFetch } from "@/lib/auth";

const dietaryOptions = [
  "Vegetarian",
  "Vegan",
  "Keto",
  "Paleo",
  "Mediterranean",
  "Low Carb",
  "High Protein",
  "Gluten Free",
  "Dairy Free",
  "Nut Free",
];

const culinaryOptions = [
  "Pakistani",
  "Italian",
  "Mexican",
  "Indian",
  "Chinese",
  "Japanese",
  "Mediterranean",
  "American",
  "Thai",
  "French",
  "Middle Eastern",
];

// Function to detect and parse JSON safely
const tryParseJSON = (text: string) => {
  try {
    if (!text || typeof text !== "string") return null;

    // Remove code fences
    let cleaned = text
      .replace(/```json\s*/i, "")
      .replace(/```/g, "")
      .trim();

    // If it doesn’t start with "{" or "[", it’s not JSON
    if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
      return null;
    }

    // Cut off trailing notes after last "}"
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace !== -1) {
      cleaned = cleaned.slice(0, lastBrace + 1);
    }

    return JSON.parse(cleaned);
  } catch (e) {
    console.error("JSON parsing failed:", e);
    return null;
  }
};

// Function to render parsed JSON meal plan
const renderMealPlan = (data: any) => {
  if (!data || typeof data !== "object") return null;

  return Object.entries(data).map(([day, meals], idx) => (
    <div key={idx} className="mb-6">
      {/* <h2 className="text-2xl font-bold text-primary mb-4">{day}</h2> */}
      {Object.entries(meals as any).map(([mealType, mealData]: any, mIdx) => (
        <div key={mIdx} className="mb-4 pl-4 border-l-2 border-primary/40">
          <h3 className="text-lg font-semibold mb-2">{mealType}</h3>
          <p className="text-base">
            {mealType !== "Total Calories" ? (
              <>
                🍽️ <span className="font-semibold">{mealData.food}</span> —{" "}
                {mealData.portion}
              </>
            ) : (
              <span className="font-semibold">{mealData.food}</span>
            )}
          </p>
          <div className="text-sm text-muted-foreground mt-1 ml-2">
            <p>Protein: {mealData.macros.protein_g} g</p>
            <p>Fat: {mealData.macros.fat_g} g</p>
            <p>Carbs: {mealData.macros.carbohydrates_g} g</p>
            <p>Energy: {mealData.macros.energy_kcal} kcal</p>
          </div>
        </div>
      ))}
    </div>
  ));
};

// Modified formatResponse
const formatResponse = (text: string) => {
  const parsed = tryParseJSON(text);

  if (parsed) {
    return <div>{renderMealPlan(parsed)}</div>;
  }

  // fallback: normal text formatting if not JSON
  const lines = text.split("\n");
  const formattedElements: JSX.Element[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      formattedElements.push(<div key={key++} className="h-4" />);
      continue;
    }
    if (line.startsWith("## ")) {
      formattedElements.push(
        <h2 key={key++} className="text-2xl font-bold text-primary mb-4 mt-6">
          {line.replace("## ", "")}
        </h2>
      );
      continue;
    }
    if (line.match(/^\s*-\s*\*\*.*\*\*:/)) {
      const content = line.replace(/^\s*-\s*\*\*(.*)\*\*:/, "$1");
      formattedElements.push(
        <h3
          key={key++}
          className="text-lg font-semibold text-foreground mb-2 mt-4"
        >
          • {content}
        </h3>
      );
      continue;
    }
    if (line.match(/^\s*-\s*\*\*.*\*\*/)) {
      const content = line.replace(/^\s*-\s*\*\*(.*)\*\*/, "$1");
      formattedElements.push(
        <p
          key={key++}
          className="text-base font-semibold text-foreground ml-4 mb-2"
        >
          • {content}
        </p>
      );
      continue;
    }
    if (line.match(/^\s*-\s*/)) {
      const content = line.replace(/^\s*-\s*/, "");
      formattedElements.push(
        <p key={key++} className="text-sm text-muted-foreground ml-8 mb-1">
          • {content}
        </p>
      );
      continue;
    }
    if (line.trim()) {
      formattedElements.push(
        <p
          key={key++}
          className="text-base text-foreground mb-4 leading-relaxed"
        >
          {line}
        </p>
      );
    }
  }

  return <div className="space-y-1">{formattedElements}</div>;
};

const Chat = () => {
  const currentMealPlans = useAppSelector((state) => state.mealPlans.plans);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const { accessToken } = useAppSelector((state) => state.auth);
  const { onboardingComplete, profile } = useAppSelector((state) => state.user);

  // Get chat state from Redux
  const { messages, dietary, culinary, showInitialPrompt } = useAppSelector(
    (state) => state.chat
  );

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyPlans, setWeeklyPlans] = useState<any>(null);
  // Helper to get week dates starting from today
  const getWeekDates = () => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d.toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    });
  };

  // Handler for weekly plan generation
  const handleGenerateWeeklyPlan = async () => {
    if (!messages.length) return;
    setWeeklyLoading(true);
    try {
      // Find the last assistant message with a meal plan
      const lastAssistantMsg = messages
        .filter((m) => m.role === "assistant")
        .map((m) => tryParseJSON(m.content))
        .find((parsed) => parsed && parsed.day1);
      if (!lastAssistantMsg) throw new Error("No day 1 meal plan found.");
      const bmi = profile?.bmi;
      // Compose user input for backend
      const userInput = `Here is my day 1 meal plan: ${JSON.stringify(
        lastAssistantMsg.day1
      )}. Please generate the remaining 6 days of the week, all distinct. KEEP in mind that my BMI is ${bmi}, my culinary preferences are ${culinary.join(
        ", "
      )}, and my dietary preferences are ${dietary.join(", ")}.`;

      const reqBody = {
        user_profile: userInput,
      };
      const res = await authenticatedFetch(
        `${API_BASE_URL}/api/v1/meal-planning/generate-weekly`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reqBody),
        }
      );
      console.log("WEEKLY PLAN: ", res);
      if (!res.ok) throw new Error("Failed to generate weekly plan");
      const data = await res.json();
      console.log("weekly data:", data);
      let parsedMealPlan = data.meal_plan;
      if (typeof parsedMealPlan === "string") {
        parsedMealPlan = tryParseJSON(parsedMealPlan);
      }
      console.log("parsed weekly meal plan:", parsedMealPlan);
      // Merge day2–day7 into the global meal plan object in the store
      if (parsedMealPlan) {
        ["day2", "day3", "day4", "day5", "day6", "day7"].forEach((day) => {
          if (parsedMealPlan[day]) {
            const dayNumber = parseInt(day.replace("day", ""));
            dispatch(
              saveMealPlan({ day: dayNumber, plan: parsedMealPlan[day] })
            );
          }
        });
        if (parsedMealPlan.day1) {
          dispatch(saveMealPlan({ day: 1, plan: parsedMealPlan.day1 }));
        }

        // ✅ Immediately log the updated Redux store
        console.log("Final meal plan in store:", store.getState().mealPlans);

        // Debug: Check auth state before navigation
        console.log("🔍 Debug: Redux auth state before navigation:", {
          isAuthenticated,
          hasAccessToken: !!accessToken,
        });
        console.log("🔍 Debug: localStorage tokens before navigation:", {
          accessToken: localStorage.getItem("accessToken"),
          refreshToken: localStorage.getItem("refreshToken"),
        });

        setWeeklyLoading(false);
        navigate("/calendar");
      }
    } catch (e) {
      console.error("Weekly plan generation error:", e);
      if (e instanceof Error && e.message === "Session expired") {
        // Handle session expiry - redirect to auth
        navigate("/auth");
        return;
      }
      setWeeklyLoading(false);
    }
  };

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (!onboardingComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    // Require preferences
    if (dietary.length === 0 || culinary.length === 0) {
      setValidationError(
        "Please select at least one dietary and one culinary preference."
      );
      return;
    }
    setValidationError(null);

    const bmi = profile?.bmi;
    const heightVal = profile?.height?.value;
    const heightUnit = profile?.height?.unit;

    const prefixParts: string[] = [];
    if (bmi) prefixParts.push(`I have a BMI of ${bmi}.`);
    if (heightVal)
      prefixParts.push(
        `My height is ${heightVal}${heightUnit === "ft" ? " ft" : " cm"}.`
      );
    prefixParts.push(`My culinary preferences are ${culinary.join(", ")}.`);
    prefixParts.push(`My dietary preferences are ${dietary.join(", ")}.`);

    const composed = `${prefixParts.join(" ")} ${input}`;

    const userMessage = { role: "user" as const, content: composed };
    dispatch(addMessage(userMessage));
    setInput("");
    setIsLoading(true);
    dispatch(setShowInitialPrompt(false));

    try {
      const reqBody = {
        user_profile: composed,
      };
      const res = await authenticatedFetch(
        `${API_BASE_URL}/api/v1/meal-planning/generate-daily`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reqBody),
        }
      );
      if (!res.ok) {
        throw new Error("Failed to generate meal plan");
      }
      const data = await res.json();

      console.log("HEYYYY1", data);
      // Save meal plan for day 1 if available
      // inside handleSendMessage after const data = await res.json();
      let parsedMealPlan = data.meal_plan;
      // console.log("HEYYYY", parsedMealPlan);
      // If meal_plan came as a string (with ```json formatting), parse it

      const tryParsed = tryParseJSON(parsedMealPlan);
      // console.log(tryParsed);

      parsedMealPlan = tryParsed;

      console.log("HEYYYY", parsedMealPlan);

      dispatch(saveMealPlan({ day: 1, plan: parsedMealPlan.day1 }));
      console.log("day 1: ", parsedMealPlan.day1);
      console.log("meal plan object", { day: 1, plan: parsedMealPlan.day1 });

      const aiResponse = {
        role: "assistant" as const,
        content: data.meal_plan || data.message || "No response",
      };
      dispatch(addMessage(aiResponse));
    } catch (e) {
      console.error("Daily meal plan generation error:", e);
      if (e instanceof Error && e.message === "Session expired") {
        // Handle session expiry - redirect to auth
        navigate("/auth");
        return;
      }
      const aiResponse = {
        role: "assistant" as const,
        content:
          "Sorry, there was an error generating your meal plan. Please try again.",
      };
      dispatch(addMessage(aiResponse));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-bg pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-gradient-primary mb-4">
            Chat with OVIYA AI
          </h1>
          <p className="text-muted-foreground text-lg">
            Tell me about your meal preferences, goals, and any dietary
            restrictions
          </p>
        </motion.div>

        {/* Preferences Box (replaces initial prompt) */}
        {showInitialPrompt && (
          <motion.div
            initial={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            <Card className="shadow-glow border-0 bg-gradient-card">
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold mb-2">
                      Dietary Preferences
                    </h3>
                    <ReactSelect
                      isMulti
                      placeholder="Select dietary preferences"
                      options={dietaryOptions.map((o) => ({
                        value: o,
                        label: o,
                      }))}
                      onChange={(opts) =>
                        dispatch(
                          setDietaryPreferences(opts.map((o) => o.value))
                        )
                      }
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-2">
                      Culinary Preferences
                    </h3>
                    <ReactSelect
                      isMulti
                      placeholder="Select culinary preferences"
                      options={culinaryOptions.map((o) => ({
                        value: o,
                        label: o,
                      }))}
                      onChange={(opts) =>
                        dispatch(
                          setCulinaryPreferences(opts.map((o) => o.value))
                        )
                      }
                    />
                  </div>
                </div>
                {validationError && (
                  <p className="text-red-500 text-sm mt-4">{validationError}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Chat Messages */}
        <div className="space-y-6 mb-8">
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <Card
                className={`${
                  message.role === "user" ? "max-w-[80%]" : "w-full"
                } ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-gradient-card shadow-glow border-0"
                }`}
              >
                <CardContent className="p-6">
                  {message.role === "assistant" ? (
                    formatResponse(message.content)
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}

                  {message.role === "assistant" && (
                    <div className="flex gap-3 mt-6 pt-4 border-t border-border/50">
                      <Button
                        variant="default"
                        className="flex-1"
                        onClick={handleGenerateWeeklyPlan}
                        disabled={weeklyLoading}
                      >
                        {weeklyLoading ? (
                          <span className="flex items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />{" "}
                            Generating Weekly Plan...
                          </span>
                        ) : (
                          "Generate Weekly Plan"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 hover:bg-secondary hover:text-secondary-foreground transition-colors"
                        onClick={() => navigate("/recipes")}
                      >
                        Get Recipes
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {/* Loading Animation */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <Card className="bg-gradient-card shadow-glow border-0">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-muted-foreground">
                      OVIYA is thinking about your perfect meal plan...
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Weekly Plan Loader (single loader, no display) */}
          {weeklyLoading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              {/* <Card className="bg-gradient-card shadow-glow border-0">
                <CardContent className="p-4">
                  <div className="flex i
                  tems-center space-x-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-muted-foreground">
                      Generating your weekly meal plan...
                    </span>
                  </div>
                </CardContent>
              </Card> */}
            </motion.div>
          )}
        </div>

        {/* Chat Input - Always centered */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex justify-center"
        >
          <Card className="w-full max-w-4xl shadow-glow border-0 bg-gradient-card">
            <CardContent className="p-4">
              <div className="flex space-x-3">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your prompt..."
                  className="flex-1 bg-background/50"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isLoading}
                  className="bg-gradient-primary hover-lift"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Chat;
