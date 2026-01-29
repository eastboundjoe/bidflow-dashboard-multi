"use client";

import * as React from "react";
import { FolderOpen } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Portfolio {
  id: string;
  name: string;
}

interface PortfolioFilterProps {
  portfolios: Portfolio[];
  selectedPortfolio: string | null;
  onPortfolioChange: (portfolioId: string | null) => void;
  disabled?: boolean;
}

export function PortfolioFilter({
  portfolios,
  selectedPortfolio,
  onPortfolioChange,
  disabled = false,
}: PortfolioFilterProps) {
  return (
    <Select
      value={selectedPortfolio ?? "all"}
      onValueChange={(value) => onPortfolioChange(value === "all" ? null : value)}
      disabled={disabled}
    >
      <SelectTrigger className="w-[180px] bg-background">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="All portfolios" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Portfolios</SelectItem>
        {portfolios.map((portfolio) => (
          <SelectItem key={portfolio.id} value={portfolio.id}>
            {portfolio.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Extract unique portfolios from placement data
export function extractPortfolios(data: Array<{ portfolio_id: string | null; portfolio_name: string | null }>): Portfolio[] {
  const portfolioMap = new Map<string, Portfolio>();

  data.forEach((row) => {
    if (row.portfolio_id && row.portfolio_name && !portfolioMap.has(row.portfolio_id)) {
      portfolioMap.set(row.portfolio_id, {
        id: row.portfolio_id,
        name: row.portfolio_name,
      });
    }
  });

  return Array.from(portfolioMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}
