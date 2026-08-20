import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

function TopbarToast({ toast }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          className={`admin-toast admin-toast--${toast.type}`}
          role={toast.type === "error" ? "alert" : "status"}
          initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.2,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {toast.type === "error" ? "!" : "✓"} {toast.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default TopbarToast;
