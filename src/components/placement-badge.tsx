"use client";

import { cn } from "@/lib/utils";

interface PlacementBadgeProps {
  placement: string;
  expanded?: boolean;
  onClick?: () => void;
  className?: string;
}

export function PlacementBadge({
  placement,
  expanded = false,
  onClick,
  className,
}: PlacementBadgeProps) {
  const p = (placement || "").toLowerCase();

  const getLabel = () => {
    if (p.includes("top")) {
      return expanded ? "Top of Search" : "TOP";
    }
    if (p.includes("product")) {
      return expanded ? "Product Pages" : "PP";
    }
    if (p.includes("rest")) {
      return expanded ? "Rest of Search" : "ROS";
    }
    return placement;
  };

  const getBadgeClass = () => {
    if (p.includes("top")) {
      return "badge-top";
    }
    if (p.includes("product")) {
      return "badge-pp";
    }
    if (p.includes("rest")) {
      return "badge-ros";
    }
    return "";
  };

  return (
    <span
      onClick={onClick}
      className={cn(
        "inline-block px-2 py-1 rounded text-xs font-semibold font-mono whitespace-nowrap transition-all duration-200",
        getBadgeClass(),
        onClick && "cursor-pointer hover:opacity-80",
        className
      )}
    >
      {getLabel()}
    </span>
  );
}
