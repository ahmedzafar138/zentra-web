import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { format, addDays, startOfWeek } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Download,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { setMealData, setStartDate } from "@/store/slices/calendarSlice";
import { API_BASE_URL } from "@/lib/utils";

interface MealData {
  [key: string]: {
    [mealType: string]: string;
  };
}

const Calendar = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Get state from Redux
  const { mealData, startDate: storedStartDate } = useAppSelector(
    (state) => state.calendar
  );
  const mealPlans = useAppSelector((state) => state.mealPlans.plans);

  // Use stored start date, fallback to today
  const [startDate, setStartDateLocal] = useState<Date>(
    new Date(storedStartDate || new Date())
  );
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Update Redux when startDate changes
  useEffect(() => {
    dispatch(setStartDate(startDate.toISOString()));
  }, [startDate, dispatch]);

  // Debugging output
  // console.log("mealPlans from Redux:", mealPlans);

  const mealTypes = [
    { id: "breakfast", label: "B", name: "Breakfast", color: "bg-orange-500" },
    { id: "lunch", label: "L", name: "Lunch", color: "bg-green-500" },
    { id: "dinner", label: "D", name: "Dinner", color: "bg-blue-500" },
    { id: "snacks", label: "S", name: "Snacks", color: "bg-purple-500" },
  ];

  // Initialize with sample data
  useEffect(() => {
    const weekStart = startOfWeek(startDate, { weekStartsOn: 1 });
    const mondayKey = format(weekStart, "yyyy-MM-dd");

    if (!mealData[mondayKey]) {
      const newMealData = {
        ...mealData,
        [mondayKey]: {
          breakfast: "Egg Omelette with Chai",
        },
      };
      dispatch(setMealData(newMealData));
    }
  }, [startDate, mealData, dispatch]);

  // Map Redux mealPlans (day1–day7) to calendar dates
  useEffect(() => {
    const newMealData: MealData = {};

    for (let i = 0; i < 7; i++) {
      const date = addDays(startDate, i);
      const dateKey = format(date, "yyyy-MM-dd");
      const dayNumber = i + 1;

      // Find the plan for this specific day
      const dayPlan = mealPlans.find((p) => p.day === dayNumber);

      if (dayPlan && dayPlan.plan) {
        newMealData[dateKey] = {};
        Object.keys(dayPlan.plan).forEach((mealType) => {
          const mealObj = dayPlan.plan[mealType];
          const normalizedKey = mealType.toLowerCase();
          newMealData[dateKey][normalizedKey] =
            typeof mealObj === "object" && mealObj.food ? mealObj.food : "";
        });
      }
    }

    dispatch(setMealData(newMealData));
  }, [startDate, mealPlans, dispatch]);

  // Generate week dates
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));

  const clearWeek = () => {
    dispatch(setMealData({}));
  };

  const generateShoppingList = async () => {
    try {
      setLoading(true); // start loading

      const payload = mealPlans.reduce((acc, item) => {
        if (item.day && item.plan) {
          acc[`Day ${item.day}`] = item.plan;
        } else {
          Object.entries(item).forEach(([key, value]) => {
            const dayNum = key.replace("day", "");
            acc[`Day ${dayNum}`] = value as object;
          });
        }
        return acc;
      }, {} as Record<string, object>);

      const response = await fetch(
        `${API_BASE_URL}/api/v1/shopping_list/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) throw new Error("Failed to generate shopping list");
      const result = await response.json();

      navigate("/shopping-list", { state: { shoppingList: result.data } });
    } catch (err) {
      alert("Error generating shopping list");
    } finally {
      setLoading(false); // stop loading
    }
  };

  const downloadPDF = () => {
    // Create a new window with only the calendar content
    const printContent = document.querySelector(".calendar-print-area");
    if (printContent) {
      const newWindow = window.open("", "_blank");
      newWindow?.document.write(`
        <html>
          <head>
            <title>Weekly Meal Plan</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .print-title { text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 30px; }
              .meal-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 10px; margin-bottom: 20px; }
              .meal-cell { border: 1px solid #ccc; padding: 10px; min-height: 60px; }
              .meal-type { font-weight: bold; text-align: center; }
              .date-header { font-weight: bold; text-align: center; background: #f5f5f5; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            <div class="print-title">Weekly Meal Plan - ${format(
              startDate, // ✅ always today
              "MMM dd, yyyy"
            )}</div>
            ${printContent.innerHTML}
          </body>
        </html>
      `);
      newWindow?.document.close();
      newWindow?.print();
      newWindow?.close();
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Debugging: Show mealPlans object on the page */}
      {/* <div className="mb-4 p-4 bg-yellow-100 text-xs rounded-lg border border-yellow-300">
        <strong>Debug: mealPlans from Redux</strong>
        <pre>{JSON.stringify(mealPlans, null, 2)}</pre>
      </div> */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-6xl mx-auto"
      >
        {/* Header */}
        <div className="flex flex-col items-center mb-8 mt-5">
          <h1 className="text-4xl font-bold text-foreground mb-0 text-center mt-2">
            Weekly Diet Plan 🍴
          </h1>
        </div>

        {/* Main Card */}
        <Card className="mx-auto shadow-lg">
          <CardContent className="p-6 calendar-print-area">
            {/* Desktop View */}
            <div className="hidden md:block">
              {/* Date Headers */}
              <div className="grid grid-cols-8 gap-2 mb-4">
                <div></div> {/* Empty cell for meal types column */}
                {weekDates.map((date) => (
                  <div
                    key={date.toISOString()}
                    className="text-center p-3 bg-muted rounded-lg"
                  >
                    <div className="font-semibold">{format(date, "EEE")}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(date, "dd/MM/yyyy")}
                    </div>
                  </div>
                ))}
              </div>

              {/* Meal Grid */}
              {mealTypes.map((mealType) => (
                <div key={mealType.id} className="grid grid-cols-8 gap-2 mb-2">
                  {/* Meal Type Badge */}
                  <div className="flex items-center justify-center">
                    <div
                      className={`w-12 h-12 ${mealType.color} text-white rounded-full flex items-center justify-center font-bold text-lg`}
                    >
                      {mealType.label}
                    </div>
                  </div>

                  {/* Meal Cells */}
                  {weekDates.map((date) => {
                    const dateKey = format(date, "yyyy-MM-dd");
                    const cellKey = `${dateKey}-${mealType.id}`;
                    const mealContent = mealData[dateKey]?.[mealType.id] || "";

                    return (
                      <div
                        key={cellKey}
                        className="relative border border-border rounded-lg p-3 min-h-[80px] bg-card hover:bg-muted/50 transition-colors cursor-pointer group"
                        onMouseEnter={() => setHoveredCell(cellKey)}
                        onMouseLeave={() => setHoveredCell(null)}
                        onClick={() => mealContent && navigate("/meal-details")}
                      >
                        <div className="text-sm text-foreground">
                          {mealContent}
                        </div>

                        {/* Blur overlay and Details Button on hover */}
                        {hoveredCell === cellKey && mealContent && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex items-center justify-center"
                          >
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-primary hover:bg-primary/90"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate("/meal-recipe", {
                                  state: { mealName: mealContent },
                                });
                              }}
                            >
                              View Details
                            </Button>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Mobile/Tablet View */}
            <div className="md:hidden">
              {weekDates.map((date, index) => (
                <Card key={date.toISOString()} className="mb-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-center">
                      {format(date, "EEE, dd/MM/yyyy")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {mealTypes.map((mealType) => {
                      const dateKey = format(date, "yyyy-MM-dd");
                      const mealContent =
                        mealData[dateKey]?.[mealType.id] || "";

                      return (
                        <div
                          key={mealType.id}
                          className="flex items-center gap-3 mb-3"
                        >
                          <div
                            className={`w-8 h-8 ${mealType.color} text-white rounded-full flex items-center justify-center font-bold text-sm`}
                          >
                            {mealType.label}
                          </div>
                          <div
                            className="flex-1 border border-border rounded-lg p-2 min-h-[40px] bg-card cursor-pointer relative group"
                            onClick={() =>
                              mealContent && navigate("/meal-details")
                            }
                          >
                            {mealContent && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="absolute top-1 right-1 text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate("/meal-details");
                                }}
                              >
                                Details
                              </Button>
                            )}
                            <div className="text-sm text-foreground">
                              {mealContent}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="mt-4 w-full">
          <Button
            className="w-full text-lg py-6 bg-red-600 hover:bg-red-700 text-white"
            onClick={generateShoppingList}
            disabled={loading}
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 mr-2 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  ></path>
                </svg>
                Generating...
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                Generate Shopping List
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default Calendar;
