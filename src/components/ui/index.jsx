import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'framer-motion';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const Card = forwardRef(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn("bg-white dark:bg-white/[0.03] rounded-3xl p-5 relative border-0", className)} {...props}>
    {children}
  </div>
));
Card.displayName = "Card"

export const MetricCard = forwardRef(({ as: Component = "div", className, children, variant = "default", ...props }, ref) => {
  const variants = {
    default: "bg-slate-50 dark:bg-white/[0.03]",
    secondary: "bg-slate-100/80 dark:bg-white/[0.06]",
    accent: "bg-emerald-50/50 dark:bg-emerald-500/10"
  };
  return (
    <Component ref={ref} className={cn(`${variants[variant]} rounded-3xl p-5 relative overflow-hidden border-0`, className)} {...props}>
      {children}
    </Component>
  );
});
MetricCard.displayName = "MetricCard"

export const Input = forwardRef(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn("input-field", className)}
    {...props}
  />
));
Input.displayName = "Input"

export const Label = forwardRef(({ className, children, ...props }, ref) => (
  <label ref={ref} className={cn("text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block ms-1", className)} {...props}>
    {children}
  </label>
));
Label.displayName = "Label"

export { Modal, ConfirmModal } from './Modal';
export { IconPicker, ICON_MAP_DATA } from './IconPicker';
export { FuelGaugeSlider } from './FuelGaugeSlider';

export const PageWrapper = ({ children, className }) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
    transition={{ type: 'spring', stiffness: 280, damping: 20 }}
    className={cn("w-full relative", className)}
  >
    {children}
  </motion.div>
);
