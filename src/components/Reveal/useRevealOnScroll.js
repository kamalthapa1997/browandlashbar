import { useEffect, useRef, useState } from "react";

export default function useRevealOnScroll() {
  const elementRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = elementRef.current;

    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -36px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return {
    ref: elementRef,
    className: `reveal-on-scroll${isVisible ? " is-visible" : ""}`,
  };
}
