// Root template: remounts on every top-level navigation → drives the #53 page-turn. Owner: F1.
import { PageTransition } from '@/components/motion/PageTransition'

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageTransition />
      {children}
    </>
  )
}
