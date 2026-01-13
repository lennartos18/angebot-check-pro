import { motion } from "framer-motion";

export function AnimatedTrafficLight() {
  return (
    <div className="relative">
      {/* Traffic Light Housing */}
      <div className="bg-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="flex flex-col gap-4">
          {/* Green Light */}
          <motion.div
            className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center"
            animate={{
              backgroundColor: ["hsla(142, 71%, 45%, 0.2)", "hsla(142, 71%, 45%, 1)", "hsla(142, 71%, 45%, 0.2)"],
              boxShadow: [
                "0 0 0 0 hsla(142, 71%, 45%, 0)",
                "0 0 30px 10px hsla(142, 71%, 45%, 0.5)",
                "0 0 0 0 hsla(142, 71%, 45%, 0)"
              ]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 4,
              delay: 0
            }}
          >
            <span className="text-xs font-medium text-white/80">✓</span>
          </motion.div>

          {/* Yellow Light */}
          <motion.div
            className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center"
            animate={{
              backgroundColor: ["hsla(38, 92%, 50%, 0.2)", "hsla(38, 92%, 50%, 1)", "hsla(38, 92%, 50%, 0.2)"],
              boxShadow: [
                "0 0 0 0 hsla(38, 92%, 50%, 0)",
                "0 0 30px 10px hsla(38, 92%, 50%, 0.5)",
                "0 0 0 0 hsla(38, 92%, 50%, 0)"
              ]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 4,
              delay: 2
            }}
          >
            <span className="text-xs font-medium text-white/80">?</span>
          </motion.div>

          {/* Red Light */}
          <motion.div
            className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center"
            animate={{
              backgroundColor: ["hsla(0, 72%, 51%, 0.2)", "hsla(0, 72%, 51%, 1)", "hsla(0, 72%, 51%, 0.2)"],
              boxShadow: [
                "0 0 0 0 hsla(0, 72%, 51%, 0)",
                "0 0 30px 10px hsla(0, 72%, 51%, 0.5)",
                "0 0 0 0 hsla(0, 72%, 51%, 0)"
              ]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 4,
              delay: 4
            }}
          >
            <span className="text-xs font-medium text-white/80">!</span>
          </motion.div>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute -right-32 top-0 flex flex-col gap-4 pt-6">
        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-sm text-muted-foreground whitespace-nowrap">Im Rahmen</span>
        </motion.div>
        <motion.div
          className="flex items-center gap-2 mt-8"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 }}
        >
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-sm text-muted-foreground whitespace-nowrap">Prüfen</span>
        </motion.div>
        <motion.div
          className="flex items-center gap-2 mt-8"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.9 }}
        >
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-sm text-muted-foreground whitespace-nowrap">Auffällig</span>
        </motion.div>
      </div>
    </div>
  );
}
