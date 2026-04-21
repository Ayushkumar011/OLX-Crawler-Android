import React from "react";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";

export const GlassCard = React.forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  ({ className, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={cn("glass-panel rounded-2xl p-6 relative overflow-hidden", className)}
        {...props}
      >
        {/* Subtle inner highlight */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none rounded-2xl" />

        {/* FIX: Changed standard div to motion.div to support motion children */}
        <motion.div className="relative z-10">{children}</motion.div>
      </motion.div>
    );
  }
);
GlassCard.displayName = "GlassCard";

export const NeonButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }>(
  ({ className, variant = 'primary', children, ...props }, ref) => {
    const variants = {
      primary: "bg-gradient-to-r from-primary to-secondary hover:shadow-[0_0_20px_rgba(0,255,255,0.4)] border-transparent text-white",
      secondary: "bg-white/10 hover:bg-white/20 border-white/20 hover:shadow-[0_0_15px_rgba(255,255,255,0.2)] text-white",
      danger: "bg-gradient-to-r from-destructive to-pink-600 hover:shadow-[0_0_20px_rgba(255,50,50,0.4)] border-transparent text-white",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "px-6 py-3 rounded-xl font-bold font-display tracking-wide transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 border disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:shadow-none",
          variants[variant],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
NeonButton.displayName = "NeonButton";

export const GlassInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn("glass-input w-full", className)}
        {...props}
      />
    );
  }
);
GlassInput.displayName = "GlassInput";

export const GradientText = ({ children, className, as: Component = "span" }: { children: React.ReactNode, className?: string, as?: any }) => {
  return (
    <Component className={cn("text-gradient", className)}>
      {children}
    </Component>
  );
};
