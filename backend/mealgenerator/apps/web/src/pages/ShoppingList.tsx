import { useState } from "react";
import { motion } from "framer-motion";
import { X, Copy, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "react-router-dom";

const ShoppingList = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copiedCategory, setCopiedCategory] = useState<string | null>(null);
  const location = useLocation();
  const shoppingList =
    (location.state && (location.state as any).shoppingList) || {};

  const categoryColors: Record<string, string> = {
    "Vegetables and Herbs":
      "bg-green-500/10 text-green-700 border-green-500/20",
    Fruits: "bg-orange-500/10 text-orange-700 border-orange-500/20",
    Proteins: "bg-red-500/10 text-red-700 border-red-500/20",
    Dairy: "bg-blue-500/10 text-blue-700 border-blue-500/20",
    "Dry Goods and Grains":
      "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
    "Snacks and Others":
      "bg-purple-500/10 text-purple-700 border-purple-500/20",
  };

  const copyCategory = (category: string, items: string[]) => {
    const text = `${category}:\n${items.map((item) => `• ${item}`).join("\n")}`;
    navigator.clipboard.writeText(text);
    setCopiedCategory(category);

    toast({
      title: "Copied to clipboard!",
      description: `${category} list copied successfully`,
    });

    setTimeout(() => setCopiedCategory(null), 2000);
  };

  const copyFullList = () => {
    const fullText = Object.entries(shoppingList)
      .map(
        ([category, items]) =>
          `${category}:\n${items.map((item) => `• ${item}`).join("\n")}`
      )
      .join("\n\n");

    navigator.clipboard.writeText(fullText);
    toast({
      title: "Full list copied!",
      description: "Complete shopping list copied to clipboard",
    });
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="max-w-4xl mx-auto relative"
      >
        {/* Main Card */}
        <Card className="shadow-lg border-0 bg-card relative">
          {/* Close Button - Top right of card */}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="absolute -top-2 -right-2 z-10"
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/calendar")}
              className="rounded-full w-10 h-10 p-0 shadow-md bg-background border-2"
              aria-label="Close shopping list"
            >
              <X className="w-4 h-4" />
            </Button>
          </motion.div>

          <CardHeader className="text-center pb-6 pt-8">
            {/* Pill-shaped title */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="inline-flex mx-auto"
            >
              <Badge
                variant="secondary"
                className="text-xl px-8 py-3 rounded-full bg-primary text-primary-foreground text-center font-bold shadow-sm"
              >
                🛒 Shopping List: Entire Week
              </Badge>
            </motion.div>
          </CardHeader>

          <CardContent className="space-y-6 px-6 pb-8">
            {/* Copy All Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="text-center"
            >
              <Button onClick={copyFullList} variant="outline" className="mb-6">
                <Copy className="w-4 h-4 mr-2" />
                Copy Full List
              </Button>
            </motion.div>

            {/* Shopping Categories */}
            <div className="space-y-6">
              {Object.entries(shoppingList).map(
                ([category, items], categoryIndex) => (
                  <motion.div
                    key={category}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.4,
                      delay: 0.1 + categoryIndex * 0.1,
                    }}
                    className="space-y-3"
                  >
                    {/* Category Header */}
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className={`text-base px-4 py-2 rounded-full font-semibold border-2 ${
                          categoryColors[
                            category as keyof typeof categoryColors
                          ]
                        }`}
                      >
                        {category}
                      </Badge>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyCategory(category, items)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Copy ${category} list`}
                      >
                        {copiedCategory === category ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>

                    {/* Category Items */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 ml-4">
                      {items.map((item, itemIndex) => (
                        <motion.div
                          key={itemIndex}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            duration: 0.3,
                            delay: 0.2 + categoryIndex * 0.1 + itemIndex * 0.05,
                          }}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                          tabIndex={0}
                        >
                          <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
                          <span className="text-foreground leading-relaxed group-hover:text-primary transition-colors">
                            {item}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )
              )}
            </div>

            {/* Footer Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              className="mt-8 pt-6 border-t border-border text-center"
            >
              <p className="text-sm text-muted-foreground leading-relaxed">
                💡 Tip: Tap the copy button next to each category to copy
                individual lists, or use "Copy Full List" to get everything at
                once!
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default ShoppingList;
