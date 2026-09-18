export function Avatar({ name, src, size = "md" }: { name: string; src?: string | null; size?: "sm" | "md" | "lg" }) {
  return <span className={`avatar avatar--${size}`}>{src ? <img src={src} alt="" /> : name.slice(0, 2).toUpperCase()}</span>;
}
