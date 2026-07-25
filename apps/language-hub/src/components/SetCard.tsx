import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, BarChart3, Pencil, Sparkles } from "lucide-react";

export interface SetCardSet {
  id: string;
  name: string;
  description: string | null;
  language: string;
  item_count?: number;
  progress?: number;
}

interface SetCardProps {
  set: SetCardSet;
  // Sits next to Edit in the header: a delete dialog on the home page,
  // "remove from folder" inside a folder.
  action?: ReactNode;
  // Stagger for the entrance animation; omit for no animation.
  animationDelay?: number;
}

export const SetCard = ({ set, action, animationDelay }: SetCardProps) => {
  const itemCount = set.item_count ?? 0;
  const progress = set.progress ?? 0;

  return (
    <Card
      className={`group shadow-card hover:shadow-hover transition-all duration-300 hover:-translate-y-1${
        animationDelay === undefined ? "" : " animate-slide-up"
      }`}
      style={animationDelay === undefined ? undefined : { animationDelay: `${animationDelay}ms` }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-display group-hover:text-primary transition-colors">
              {set.name}
            </CardTitle>
            {set.description && (
              <CardDescription className="mt-1 line-clamp-2">{set.description}</CardDescription>
            )}
          </div>
          <div className="flex gap-1">
            <Link to={`/edit/${set.id}`} aria-label={`Edit ${set.name}`}>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${set.name}`}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary hover:bg-primary/10"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </Link>
            {action}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <BookOpen className="h-4 w-4" />
            {itemCount} {itemCount === 1 ? "term" : "terms"}
          </span>
          <span className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            {progress}% mastered
          </span>
        </div>
        <div className="mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
            {set.language === "spanish" ? "🇪🇸 Spanish" : "🇫🇷 French"}
          </span>
        </div>

        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-4">
          <div className="h-full gradient-success transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="flex gap-2">
          <Link to={`/first-pass/${set.id}`} className="flex-1">
            <Button variant="outline" className="w-full">
              <Sparkles className="mr-2 h-4 w-4" />
              First Pass
            </Button>
          </Link>
          <Link to={`/study/${set.id}`} className="flex-1">
            <Button variant="default" className="w-full">
              Study Now
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
