type BrandLogoProps = {
  compact?: boolean;
  className?: string;
};

export function BrandLogo({ compact = false, className = "" }: BrandLogoProps) {
  return (
    <span className={`brand-logo ${compact ? "brand-logo--compact" : ""} ${className}`} aria-label="Bro in Campus">
      <img src="/brand/bro-in-campus-logo-transparent.png" alt="Bro in Campus" />
    </span>
  );
}
