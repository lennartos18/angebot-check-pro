import { cn } from "@/lib/utils";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

type StatusType = "green" | "yellow" | "red";

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const statusConfig = {
  green: {
    icon: CheckCircle,
    text: "Plausibel",
    bgClass: "bg-status-green-bg",
    textClass: "text-status-green-foreground",
    iconClass: "text-status-green",
    borderClass: "border-status-green/20",
  },
  yellow: {
    icon: AlertTriangle,
    text: "Prüfen",
    bgClass: "bg-status-yellow-bg",
    textClass: "text-status-yellow-foreground",
    iconClass: "text-status-yellow",
    borderClass: "border-status-yellow/20",
  },
  red: {
    icon: XCircle,
    text: "Auffällig",
    bgClass: "bg-status-red-bg",
    textClass: "text-status-red-foreground",
    iconClass: "text-status-red",
    borderClass: "border-status-red/20",
  },
};

const sizeConfig = {
  sm: {
    padding: "px-2 py-0.5",
    text: "text-xs",
    icon: "w-3 h-3",
    gap: "gap-1",
  },
  md: {
    padding: "px-3 py-1",
    text: "text-sm",
    icon: "w-4 h-4",
    gap: "gap-1.5",
  },
  lg: {
    padding: "px-4 py-1.5",
    text: "text-base",
    icon: "w-5 h-5",
    gap: "gap-2",
  },
};

export function StatusBadge({
  status,
  label,
  showIcon = true,
  size = "md",
  className,
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const sizeStyles = sizeConfig[size];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full border",
        config.bgClass,
        config.textClass,
        config.borderClass,
        sizeStyles.padding,
        sizeStyles.text,
        sizeStyles.gap,
        className
      )}
    >
      {showIcon && <Icon className={cn(sizeStyles.icon, config.iconClass)} />}
      {label || config.text}
    </span>
  );
}
