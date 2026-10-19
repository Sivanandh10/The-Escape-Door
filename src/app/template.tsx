// Root template: remounts on every top-level navigation → drives the #53 ink streak (a non-blocking accent;
// it never delays the commit — see PageTransition). Owner: F1.
import { PageTransition } from '@/components/motion/PageTransition'

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageTransition />
      {children}
    </>
  )
}
