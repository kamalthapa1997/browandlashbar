import { motion, useReducedMotion } from "framer-motion";

const pageTransition = {
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1],
};

function PageTransition({ children }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.main
      className="page-transition page-details"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? undefined : { opacity: 0, y: -5 }}
      transition={{
        ...pageTransition,
        duration: shouldReduceMotion ? 0 : pageTransition.duration,
      }}
    >
      {children}
    </motion.main>
  );
}

export default PageTransition;
