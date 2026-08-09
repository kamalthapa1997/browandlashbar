import { motion } from "framer-motion";

const pageTransition = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1],
};

function PageTransition({ children }) {
  return (
    <motion.main
      className="page-transition page-details"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={pageTransition}
    >
      {children}
    </motion.main>
  );
}

export default PageTransition;
