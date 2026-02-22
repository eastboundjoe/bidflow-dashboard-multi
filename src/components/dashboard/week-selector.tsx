"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Week {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
}

interface WeekSelectorProps {
  weeks: Week[];
  selectedWeek: string;
  onWeekChange: (weekId: string) => void;
  disabled?: boolean;
}

export function WeekSelector({
  weeks,
  selectedWeek,
  onWeekChange,
  disabled = false,
}: WeekSelectorProps) {
  const currentIndex = weeks.findIndex((w) => w.id === selectedWeek);
  const selectedWeekData = weeks.find((w) => w.id === selectedWeek);

  const handlePrevious = () => {
    if (currentIndex < weeks.length - 1) {
      onWeekChange(weeks[currentIndex + 1].id);
    }
  };

  const handleNext = () => {
    if (currentIndex > 0) {
      onWeekChange(weeks[currentIndex - 1].id);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={handlePrevious}
        disabled={disabled || currentIndex >= weeks.length - 1}
        className="h-9 w-9 border-slate-200 hover:border-blue-400 hover:text-blue-600 transition-all"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Select
        value={selectedWeek}
        onValueChange={onWeekChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-[200px] h-9 bg-background border-slate-200 hover:border-blue-400 transition-all">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <SelectValue placeholder="Select week" />
          </div>
        </SelectTrigger>
        <SelectContent className="bg-white dark:bg-slate-950 opacity-100 shadow-xl border-2 z-50 rounded-xl p-1">
          {weeks.map((week) => (
            <SelectItem key={week.id} value={week.id} className="rounded-lg focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:text-blue-600 transition-colors">
              <div className="flex flex-col py-0.5">
                <span className="font-bold text-sm">{week.label}</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                  {week.startDate} - {week.endDate}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon"
        onClick={handleNext}
        disabled={disabled || currentIndex <= 0}
        className="h-9 w-9 border-slate-200 hover:border-blue-400 hover:text-blue-600 transition-all"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {selectedWeekData && (
        <div className="ml-2 text-xs text-muted-foreground hidden md:block">
          {selectedWeekData.startDate} - {selectedWeekData.endDate}
        </div>
      )}
    </div>
  );
}

// Helper to generate week options from data
export function generateWeekOptions(data: Array<{ week_id: string; date_range_start: string; date_range_end: string }>): Week[] {
  const weekMap = new Map<string, Week>();

  data.forEach((row) => {
    if (!weekMap.has(row.week_id)) {
      weekMap.set(row.week_id, {
        id: row.week_id,
        label: row.week_id,
        startDate: new Date(row.date_range_start).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        endDate: new Date(row.date_range_end).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      });
    }
  });

  return Array.from(weekMap.values()).sort((a, b) => b.id.localeCompare(a.id));
}
