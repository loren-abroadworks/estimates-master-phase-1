
import React from 'react';
import { Typography, TypographyVariant, Spacing } from '../../theme/designSystem';

// --- Text Component ---

interface TextProps extends React.HTMLAttributes<HTMLElement> {
  variant?: TypographyVariant;
  as?: React.ElementType;
  className?: string;
  children: React.ReactNode;
}

export const Text: React.FC<TextProps> = ({ 
  variant = 'body', 
  as, 
  className = "", 
  children, 
  ...props 
}) => {
  // Determine HTML tag based on variant if not explicitly provided
  const Component = as || (
    variant.startsWith('h') ? variant : 
    variant === 'small' || variant === 'tiny' ? 'span' : 'p'
  ) as React.ElementType;

  return (
    <Component 
      className={`${Typography[variant]} ${className}`} 
      {...props}
    >
      {children}
    </Component>
  );
};

// --- Container Component ---

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  fluid?: boolean;
}

export const Container: React.FC<ContainerProps> = ({ 
  children, 
  className = "", 
  fluid = false 
}) => {
  const maxWidthClass = fluid ? 'w-full' : 'max-w-7xl';
  
  return (
    <div className={`w-full mx-auto ${Spacing.containerPx} ${maxWidthClass} ${className}`}>
      {children}
    </div>
  );
};

// --- Responsive Button Component ---

interface ResponsiveButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const ResponsiveButton: React.FC<ResponsiveButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = "",
  icon,
  ...props
}) => {
  const baseStyle = "font-medium transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:pointer-events-none rounded-xl";
  
  // Mobile: Always full width. Tablet+: Auto width
  const responsiveWidth = "w-full md:w-auto";

  const sizeStyles = {
    sm: "px-4 py-2.5 text-sm",
    md: "px-6 py-3.5 text-base md:text-lg", // Larger touch target on mobile
    lg: "px-8 py-4 text-lg md:text-xl"
  };

  const variants = {
    primary: "bg-primary-600 text-white hover:bg-primary-700 shadow-sm border border-transparent hover:shadow-primary-500/20",
    secondary: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 hover:border-red-200",
    ghost: "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
  };

  return (
    <button 
      className={`${baseStyle} ${responsiveWidth} ${sizeStyles[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};
