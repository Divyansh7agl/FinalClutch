
import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-8',
    md: 'h-12',
    lg: 'h-24',
    xl: 'h-48'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <img 
        src="logo.png" 
        alt="ClutchAI Logo" 
        className={`${sizeClasses[size]} w-auto object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]`}
      />
    </div>
  );
};

export default Logo;
