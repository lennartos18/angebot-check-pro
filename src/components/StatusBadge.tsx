import { cn } from "@/lib/utils";
import { CheckCircle, AlertTriangle, XCircle, TrendingUp, ArrowDown, HelpCircle } from "lucide-react";

// Legacy-Status fuer Rueckwaertskompatibilitaet
export type LegacyStatusType = "green" | "yellow" | "red";

// Neue Bewertungsstufen (verbindlich)
export type EvaluationLevel = 
  | "im_regionalen_rahmen"
  | "leicht_ueber_vergleich"
  | "auffaellig_hoch"
  | "auffaellig_niedrig"
  | "nicht_einordenbar";

export type StatusType = LegacyStatusType | EvaluationLevel;

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Mapping von Legacy-Status auf neue Stufen
const legacyToEvaluationMap: Record<LegacyStatusType, EvaluationLevel> = {
  green: "im_regionalen_rahmen",
  yellow: "leicht_ueber_vergleich",
  red: "auffaellig_hoch",
};

// Neue Bewertungsstufen-Konfiguration
const evaluationConfig = {
  im_regionalen_rahmen: {
    icon: CheckCircle,
    text: "Im regionalen Rahmen",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
    textClass: "text-emerald-700 dark:text-emerald-400",
    iconClass: "text-emerald-600 dark:text-emerald-500",
    borderClass: "border-emerald-200 dark:border-emerald-800",
  },
  leicht_ueber_vergleich: {
    icon: TrendingUp,
    text: "Leicht über Vergleich",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    textClass: "text-amber-700 dark:text-amber-400",
    iconClass: "text-amber-600 dark:text-amber-500",
    borderClass: "border-amber-200 dark:border-amber-800",
  },
  auffaellig_hoch: {
    icon: XCircle,
    text: "Auffällig hoch",
    bgClass: "bg-red-50 dark:bg-red-950/30",
    textClass: "text-red-700 dark:text-red-400",
    iconClass: "text-red-600 dark:text-red-500",
    borderClass: "border-red-200 dark:border-red-800",
  },
  auffaellig_niedrig: {
    icon: ArrowDown,
    text: "Auffällig niedrig",
    bgClass: "bg-blue-50 dark:bg-blue-950/30",
    textClass: "text-blue-700 dark:text-blue-400",
    iconClass: "text-blue-600 dark:text-blue-500",
    borderClass: "border-blue-200 dark:border-blue-800",
  },
  nicht_einordenbar: {
    icon: HelpCircle,
    text: "Nicht einordenbar",
    bgClass: "bg-gray-50 dark:bg-gray-900/30",
    textClass: "text-gray-600 dark:text-gray-400",
    iconClass: "text-gray-500 dark:text-gray-500",
    borderClass: "border-gray-200 dark:border-gray-700",
  },
};

// Legacy-Konfiguration fuer Rueckwaertskompatibilitaet
const statusConfig = {
  green: evaluationConfig.im_regionalen_rahmen,
  yellow: evaluationConfig.leicht_ueber_vergleich,
  red: evaluationConfig.auffaellig_hoch,
  ...evaluationConfig,
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
