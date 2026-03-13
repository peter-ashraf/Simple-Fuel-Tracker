import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'framer-motion';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const Card = forwardRef(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn("bg-card/80 backdrop-blur-md border border-white/10 shadow-xl rounded-3xl p-5 relative overflow-hidden", className)} {...props}>
    {children}
  </div>
));
Card.displayName = "Card"

export const Input = forwardRef(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn("w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl px-5 py-4 text-left text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all font-medium", className)}
    {...props}
  />
));
Input.displayName = "Input"

export const Label = forwardRef(({ className, children, ...props }, ref) => (
  <label ref={ref} className={cn("text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block ml-1", className)} {...props}>
    {children}
  </label>
));
Label.displayName = "Label"

export const PageWrapper = ({ children, className }) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.98, filter: 'blur(4px)' }}
    animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
    exit={{ opacity: 0, scale: 0.96, filter: 'blur(4px)', transition: { duration: 0.15 } }}
    transition={{ type: 'spring', stiffness: 280, damping: 20 }}
    className={cn("w-full relative", className)}
  >
    {children}
  </motion.div>
);
