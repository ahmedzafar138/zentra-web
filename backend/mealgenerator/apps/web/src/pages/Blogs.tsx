import { useState } from 'react';
import { motion } from 'framer-motion';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, Clock, Search, Tag } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';

const Blogs = () => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  const blogPosts = [
    {
      id: 1,
      title: "The Science Behind Personalized Nutrition",
      excerpt: "Discover how AI and nutritional science work together to create meal plans that adapt to your unique needs.",
      category: "Nutrition Science",
      readTime: "5 min read",
      date: "2024-01-15",
      image: "/api/placeholder/400/250",
      tags: ["AI", "Nutrition", "Health"]
    },
    {
      id: 2,
      title: "Building Sustainable Eating Habits",
      excerpt: "Learn practical strategies to make healthy eating a natural part of your daily routine.",
      category: "Lifestyle",
      readTime: "7 min read",
      date: "2024-01-10",
      image: "/api/placeholder/400/250",
      tags: ["Habits", "Wellness", "Lifestyle"]
    },
    {
      id: 3,
      title: "Understanding Macronutrients for Better Health",
      excerpt: "A comprehensive guide to proteins, carbohydrates, and fats and how to balance them effectively.",
      category: "Education",
      readTime: "10 min read",
      date: "2024-01-05",
      image: "/api/placeholder/400/250",
      tags: ["Macros", "Education", "Nutrition"]
    },
    {
      id: 4,
      title: "Meal Prep Strategies for Busy Professionals",
      excerpt: "Time-saving tips and techniques to maintain a healthy diet even with a demanding schedule.",
      category: "Meal Prep",
      readTime: "6 min read",
      date: "2024-01-01",
      image: "/api/placeholder/400/250",
      tags: ["Meal Prep", "Productivity", "Tips"]
    }
  ];

  const categories = ['all', 'Nutrition Science', 'Lifestyle', 'Education', 'Meal Prep'];

  const filteredPosts = blogPosts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         post.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || post.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-6xl font-bold text-gradient-primary mb-6">
            OVIYA Blog
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Discover insights, tips, and the latest research in nutrition science and healthy living.
          </p>
        </motion.div>

        {/* Search and Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-12"
        >
          <Card className="shadow-glow border-0 bg-gradient-card">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search articles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {categories.map((category) => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(category)}
                      className="capitalize"
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Blog Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredPosts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 * index }}
            >
              <Card className="h-full shadow-glow border-0 bg-gradient-card hover:shadow-xl transition-all duration-300 cursor-pointer">
                <div className="aspect-video bg-muted rounded-t-lg flex items-center justify-center">
                  <span className="text-muted-foreground">Blog Image</span>
                </div>
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="secondary">{post.category}</Badge>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="h-4 w-4 mr-1" />
                      {post.readTime}
                    </div>
                  </div>
                  <CardTitle className="text-xl hover:text-primary transition-colors">
                    {post.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 mr-1" />
                      {new Date(post.date).toLocaleDateString()}
                    </div>
                    <div className="flex gap-1">
                      {post.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {filteredPosts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <p className="text-muted-foreground text-lg">
              No articles found matching your search criteria.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Blogs;